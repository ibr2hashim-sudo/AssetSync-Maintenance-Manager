import React, { useState, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Calendar,
  Layers,
  ChevronLeft,
  Wrench,
  Gauge,
  BatteryCharging,
  Wind,
  CheckCircle2,
  X,
  Clock,
  Sliders,
} from 'lucide-react';
import { Asset, PeriodicCategory, PeriodicMaintenanceRecord, User } from '../types';
import { StorageService } from '../services/storage';

interface PeriodicMaintenanceViewProps {
  currentUser: User | null;
  assets?: Asset[];
  periodicRecords?: PeriodicMaintenanceRecord[];
  onRefresh: () => void;
}

export const PeriodicMaintenanceView: React.FC<PeriodicMaintenanceViewProps> = ({
  currentUser,
  assets = [],
  periodicRecords = [],
  onRefresh,
}) => {
  // Categories from storage
  const [categories, setCategories] = useState<string[]>(() => StorageService.getPeriodicCategories());
  const [newCatName, setNewCatName] = useState('');
  const [showAddCatModal, setShowAddCatModal] = useState(false);

  const safeAssets = useMemo(() => (Array.isArray(assets) ? assets : []), [assets]);
  const safeRecords = useMemo(() => (Array.isArray(periodicRecords) ? periodicRecords : []), [periodicRecords]);

  // Hierarchy navigation states:
  // Step 1: Category
  // Step 2: Department
  // Step 3: Device or General records
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  // Add Record Modal
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);

  // Departments with assets
  const departmentsList = useMemo(() => {
    return Array.from(new Set(safeAssets.map((a) => a.mainDepartment).filter(Boolean)));
  }, [safeAssets]);

  // Filtered records based on active hierarchy
  const filteredRecords = useMemo(() => {
    let list = safeRecords;

    if (selectedCategory) {
      list = list.filter((r) => r.category === selectedCategory);
    }

    if (selectedDept) {
      list = list.filter((r) => r.mainDepartment === selectedDept);
    }

    if (selectedAsset) {
      list = list.filter((r) => r.customId === selectedAsset.customId || r.assetId === selectedAsset.id);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          r.category.toLowerCase().includes(q) ||
          r.mainDepartment.toLowerCase().includes(q) ||
          (r.deviceName && r.deviceName.toLowerCase().includes(q)) ||
          (r.customId && r.customId.toLowerCase().includes(q)) ||
          (r.workDone && r.workDone.toLowerCase().includes(q)) ||
          (r.performedBy && r.performedBy.toLowerCase().includes(q))
      );
    }

    return list;
  }, [safeRecords, selectedCategory, selectedDept, selectedAsset, searchTerm]);

  // Add new category
  const handleAddNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const updated = StorageService.addPeriodicCategory(newCatName.trim());
    setCategories(updated);
    setSelectedCategory(newCatName.trim());
    setNewCatName('');
    setShowAddCatModal(false);
  };

  const getCategoryIcon = (cat: string) => {
    if (cat.includes('تكييف') || cat.toLowerCase().includes('ac')) {
      return <Wind className="w-5 h-5 text-sky-500" />;
    }
    if (cat.includes('زيوت') || cat.includes('فلتر') || cat.toLowerCase().includes('oil')) {
      return <Gauge className="w-5 h-5 text-amber-500" />;
    }
    if (cat.includes('بطار') || cat.toLowerCase().includes('batt')) {
      return <BatteryCharging className="w-5 h-5 text-emerald-500" />;
    }
    return <Building2 className="w-5 h-5 text-indigo-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              متابعة الصيانة الدورية والوقائية 🛠️
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            سجلات الصيانة الوقائية للتكييف، الزيوت والفلاتر، البطاريات وتغييراتها مع تصفح هرمي ذكي.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => setShowAddCatModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              <Plus className="w-4 h-4" />
              إضافة تصنيف صيانة
            </button>
          )}

          <button
            onClick={() => setShowAddRecordModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            تسجيل صيانة دورية جديدة
          </button>
        </div>
      </div>

      {/* Breadcrumb Hierarchy Navigation Bar */}
      <div className="bg-slate-100/80 p-3 rounded-xl border border-slate-200/60 flex items-center justify-between gap-2 overflow-x-auto text-xs">
        <div className="flex items-center gap-1.5 font-medium whitespace-nowrap">
          <button
            onClick={() => {
              setSelectedCategory(null);
              setSelectedDept(null);
              setSelectedAsset(null);
            }}
            className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
              !selectedCategory
                ? 'bg-white text-amber-700 font-bold shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            تصنيفات الصيانة
          </button>

          {selectedCategory && (
            <>
              <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
              <button
                onClick={() => {
                  setSelectedDept(null);
                  setSelectedAsset(null);
                }}
                className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                  selectedCategory && !selectedDept
                    ? 'bg-white text-amber-700 font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {selectedCategory}
              </button>
            </>
          )}

          {selectedDept && (
            <>
              <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
              <button
                onClick={() => setSelectedAsset(null)}
                className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                  selectedDept && !selectedAsset
                    ? 'bg-white text-amber-700 font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                {selectedDept}
              </button>
            </>
          )}

          {selectedAsset && (
            <>
              <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
              <span className="px-2.5 py-1 rounded-lg bg-white text-amber-700 font-bold shadow-sm">
                {selectedAsset.deviceName} ({selectedAsset.customId})
              </span>
            </>
          )}
        </div>

        <div className="text-[11px] text-slate-500 hidden sm:block">
          التصفح: (نوع الصيانة ➔ القسم ➔ الجهاز ➔ السجل)
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: CATEGORY SELECTION CARDS */}
      {/* ========================================================================= */}
      {!selectedCategory && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-800">اختر تصنيف الصيانة الوقائية:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const catRecords = periodicRecords.filter((r) => r.category === cat);
              return (
                <div
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      {getCategoryIcon(cat)}
                    </div>
                    <h4 className="text-base font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                      {cat}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {cat === 'التكييف'
                        ? 'توثيق صيانة وحدات التكييف المركزية والمنفصلة وفلاتر الهواء.'
                        : cat === 'الزيوت والفلاتر'
                        ? 'تتبع قراءات العدادات الحالية وتاريخ وقراءة التغيير القادم.'
                        : cat === 'البطاريات'
                        ? 'سجل تغيير بطاريات الأجهزة الطبية ومواعيد الاستبدال الوقائي.'
                        : 'سجل الصيانة الدورية المخصص لهذا التصنيف.'}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-bold">
                    <span>{catRecords.length} سجل صيانة</span>
                    <ChevronLeft className="w-4 h-4 text-amber-600" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: DEPARTMENT SELECTION (When category is selected) */}
      {/* ========================================================================= */}
      {selectedCategory && !selectedDept && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              اختر القسم لمتابعة صيانة ({selectedCategory}):
            </h3>
            <button
              onClick={() => setSelectedDept('all_depts')}
              className="text-xs font-bold text-amber-600 hover:underline"
            >
              عرض سجلات كافة الأقسام
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {departmentsList.map((dept) => {
              const deptRecords = periodicRecords.filter(
                (r) => r.category === selectedCategory && r.mainDepartment === dept
              );
              const deptAssets = assets.filter((a) => a.mainDepartment === dept);

              return (
                <div
                  key={dept}
                  onClick={() => setSelectedDept(dept)}
                  className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <h4 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {dept}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {deptAssets.length} جهاز مسجل في هذا القسم
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-bold">
                    <span>{deptRecords.length} عملية صيانة مسجلة</span>
                    <ChevronLeft className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3 & 4: DEVICE SELECT & RECORDS LOG TABLE */}
      {/* ========================================================================= */}
      {selectedCategory && selectedDept && (
        <div className="space-y-4">
          {/* Top Search & Filter within records */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث في سجلات الصيانة..."
                className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-none"
              />
            </div>

            <button
              onClick={() => setShowAddRecordModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              إضافة عملية صيانة جديدة
            </button>
          </div>

          {/* Records Table */}
          {filteredRecords.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200/80 shadow-sm text-slate-400 text-xs">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              لا توجد سجلات صيانة مسجلة لهذا القسم / التصنيف حتى الآن
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-slate-700 font-bold">
                    <tr>
                      <th className="p-3.5">التاريخ</th>
                      <th className="p-3.5">القسم</th>
                      <th className="p-3.5">الجهاز / ID</th>
                      <th className="p-3.5">تفاصيل الصيانة والإجراءات</th>
                      <th className="p-3.5">المنفذ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5 whitespace-nowrap font-mono font-semibold text-slate-800">
                          {rec.maintenanceDate}
                        </td>
                        <td className="p-3.5 whitespace-nowrap font-semibold text-slate-800">
                          {rec.mainDepartment}
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          {rec.deviceName ? (
                            <div>
                              <span className="font-bold text-slate-900 block">{rec.deviceName}</span>
                              <span className="text-[10px] font-mono text-blue-600 font-bold">
                                ID: {rec.customId}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">صيانة عامة بالقسم</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          {/* Details based on category */}
                          {rec.category === 'التكييف' && (
                            <p className="text-slate-800 leading-relaxed">{rec.workDone || rec.notes}</p>
                          )}

                          {rec.category === 'الزيوت والفلاتر' && (
                            <div className="space-y-1">
                              <p className="text-slate-800">{rec.workDone || 'تغيير الزيوت والفلاتر'}</p>
                              <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                                <span>العداد الحالي: <strong>{rec.currentMeterReading ?? '—'}</strong></span>
                                <span>•</span>
                                <span>العداد القادم: <strong className="text-amber-700">{rec.nextMeterReading ?? '—'}</strong></span>
                              </div>
                            </div>
                          )}

                          {rec.category === 'البطاريات' && (
                            <div className="space-y-1">
                              <p className="text-slate-800">{rec.workDone || 'استبدال وتركيب بطارية جديدة'}</p>
                              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                                <span>تاريخ التغيير: <strong>{rec.batteryChangeDate || rec.maintenanceDate}</strong></span>
                                {rec.nextExpectedChangeDate && (
                                  <>
                                    <span>•</span>
                                    <span>التغيير المتوقع: <strong className="text-emerald-700">{rec.nextExpectedChangeDate}</strong></span>
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {!['التكييف', 'الزيوت والفلاتر', 'البطاريات'].includes(rec.category) && (
                            <p className="text-slate-800">{rec.workDone || rec.notes}</p>
                          )}
                        </td>
                        <td className="p-3.5 whitespace-nowrap text-slate-600 font-medium">
                          {rec.performedBy}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD PERIODIC MAINTENANCE RECORD */}
      {/* ========================================================================= */}
      {showAddRecordModal && (
        <AddPeriodicRecordModal
          categories={categories}
          assets={assets}
          initialCategory={selectedCategory || categories[0]}
          initialDepartment={selectedDept !== 'all_depts' ? selectedDept || '' : ''}
          currentUser={currentUser}
          onClose={() => setShowAddRecordModal(false)}
          onSaved={() => {
            setShowAddRecordModal(false);
            onRefresh();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD CUSTOM CATEGORY */}
      {/* ========================================================================= */}
      {showAddCatModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-right">
            <h3 className="text-base font-bold text-slate-900">إضافة تصنيف صيانة وقائية جديد</h3>
            <form onSubmit={handleAddNewCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم التصنيف:</label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="مثال: المعايرة والضبط، المولدات الكهربائية، المصاعد..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCatModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow"
                >
                  إضافة التصنيف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================================
// SUB-COMPONENT: ADD RECORD MODAL
// =========================================================================
interface AddPeriodicRecordModalProps {
  categories: string[];
  assets: Asset[];
  initialCategory: string;
  initialDepartment: string;
  currentUser: User | null;
  onClose: () => void;
  onSaved: () => void;
}

const AddPeriodicRecordModal: React.FC<AddPeriodicRecordModalProps> = ({
  categories,
  assets,
  initialCategory,
  initialDepartment,
  currentUser,
  onClose,
  onSaved,
}) => {
  const [category, setCategory] = useState(initialCategory || categories[0]);
  const [department, setDepartment] = useState(initialDepartment || (assets[0]?.mainDepartment || ''));
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [maintenanceDate, setMaintenanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [workDone, setWorkDone] = useState('');
  const [currentMeter, setCurrentMeter] = useState<number | ''>('');
  const [nextMeter, setNextMeter] = useState<number | ''>('');
  const [intervalKm, setIntervalKm] = useState<number | ''>(5000);
  const [batteryChangeDate, setBatteryChangeDate] = useState(new Date().toISOString().split('T')[0]);
  const [nextBatteryDate, setNextBatteryDate] = useState('');
  const [performedBy, setPerformedBy] = useState(currentUser?.fullName || 'فني الصيانة');

  const deptAssets = useMemo(() => {
    if (!department) return assets;
    return assets.filter((a) => a.mainDepartment.trim() === department.trim());
  }, [assets, department]);

  const selectedAsset = useMemo(() => {
    return assets.find((a) => a.id === selectedAssetId) || null;
  }, [assets, selectedAssetId]);

  // Auto calculate next meter reading
  const handleCurrentMeterChange = (val: number) => {
    setCurrentMeter(val);
    if (intervalKm) {
      setNextMeter(val + Number(intervalKm));
    }
  };

  const handleIntervalChange = (val: number) => {
    setIntervalKm(val);
    if (currentMeter !== '') {
      setNextMeter(Number(currentMeter) + val);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!department.trim()) {
      alert('يرجى تحديد القسم');
      return;
    }

    StorageService.savePeriodicRecord({
      category,
      mainDepartment: department.trim(),
      subDepartment: selectedAsset?.subDepartment,
      assetId: selectedAsset?.id,
      customId: selectedAsset?.customId,
      deviceName: selectedAsset?.deviceName,
      model: selectedAsset?.model,
      serialNumber: selectedAsset?.serialNumber,
      maintenanceDate,
      workDone: workDone.trim(),
      currentMeterReading: currentMeter !== '' ? Number(currentMeter) : undefined,
      nextMeterReading: nextMeter !== '' ? Number(nextMeter) : undefined,
      intervalKmOrHours: intervalKm !== '' ? Number(intervalKm) : undefined,
      batteryChangeDate: category === 'البطاريات' ? batteryChangeDate : undefined,
      nextExpectedChangeDate: category === 'البطاريات' ? nextBatteryDate : undefined,
      performedBy: performedBy.trim(),
    });

    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-right">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-600" />
            تسجيل صيانة وقائية دورية
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">نوع الصيانة:</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">القسم:</label>
              <input
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="اسم القسم"
                className="w-full p-2.5 rounded-xl border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">الجهاز المرتبط (اختياري):</label>
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300"
            >
              <option value="">— صيانة عامة للموقع / بدون جهاز محدد —</option>
              {deptAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.deviceName} - ID: {a.customId} ({a.model})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">تاريخ الصيانة:</label>
              <input
                type="date"
                required
                value={maintenanceDate}
                onChange={(e) => setMaintenanceDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">الفني القائم بالعمل:</label>
              <input
                type="text"
                required
                value={performedBy}
                onChange={(e) => setPerformedBy(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300"
              />
            </div>
          </div>

          {/* Conditional Category Specific Fields */}
          {category === 'التكييف' && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">ما تم عمله بالتفصيل:</label>
              <textarea
                required
                rows={3}
                value={workDone}
                onChange={(e) => setWorkDone(e.target.value)}
                placeholder="تنظيف الفلاتر، فحص ضغط غاز الفريون، صيانة المروحة والضاغط..."
                className="w-full p-2.5 rounded-xl border border-slate-300"
              />
            </div>
          )}

          {category === 'الزيوت والفلاتر' && (
            <div className="space-y-3 p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">العداد الحالي:</label>
                  <input
                    type="number"
                    value={currentMeter}
                    onChange={(e) => handleCurrentMeterChange(Number(e.target.value))}
                    placeholder="مثال: 120000"
                    className="w-full p-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الفاصل الزمني:</label>
                  <input
                    type="number"
                    value={intervalKm}
                    onChange={(e) => handleIntervalChange(Number(e.target.value))}
                    placeholder="مثال: 5000"
                    className="w-full p-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">العداد القادم:</label>
                  <input
                    type="number"
                    value={nextMeter}
                    onChange={(e) => setNextMeter(Number(e.target.value))}
                    placeholder="تلقائي"
                    className="w-full p-2 rounded-lg border border-slate-300 font-bold bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">نوع الزيت والإجراءات:</label>
                <textarea
                  rows={2}
                  value={workDone}
                  onChange={(e) => setWorkDone(e.target.value)}
                  placeholder="تغيير زيت تخليقي 5W30 + فلتر زيت أصلي + فلتر هواء..."
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
            </div>
          )}

          {category === 'البطاريات' && (
            <div className="space-y-3 p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ تغيير البطارية:</label>
                  <input
                    type="date"
                    value={batteryChangeDate}
                    onChange={(e) => setBatteryChangeDate(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">التغيير القادم المتوقع:</label>
                  <input
                    type="date"
                    value={nextBatteryDate}
                    onChange={(e) => setNextBatteryDate(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">مواصفات البطارية والعمل المنفذ:</label>
                <textarea
                  rows={2}
                  value={workDone}
                  onChange={(e) => setWorkDone(e.target.value)}
                  placeholder="تركيب بطارية ليثيوم 12V 7.2Ah جديدة واختبار دورة الشحن والتفريغ..."
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>
            </div>
          )}

          {!['التكييف', 'الزيوت والفلاتر', 'البطاريات'].includes(category) && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">الإجراءات المنفذة:</label>
              <textarea
                required
                rows={3}
                value={workDone}
                onChange={(e) => setWorkDone(e.target.value)}
                placeholder="اكتب هنا تفاصيل الأعمال المنجزة..."
                className="w-full p-2.5 rounded-xl border border-slate-300"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow"
            >
              حفظ السجل
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
