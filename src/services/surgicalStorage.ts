import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { SurgicalInstrument, SurgicalSet, SurgicalSetStatus, InstrumentStatus } from '../types';
import { saveImageToDB, getImageFromDB } from './storage';
import { FirestoreSyncService } from './firestoreSync';

// Start clean with empty sets and instruments
const STORAGE_KEYS = {
  SURGICAL_SETS: 'asset_mgmt_surgical_sets',
  SURGICAL_INSTRUMENTS: 'asset_mgmt_surgical_instruments',
};

function getItem<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key);
    if (!data || data === 'undefined' || data === 'null') {
      return defaultValue;
    }
    const parsed = JSON.parse(data);
    return parsed ?? defaultValue;
  } catch (err) {
    console.error(`Error reading ${key}:`, err);
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error writing ${key}:`, err);
  }
}

/**
 * Normalizes an instrument code for fuzzy/exact matching.
 * e.g. "OB-01", "ob-1", "OB_1", "OB 1", "ob01" -> "ob1"
 */
export function normalizeInstrumentCode(code: string): string {
  if (!code) return '';
  return code
    .toLowerCase()
    .trim()
    .replace(/^(\D+)0+(\d+)$/, '$1$2') // removes leading zero e.g. OB01 -> OB1, OB-01 -> OB-1
    .replace(/[\s\-_.:/()#]/g, '');
}

/**
 * Extracts a candidate code from a filename.
 * e.g. "OB-1.jpg" -> "OB-1"
 * e.g. "OB-01_Hohmann_Retractor.png" -> "OB-01"
 * e.g. "OB 25 - Kocher curved.jpeg" -> "OB-25"
 */
export function extractCodeFromFileName(fileName: string): string {
  if (!fileName) return '';
  const base = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
  const clean = base.trim();
  
  // Try pattern matching like "OB-1", "OB01", "SET1-05", "INS-42"
  const match = clean.match(/^([A-Za-z0-9]+[-_ ]?[A-Za-z0-9]+)/);
  if (match) {
    return match[1].trim();
  }
  return clean;
}

export class SurgicalService {
  // ==========================================
  // Sets Management
  // ==========================================
  static getSets(): SurgicalSet[] {
    const sets = getItem<SurgicalSet[]>(STORAGE_KEYS.SURGICAL_SETS, []);
    return Array.isArray(sets) ? sets : [];
  }

  static saveSets(sets: SurgicalSet[]): void {
    setItem(STORAGE_KEYS.SURGICAL_SETS, sets);
  }

  static getSetById(id: string): SurgicalSet | undefined {
    return this.getSets().find((s) => s.id === id);
  }

  static saveSet(set: SurgicalSet): void {
    const sets = this.getSets();
    const index = sets.findIndex((s) => s.id === set.id);
    set.updatedAt = new Date().toISOString();

    // If image is a base64 data URI, store in IndexedDB and replace with lightweight reference
    if (set.imageUrl && set.imageUrl.startsWith('data:')) {
      saveImageToDB(`set_${set.id}`, set.imageUrl);
      saveImageToDB(`set_code_${set.code}`, set.imageUrl);
      if (set.code) saveImageToDB(set.code, set.imageUrl);
      set.imageUrl = `idb://set_${set.id}`;
    }

    if (index >= 0) {
      sets[index] = set;
    } else {
      sets.unshift(set);
    }
    this.saveSets(sets);
    FirestoreSyncService.syncSurgicalSet(set);
  }

  static deleteSet(id: string): void {
    const sets = this.getSets().filter((s) => s.id !== id);
    this.saveSets(sets);
    FirestoreSyncService.deleteSurgicalSet(id);

    // Also remove associated instruments
    const instruments = this.getInstruments();
    const removed = instruments.filter((i) => i.setId === id);
    const remaining = instruments.filter((i) => i.setId !== id);
    this.saveInstruments(remaining);
    removed.forEach((inst) => FirestoreSyncService.deleteSurgicalInstrument(inst.id));
  }

  // ==========================================
  // Instruments Management
  // ==========================================
  static getInstruments(setId?: string): SurgicalInstrument[] {
    const instruments = getItem<SurgicalInstrument[]>(STORAGE_KEYS.SURGICAL_INSTRUMENTS, []);
    const valid = Array.isArray(instruments) ? instruments : [];
    if (setId) {
      return valid.filter((i) => i.setId === setId);
    }
    return valid;
  }

  static saveInstruments(instruments: SurgicalInstrument[]): void {
    setItem(STORAGE_KEYS.SURGICAL_INSTRUMENTS, instruments);
    
    // Update instrument counts for all sets
    const sets = this.getSets();
    let changed = false;
    sets.forEach((set) => {
      const count = instruments.filter((i) => i.setId === set.id).length;
      if (set.instrumentsCount !== count) {
        set.instrumentsCount = count;
        changed = true;
      }
    });
    if (changed) {
      this.saveSets(sets);
    }
  }

  static saveInstrument(instrument: SurgicalInstrument): void {
    const instruments = this.getInstruments();
    const index = instruments.findIndex((i) => i.id === instrument.id);
    instrument.updatedAt = new Date().toISOString();

    // If image is a base64 data URI, store in IndexedDB and replace with lightweight reference
    if (instrument.imageUrl && instrument.imageUrl.startsWith('data:')) {
      saveImageToDB(`inst_${instrument.id}`, instrument.imageUrl);
      saveImageToDB(`code_${instrument.code}`, instrument.imageUrl);
      saveImageToDB(instrument.code, instrument.imageUrl);
      instrument.imageUrl = `idb://${instrument.code}`;
    }

    if (index >= 0) {
      instruments[index] = instrument;
    } else {
      instruments.push(instrument);
    }
    this.saveInstruments(instruments);
    FirestoreSyncService.syncSurgicalInstrument(instrument);
  }

  /**
   * Scans instruments for missing image references and recovers them if present in IndexedDB
   */
  static async syncAndRecoverInstrumentImages(): Promise<number> {
    const instruments = this.getInstruments();
    let recoveredCount = 0;
    let changed = false;

    for (const inst of instruments) {
      if (!inst.imageUrl || inst.imageUrl.trim() === '') {
        const checkKeys = [`code_${inst.code}`, `inst_${inst.id}`, inst.code];
        for (const k of checkKeys) {
          try {
            const dbData = await getImageFromDB(k);
            if (dbData) {
              inst.imageUrl = `idb://${inst.code}`;
              recoveredCount++;
              changed = true;
              break;
            }
          } catch {
            // continue
          }
        }
      }
    }

    if (changed) {
      this.saveInstruments(instruments);
    }
    return recoveredCount;
  }

  static deleteInstrument(id: string): void {
    const instruments = this.getInstruments().filter((i) => i.id !== id);
    this.saveInstruments(instruments);
    FirestoreSyncService.deleteSurgicalInstrument(id);
  }

  // ==========================================
  // Excel Import (Directly parses sheet template)
  // ==========================================
  static async importSetsAndInstrumentsFromExcel(file: File): Promise<{
    setsCreated: number;
    instrumentsCreated: number;
    setName: string;
  }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (!rawRows || rawRows.length < 2) {
            throw new Error('الملف فارغ أو لا يحتوي على صفوف صالحة.');
          }

          // Locate header row
          let headerRowIndex = 0;
          let colIndices = {
            setName: -1,
            code: -1,
            instrumentName: -1,
            size: -1,
            partNumber: -1,
            quantity: -1,
            bookQuantity: -1,
            note: -1,
          };

          for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
            const row = rawRows[r] as any[];
            if (!row) continue;
            for (let c = 0; c < row.length; c++) {
              const val = String(row[c] || '').trim().toLowerCase();
              if (val.includes('set name') || val.includes('اسم السيت') || val.includes('اسم الطقم') || val.includes('set') || val.includes('السيت')) {
                colIndices.setName = c;
                headerRowIndex = r;
              }
              if (val.includes('cod') || val.includes('كود') || val.includes('رمز')) {
                colIndices.code = c;
                headerRowIndex = r;
              }
              if (val.includes('instrument') || val.includes('اسم الاداة') || val.includes('اسم الأداة') || val.includes('أداة') || val.includes('اداة')) {
                colIndices.instrumentName = c;
                headerRowIndex = r;
              }
              if (val.includes('size') || val.includes('الحجم') || val.includes('المقاس') || val.includes('النوع')) {
                colIndices.size = c;
              }
              // Part Number / Catalog Number (e.g. Number column in the excel)
              if (val === 'number' || val.includes('part') || val.includes('catalog') || val.includes('رقم القطعة') || val.includes('الموديل')) {
                colIndices.partNumber = c;
              }
              // Quantities (Standard / Required count) - explicit match on الكمية or qty/quantity or العدد
              if (
                val === 'qty' ||
                val === 'quantity' ||
                val === 'الكمية' ||
                val === 'كمية' ||
                val === 'العدد' ||
                val.includes('الكمية المطلوبة') ||
                val.includes('الكمية المعيارية')
              ) {
                colIndices.quantity = c;
              }
              // Book / Actual Quantity
              if (val.includes('دفتر') || val.includes('فعلي') || val.includes('actual') || val.includes('book') || val.includes('الكمية الدفترية') || val.includes('الكمية الفعلية')) {
                colIndices.bookQuantity = c;
              }
              if (val.includes('note') || val.includes('ملاحظ')) {
                colIndices.note = c;
              }
            }
            if (colIndices.code !== -1 && (colIndices.instrumentName !== -1 || colIndices.setName !== -1)) {
              break;
            }
          }

          // Fallback column index defaults if header is standard (A=setName, B=code, C=instrumentName, D=size, E=partNumber, F=qty, G=bookQty, H=note)
          if (colIndices.setName === -1) colIndices.setName = 0;
          if (colIndices.code === -1) colIndices.code = 1;
          if (colIndices.instrumentName === -1) colIndices.instrumentName = 2;
          if (colIndices.size === -1) colIndices.size = 3;
          if (colIndices.partNumber === -1 && colIndices.quantity !== 4) colIndices.partNumber = 4;
          if (colIndices.quantity === -1) colIndices.quantity = colIndices.partNumber === 4 ? 5 : 4;
          if (colIndices.bookQuantity === -1) colIndices.bookQuantity = 6;
          if (colIndices.note === -1) colIndices.note = 7;

          const existingSets = this.getSets();
          const existingInstruments = this.getInstruments();

          // Helper to parse numbers supporting Eastern Arabic numerals (١، ٢، ٣)
          const parseNumeric = (val: any): number => {
            if (val === null || val === undefined) return 0;
            let str = String(val).trim();
            // Convert Eastern Arabic numerals to standard 0-9
            str = str.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
            const parsed = parseFloat(str);
            return isNaN(parsed) ? 0 : parsed;
          };

          // Group by set name
          const setsMap = new Map<string, { set: SurgicalSet; instruments: SurgicalInstrument[] }>();
          let importedSetName = '';

          for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
            const row = rawRows[r] as any[];
            if (!row || row.length === 0) continue;

            const setNameRaw = String(row[colIndices.setName] || '').trim() || file.name.replace(/\.[^/.]+$/, '');
            const codeRaw = String(row[colIndices.code] || '').trim();
            const instNameRaw = String(row[colIndices.instrumentName] || '').trim();

            if (!codeRaw && !instNameRaw) continue; // Skip empty rows

            importedSetName = setNameRaw;
            const setKey = setNameRaw.toLowerCase();

            if (!setsMap.has(setKey)) {
              // Find existing set or prepare new
              let s = existingSets.find((x) => x.name.toLowerCase() === setKey);
              if (!s) {
                const newSetId = `set-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                s = {
                  id: newSetId,
                  name: setNameRaw,
                  code: `SET-${codeRaw.split('-')[0] || 'SURG'}-${Date.now().toString().slice(-4)}`,
                  department: 'العمليات (OR)',
                  subLocation: 'مستودع السيتات المعقمة',
                  status: 'جاهز للاستخدام',
                  trayNumber: `حاوية ${setNameRaw}`,
                  notes: 'تم الاستيراد من ملف إكسل',
                  instrumentsCount: 0,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
              }
              setsMap.set(setKey, { set: s, instruments: [] });
            }

            const setEntry = setsMap.get(setKey)!;
            const sizeVal = colIndices.size !== -1 && row[colIndices.size] ? String(row[colIndices.size]).trim() : '';
            const partNumVal = colIndices.partNumber !== -1 && row[colIndices.partNumber] ? String(row[colIndices.partNumber]).trim() : '';

            // Quantity parsing: read standard expected quantity
            let parsedQty = colIndices.quantity !== -1 ? parseNumeric(row[colIndices.quantity]) : 0;
            if (parsedQty <= 0) {
              parsedQty = 1;
            }

            // Book / Actual Quantity parsing
            let parsedActualQty = colIndices.bookQuantity !== -1 ? parseNumeric(row[colIndices.bookQuantity]) : 0;
            if (parsedActualQty <= 0) {
              parsedActualQty = parsedQty; // Default to standard quantity if book quantity column is empty
            }

            // Combine size with part number if part number exists and is not already part of size
            let finalSize = sizeVal;
            if (partNumVal) {
              if (finalSize && !finalSize.includes(partNumVal)) {
                finalSize = `${finalSize} (${partNumVal})`;
              } else if (!finalSize) {
                finalSize = partNumVal;
              }
            }

            const notesVal = colIndices.note !== -1 && row[colIndices.note] ? String(row[colIndices.note]).trim() : '';

            const instCode = codeRaw || `INST-${setEntry.instruments.length + 1}`;
            const instName = instNameRaw || `أداة ${instCode}`;

            // Check if there was an existing instrument with the same code in this set to preserve its photo
            const previousInstrument = existingInstruments.find(
              (oldInst) => oldInst.setId === setEntry.set.id && oldInst.code.toLowerCase() === instCode.toLowerCase()
            );

            const instrumentItem: SurgicalInstrument = {
              id: previousInstrument?.id || `inst-${setEntry.set.id}-${Date.now()}-${setEntry.instruments.length + 1}`,
              setId: setEntry.set.id,
              setCode: setEntry.set.code,
              setName: setEntry.set.name,
              code: instCode,
              name: instName,
              size: finalSize,
              quantity: parsedQty,
              actualQuantity: parsedActualQty,
              status: 'سليم',
              notes: notesVal,
              imageUrl: previousInstrument?.imageUrl, // Safely preserve photo if existed
              updatedAt: new Date().toISOString(),
            };

            setEntry.instruments.push(instrumentItem);
          }

          let newSetsAdded = 0;
          let newInstrumentsAdded = 0;

          setsMap.forEach((entry) => {
            const existingSetIdx = existingSets.findIndex((s) => s.id === entry.set.id);
            entry.set.instrumentsCount = entry.instruments.length;
            if (existingSetIdx >= 0) {
              existingSets[existingSetIdx] = entry.set;
            } else {
              existingSets.unshift(entry.set);
              newSetsAdded++;
            }

            // Remove old instruments of this set to prevent duplicates, then add new
            const filteredOld = existingInstruments.filter((i) => i.setId !== entry.set.id);
            existingInstruments.length = 0;
            existingInstruments.push(...filteredOld, ...entry.instruments);
            newInstrumentsAdded += entry.instruments.length;
          });

          this.saveSets(existingSets);
          this.saveInstruments(existingInstruments);

          // Push new sets and instruments to Cloud Firestore
          setsMap.forEach((entry) => {
            FirestoreSyncService.syncSurgicalSet(entry.set);
            entry.instruments.forEach((inst) => FirestoreSyncService.syncSurgicalInstrument(inst));
          });

          resolve({
            setsCreated: newSetsAdded,
            instrumentsCreated: newInstrumentsAdded,
            setName: importedSetName || file.name,
          });
        } catch (err: any) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('فشل قراءة ملف الإكسل.'));
      reader.readAsArrayBuffer(file);
    });
  }

  // ==========================================
  // Batch Image Import with Smart Code Matching
  // ==========================================
  static async batchImportImages(
    files: File[],
    targetSetId?: string,
    onProgress?: (percent: number, currentFileName: string, processedCount: number, totalCount: number) => void
  ): Promise<{
    total: number;
    matched: number;
    unmatched: number;
    results: {
      fileName: string;
      detectedCode: string;
      matchedInstrumentName?: string;
      matchedSetName?: string;
      success: boolean;
      error?: string;
    }[];
  }> {
    const allInstruments = this.getInstruments();
    const targetInstruments = targetSetId
      ? allInstruments.filter((i) => i.setId === targetSetId)
      : allInstruments;

    const allSets = this.getSets();
    const results: any[] = [];
    let matchedCount = 0;
    let unmatchedCount = 0;

    // Build lookup map for instruments by normalized codes
    const codeMap = new Map<string, SurgicalInstrument>();
    targetInstruments.forEach((inst) => {
      const nKey = normalizeInstrumentCode(inst.code);
      if (nKey) codeMap.set(nKey, inst);

      // Also map exact code
      codeMap.set(inst.code.trim().toLowerCase(), inst);
    });

    for (let idx = 0; idx < files.length; idx++) {
      const file = files[idx];
      if (onProgress) {
        onProgress(Math.round(((idx + 1) / files.length) * 100), file.name, idx + 1, files.length);
      }

      if (!file.type.startsWith('image/')) {
        results.push({
          fileName: file.name,
          detectedCode: '',
          success: false,
          error: 'الملف ليس صورة صالحة',
        });
        unmatchedCount++;
        continue;
      }

      const detectedCode = extractCodeFromFileName(file.name);
      const normalizedDetected = normalizeInstrumentCode(detectedCode);

      let matchedInst = codeMap.get(normalizedDetected) || codeMap.get(detectedCode.toLowerCase());

      // Fuzzy fallback: if file name contains the instrument code anywhere (e.g. "photo_OB-1_tray.jpg")
      if (!matchedInst) {
        for (const inst of targetInstruments) {
          const instCodeNorm = normalizeInstrumentCode(inst.code);
          const rawNorm = normalizeInstrumentCode(file.name);
          if (instCodeNorm && rawNorm.includes(instCodeNorm)) {
            matchedInst = inst;
            break;
          }
        }
      }

      if (matchedInst) {
        try {
          const base64Data = await this.fileToBase64(file);
          // Save to IndexedDB under multiple keys
          await saveImageToDB(`inst_${matchedInst.id}`, base64Data);
          await saveImageToDB(`code_${matchedInst.code}`, base64Data);
          await saveImageToDB(matchedInst.code, base64Data);

          // Update instrument record with lightweight reference
          matchedInst.imageUrl = `idb://${matchedInst.code}`;
          matchedInst.updatedAt = new Date().toISOString();
          this.saveInstrument(matchedInst);

          const parentSet = allSets.find((s) => s.id === matchedInst!.setId);

          results.push({
            fileName: file.name,
            detectedCode: matchedInst.code,
            matchedInstrumentName: matchedInst.name,
            matchedSetName: parentSet?.name || matchedInst.setName || 'السيت',
            success: true,
          });
          matchedCount++;
        } catch (err: any) {
          results.push({
            fileName: file.name,
            detectedCode,
            matchedInstrumentName: matchedInst.name,
            success: false,
            error: err?.message || 'فشل ضغط وحفظ الصورة',
          });
          unmatchedCount++;
        }
      } else {
        // Check if image matches a surgical set (by code or name)
        let matchedSet: SurgicalSet | undefined;
        if (targetSetId) {
          const targetSet = allSets.find((s) => s.id === targetSetId);
          if (targetSet) {
            const rawNorm = normalizeInstrumentCode(file.name);
            const setCodeNorm = normalizeInstrumentCode(targetSet.code);
            const setNameNorm = normalizeInstrumentCode(targetSet.name);
            if (
              (setCodeNorm && rawNorm.includes(setCodeNorm)) ||
              (setNameNorm && rawNorm.includes(setNameNorm)) ||
              rawNorm.includes('cover') ||
              rawNorm.includes('غلاف') ||
              rawNorm.includes('set')
            ) {
              matchedSet = targetSet;
            }
          }
        }

        if (!matchedSet) {
          for (const s of allSets) {
            const setCodeNorm = normalizeInstrumentCode(s.code);
            const setNameNorm = normalizeInstrumentCode(s.name);
            const rawNorm = normalizeInstrumentCode(file.name);
            if (
              (setCodeNorm && rawNorm === setCodeNorm) ||
              (setNameNorm && rawNorm === setNameNorm) ||
              (setCodeNorm && rawNorm.includes(setCodeNorm))
            ) {
              matchedSet = s;
              break;
            }
          }
        }

        if (matchedSet) {
          try {
            const base64Data = await this.fileToBase64(file);
            await saveImageToDB(`set_${matchedSet.id}`, base64Data);
            await saveImageToDB(`set_code_${matchedSet.code}`, base64Data);
            if (matchedSet.code) await saveImageToDB(matchedSet.code, base64Data);

            matchedSet.imageUrl = `idb://set_${matchedSet.id}`;
            matchedSet.updatedAt = new Date().toISOString();
            this.saveSet(matchedSet);

            results.push({
              fileName: file.name,
              detectedCode: matchedSet.code,
              matchedInstrumentName: `غلاف سيت: ${matchedSet.name}`,
              matchedSetName: matchedSet.name,
              success: true,
            });
            matchedCount++;
          } catch (err: any) {
            results.push({
              fileName: file.name,
              detectedCode: matchedSet.code,
              matchedInstrumentName: `غلاف سيت: ${matchedSet.name}`,
              success: false,
              error: err?.message || 'فشل حفظ صورة غلاف السيت',
            });
            unmatchedCount++;
          }
        } else {
          results.push({
            fileName: file.name,
            detectedCode,
            success: false,
            error: `لم يتم العثور على أداة أو سيت بالكود: ${detectedCode || file.name}`,
          });
          unmatchedCount++;
        }
      }
    }

    return {
      total: files.length,
      matched: matchedCount,
      unmatched: unmatchedCount,
      results,
    };
  }

  // ==========================================
  // Batch Image Export to ZIP
  // ==========================================
  static async exportImagesToZip(setId?: string): Promise<{ blob: Blob; count: number; filename: string }> {
    const instruments = this.getInstruments(setId);
    const sets = this.getSets();
    const targetSet = setId ? sets.find((s) => s.id === setId) : null;

    const zip = new JSZip();
    let exportedCount = 0;

    for (const inst of instruments) {
      let dataUrl = inst.imageUrl;
      if (!dataUrl || dataUrl.startsWith('idb://')) {
        dataUrl =
          (await getImageFromDB(`inst_${inst.id}`)) ||
          (await getImageFromDB(`code_${inst.code}`)) ||
          (await getImageFromDB(inst.code)) ||
          (inst.imageUrl ? await getImageFromDB(inst.imageUrl.replace('idb://', '')) : null) ||
          undefined;
      }

      if (dataUrl && dataUrl.startsWith('data:image/')) {
        const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (matches && matches[2]) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const base64Data = matches[2];
          
          // Clean file name: OB-1.jpg (code only)
          const safeCode = inst.code.replace(/[/\\?%*:|"<>]/g, '-');
          const fileName = `${safeCode}.${ext}`;

          zip.file(fileName, base64Data, { base64: true });
          exportedCount++;
        }
      }
    }

    if (exportedCount === 0) {
      throw new Error('لا توجد صور مسجلة للأدوات الجراحية لتصديرها.');
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipName = targetSet
      ? `صور_أدوات_${targetSet.name.replace(/\s+/g, '_')}.zip`
      : `صور_كافة_الأدوات_الجراحية_${new Date().toISOString().split('T')[0]}.zip`;

    return {
      blob: zipBlob,
      count: exportedCount,
      filename: zipName,
    };
  }

  // ==========================================
  // Export Set / All Sets to Excel (Matching Image Format)
  // ==========================================
  static exportSetToExcel(setId: string): void {
    const targetSet = this.getSetById(setId);
    if (!targetSet) return;
    const instruments = this.getInstruments(setId);

    const rows = instruments.map((inst) => {
      const actual = inst.actualQuantity ?? inst.quantity;
      const variance = actual - inst.quantity;
      return {
        'Set Name': targetSet.name,
        'Cod-': inst.code,
        'Instrument Name': inst.name,
        'Size': inst.size || '',
        'الكمية المعيارية': inst.quantity,
        'الكمية الدفترية': actual,
        'الفارق': variance === 0 ? '0 (مطابق)' : variance < 0 ? `${variance} (نقص)` : `+${variance} (زيادة)`,
        'الحالة': inst.status,
        'Note': inst.notes || (inst.status !== 'سليم' ? inst.status : ''),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'الأدوات الجراحية');

    const fileName = `جرد_${targetSet.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }

  static exportAllSetsToExcel(): void {
    const sets = this.getSets();
    const allInstruments = this.getInstruments();

    const rows = allInstruments.map((inst) => {
      const parentSet = sets.find((s) => s.id === inst.setId);
      const actual = inst.actualQuantity ?? inst.quantity;
      const variance = actual - inst.quantity;
      return {
        'Set Name': parentSet?.name || inst.setName || 'سيت عام',
        'Cod-': inst.code,
        'Instrument Name': inst.name,
        'Size': inst.size || '',
        'الكمية المعيارية': inst.quantity,
        'الكمية الدفترية': actual,
        'الفارق': variance === 0 ? '0 (مطابق)' : variance < 0 ? `${variance} (نقص)` : `+${variance} (زيادة)`,
        'الحالة': inst.status,
        'Note': inst.notes || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'كافة السيتات والأدوات');

    const fileName = `سجل_السيتات_والأدوات_الجراحية_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }

  // ==========================================
  // Utility: File to Compressed Base64 Image
  // ==========================================
  static fileToBase64(file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.85): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('فشل معالجة الصورة'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('فشل قراءة ملف الصورة'));
      reader.readAsDataURL(file);
    });
  }
}

export { SurgicalService as SurgicalStorageService };

