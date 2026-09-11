import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeCameraScanConfig } from 'html5-qrcode';
import Tesseract from 'tesseract.js';
import {
  Camera,
  X,
  RefreshCw,
  Zap,
  ZapOff,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  VolumeX,
  ScanLine,
  FileText,
  Image as ImageIcon,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface BarcodeCameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (scannedText: string) => void;
  title?: string;
  continuous?: boolean;
}

export const BarcodeCameraScanner: React.FC<BarcodeCameraScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'مسح كود الجهاز / الرقم التسلسلي بالكاميرا',
  continuous = false,
}) => {
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');

  // Mode: Barcode / QR or OCR Serial Reader
  const [scanMode, setScanMode] = useState<'barcode' | 'ocr'>('barcode');
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string>('');
  const [ocrCandidates, setOcrCandidates] = useState<string[]>([]);
  const [ocrImagePreview, setOcrImagePreview] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'interactive-barcode-scanner-region';
  const lastScanTimeRef = useRef<number>(0);
  const galleryFileInputRef = useRef<HTMLInputElement | null>(null);

  // Play subtle feedback beep
  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // Audio context might be restricted before user gesture
    }

    if (navigator.vibrate) {
      try {
        navigator.vibrate(100);
      } catch {
        // ignore
      }
    }
  }, [soundEnabled]);

  // Clean and start camera scanning
  const startCamera = async (cameraId?: string) => {
    try {
      setError(null);
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } else {
        scannerRef.current = new Html5Qrcode(scannerContainerId, {
          verbose: false,
        });
      }

      const config: Html5QrcodeCameraScanConfig = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdge * 0.75);
          return {
            width: Math.max(200, Math.min(qrboxSize, 340)),
            height: Math.max(160, Math.min(Math.floor(qrboxSize * 0.7), 260)),
          };
        },
        aspectRatio: 1.0,
      };

      const cameraParam = cameraId ? { deviceId: { exact: cameraId } } : { facingMode: 'environment' };

      await scannerRef.current.start(
        cameraParam,
        config,
        (decodedText) => {
          // If in OCR mode, ignore continuous barcode interrupts so user can focus on serial numbers
          if (scanMode === 'ocr') return;

          const now = Date.now();
          if (now - lastScanTimeRef.current < 1500 && lastScanned === decodedText) {
            return;
          }

          lastScanTimeRef.current = now;
          setLastScanned(decodedText);
          playBeep();

          onScan(decodedText);

          if (!continuous) {
            handleClose();
          }
        },
        () => {
          // Frame errors (silent)
        }
      );

      setIsScanning(true);

      // Check for torch capability
      try {
        const capabilities = scannerRef.current.getRunningTrackCapabilities();
        if ((capabilities as any)?.torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.error('Camera start error:', err);
      setError(
        err?.message ||
          'تعذر تشغيل الكاميرا. يرجى التأكد من منح الإذن لاستخدام الكاميرا والتأكد من عدم استخدامها من تطبيق آخر.'
      );
      setIsScanning(false);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      setIsScanning(false);
    }
  };

  const handleClose = async () => {
    await stopCamera();
    onClose();
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState }] as any,
      });
      setTorchOn(nextState);
    } catch (err) {
      console.error('Torch toggle failed:', err);
    }
  };

  const switchCamera = async () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCam = cameras[nextIndex];
    setSelectedCameraId(nextCam.id);
    await stopCamera();
    await startCamera(nextCam.id);
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let isMounted = true;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        if (devices && devices.length > 0) {
          const formatted = devices.map((d) => ({
            id: d.id,
            label: d.label || `كاميرا ${d.id.substring(0, 5)}`,
          }));
          setCameras(formatted);
          // Prefer back camera if available
          const backCam = formatted.find(
            (c) =>
              c.label.toLowerCase().includes('back') ||
              c.label.toLowerCase().includes('rear') ||
              c.label.toLowerCase().includes('خلف') ||
              c.label.toLowerCase().includes('environment')
          );
          const initialId = backCam ? backCam.id : formatted[0].id;
          setSelectedCameraId(initialId);
          startCamera(initialId);
        } else {
          startCamera();
        }
      })
      .catch((err) => {
        console.warn('getCameras error, fallback to facingMode:', err);
        if (isMounted) {
          startCamera();
        }
      });

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen]);

  // Extract serial numbers and clean candidate tokens from raw OCR text
  const extractSerialCandidates = (rawText: string): string[] => {
    const candidates: string[] = [];
    const lines = rawText.split('\n');

    // 1. Explicit Serial markers: "S/N: 12345", "SN 12345", "SERIAL NO. 12345", "REF: 123"
    const explicitRegex = /(?:S\/?N|SN|SERIAL(?:\s*NO)?|SER|REF|CODE|ID|MODEL|LOT)[:\s#]*([A-Za-z0-9\-_/.]{3,30})/gi;
    let match;
    while ((match = explicitRegex.exec(rawText)) !== null) {
      if (match[1]) {
        const cleaned = match[1].replace(/^[^\w]+|[^\w]+$/g, '').trim();
        if (cleaned.length >= 3) {
          candidates.push(cleaned);
        }
      }
    }

    // 2. Pure Numeric sequences (at least 4 digits, e.g. 20240912, 881920)
    const numericMatches = rawText.match(/\b\d{4,20}\b/g);
    if (numericMatches) {
      numericMatches.forEach((m) => candidates.push(m.trim()));
    }

    // 3. Alphanumeric codes with numbers and letters (e.g. OB-01, MED-4910, SN9012, 12K-990)
    const words = rawText.split(/[\s,;|\t]+/);
    const ignoreList = new Set([
      'MODEL', 'MADE', 'CHINA', 'GERMANY', 'JAPAN', 'USA', 'VOLT', 'WATT', 'HERTZ', 'INPUT', 'OUTPUT',
      'POWER', 'TYPE', 'CLASS', 'DATE', 'CE', 'IPX', 'FREQ', 'MAX', 'MIN', 'SN', 'SERIAL', 'REF',
    ]);

    for (const word of words) {
      const cleaned = word.replace(/^[^\w]+|[^\w]+$/g, '').trim();
      if (cleaned.length >= 4 && cleaned.length <= 25) {
        if (!ignoreList.has(cleaned.toUpperCase())) {
          // Has at least one number and letters/hyphens
          if (/\d/.test(cleaned) || /[A-Za-z]/.test(cleaned)) {
            candidates.push(cleaned);
          }
        }
      }
    }

    // Deduplicate and filter out obvious noise
    const unique = Array.from(new Set(candidates)).filter(
      (c) => c.length >= 3 && !/^[.\-_]+$/.test(c)
    );

    return unique.slice(0, 8); // Top 8 candidate matches
  };

  // Run OCR on an image (Canvas or Image URL)
  const runOcrOnImage = async (imageSource: string | HTMLCanvasElement) => {
    setIsOcrProcessing(true);
    setOcrStatus('جاري مسح ومعالجة الصورة واستخراج الأرقام...');
    setOcrCandidates([]);

    try {
      const result = await Tesseract.recognize(imageSource, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const pct = Math.round((m.progress || 0) * 100);
            setOcrStatus(`جاري قراءة الأرقام والنصوص (${pct}%)...`);
          }
        },
      });

      const text = result?.data?.text || '';
      const extracted = extractSerialCandidates(text);

      if (extracted.length > 0) {
        playBeep();
        setOcrCandidates(extracted);
        setOcrStatus(`تم رصد ${extracted.length} رقم / كود مرشح! اضغط على الرقم المطلوب للبحث به:`);
      } else {
        setOcrStatus('لم يتم رصد أرقام واضحة. يرجى توجيه الكاميرا عن قرب وتثبيت اليد أو تشغيل الفلاش.');
      }
    } catch (err: any) {
      console.error('OCR recognition error:', err);
      setOcrStatus(`حدث خطأ أثناء قراءة الصورة: ${err?.message || 'يرجى المحاولة مجدداً'}`);
    } finally {
      setIsOcrProcessing(false);
    }
  };

  // Capture frame from active video and run OCR
  const captureVideoFrameAndRunOcr = async () => {
    try {
      const video = document.querySelector(`#${scannerContainerId} video`) as HTMLVideoElement;
      if (!video || video.videoWidth === 0) {
        setOcrStatus('تعذر التقاط الكاميرا. يرجى التأكد من تشغيل الكاميرا أولاً.');
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Save preview thumbnail
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setOcrImagePreview(dataUrl);

      await runOcrOnImage(canvas);
    } catch (err: any) {
      console.error('Snapshot capture error:', err);
      setOcrStatus('تعذر التقاط صورة الكاميرا.');
    }
  };

  // Handle image selected from gallery / device storage
  const handleGalleryFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setOcrImagePreview(dataUrl);
        await runOcrOnImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Select a candidate number
  const handleSelectCandidate = (code: string) => {
    playBeep();
    setLastScanned(code);
    onScan(code);
    if (!continuous) {
      handleClose();
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    playBeep();
    onScan(manualInput.trim());
    setManualInput('');
    if (!continuous) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 text-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-800 space-y-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">{title}</h3>
              <p className="text-[11px] text-slate-400">
                قراءة الباركود، QR Code، أو قراءة أرقام السيريال المطبوعة بالكاميرا (OCR)
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-800/80 rounded-2xl border border-slate-700/70 text-xs font-bold">
          <button
            type="button"
            onClick={() => setScanMode('barcode')}
            className={`flex items-center justify-center gap-2 py-2 rounded-xl transition-all cursor-pointer ${
              scanMode === 'barcode'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ScanLine className="w-4 h-4" />
            <span>مسح الباركود / QR</span>
          </button>

          <button
            type="button"
            onClick={() => setScanMode('ocr')}
            className={`flex items-center justify-center gap-2 py-2 rounded-xl transition-all cursor-pointer ${
              scanMode === 'ocr'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-300" />
            <span>قراءة أرقام السيريال (OCR)</span>
          </button>
        </div>

        {/* Camera Viewport Container */}
        <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-slate-700 min-h-[260px] flex items-center justify-center">
          <div id={scannerContainerId} className="w-full h-full" />

          {/* Laser Scanner Visual Overlay (Barcode Mode) */}
          {isScanning && !error && scanMode === 'barcode' && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-64 h-44 border-2 border-emerald-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                {/* Corner Accents */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-400" />

                {/* Animated Scan Line */}
                <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_10px_#10b981] animate-pulse absolute top-1/2 -translate-y-1/2" />
              </div>
              <span className="text-[11px] font-bold text-emerald-300 bg-slate-950/80 px-3 py-1 rounded-full mt-3 border border-emerald-500/30">
                جارِ قراءة الباركود تلقائياً...
              </span>
            </div>
          )}

          {/* Targeted Frame Overlay (OCR Mode) */}
          {isScanning && !error && scanMode === 'ocr' && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-72 h-36 border-2 border-dashed border-amber-400/90 rounded-2xl relative shadow-[0_0_25px_rgba(251,191,36,0.3)] bg-amber-400/5">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-amber-200 text-[10px] font-bold">
                  ضع ملصق السيريال المطبوع هنا
                </div>
              </div>
              <span className="text-[11px] font-bold text-amber-300 bg-slate-950/85 px-3 py-1 rounded-full mt-3 border border-amber-500/40">
                اضغط على زر (التقاط وقراءة السيريال) بالأسفل
              </span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-4 text-center space-y-3 bg-red-950/90 border border-red-800 rounded-xl m-4 z-10">
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
              <p className="text-xs text-red-200 font-medium leading-relaxed">{error}</p>
              <button
                onClick={() => startCamera(selectedCameraId)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                إعادة المحاولة
              </button>
            </div>
          )}
        </div>

        {/* OCR Action Trigger Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={captureVideoFrameAndRunOcr}
            disabled={isOcrProcessing || !isScanning}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isOcrProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جاري استخراج السيريال...</span>
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                <span>التقاط وقراءة السيريال بالكاميرا (OCR)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => galleryFileInputRef.current?.click()}
            disabled={isOcrProcessing}
            title="قراءة ملصق السيريال من صورة في جهازك"
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ImageIcon className="w-4 h-4 text-blue-400" />
            <span>صورة ملصق</span>
          </button>
          <input
            ref={galleryFileInputRef}
            type="file"
            accept="image/*"
            onChange={handleGalleryFileSelect}
            className="hidden"
          />
        </div>

        {/* OCR Status & Candidates Display */}
        {(ocrStatus || ocrCandidates.length > 0) && (
          <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700 space-y-2.5 text-xs animate-fadeIn">
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span className="font-semibold">{ocrStatus}</span>
              {ocrImagePreview && (
                <span className="text-[10px] text-amber-400 font-mono">تم تحليل اللقطة</span>
              )}
            </div>

            {ocrCandidates.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-slate-700/80">
                <span className="text-[10px] text-slate-400 block">انقر على الرقم المطلوب للبحث فوراً:</span>
                <div className="flex flex-wrap gap-2">
                  {ocrCandidates.map((code, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectCandidate(code)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{code}</span>
                      <ArrowRight className="w-3 h-3 text-emerald-400 rotate-180" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Camera Quick Controls */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {cameras.length > 1 && (
              <button
                type="button"
                onClick={switchCamera}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors font-medium text-[11px] cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                تبديل الكاميرا ({cameras.length})
              </button>
            )}

            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-colors font-medium text-[11px] cursor-pointer ${
                  torchOn
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                {torchOn ? <ZapOff className="w-3.5 h-3.5 text-amber-400" /> : <Zap className="w-3.5 h-3.5 text-slate-400" />}
                {torchOn ? 'إيقاف الفلاش' : 'تشغيل الفلاش'}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title={soundEnabled ? 'كتم صوت الصافرة' : 'تفعيل صوت الصافرة'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
          </button>
        </div>

        {/* Last Scanned Feedback Banner */}
        {lastScanned && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>آخر كود تم مسحه: <strong className="font-mono text-white">{lastScanned}</strong></span>
            </div>
            <span className="text-[10px] text-emerald-400/80">تم الرصد بنجاح</span>
          </div>
        )}

        {/* Fallback: Quick Manual Input Inside Modal */}
        <form onSubmit={handleManualSubmit} className="pt-2 border-t border-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="أو اكتب الكود / السيريال يدوياً هنا..."
            className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={!manualInput.trim()}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
          >
            إدخال ⏎
          </button>
        </form>
      </div>
    </div>
  );
};
