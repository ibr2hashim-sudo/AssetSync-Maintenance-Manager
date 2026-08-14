import React, { useState } from 'react';
import {
  Users as UsersIcon,
  Plus,
  Shield,
  Wrench,
  Building2,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  X,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import { User, UserRole, Asset } from '../types';
import { StorageService } from '../services/storage';

interface UserManagementViewProps {
  currentUser: User | null;
  users: User[];
  assets: Asset[];
  onRefresh: () => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  currentUser,
  users,
  assets,
  onRefresh,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);

  // Departments list to assign to supervisors
  const departmentsList = Array.from(
    new Set(assets.map((a) => a.mainDepartment).filter(Boolean))
  );

  const activeCount = users.filter((u) => u.isActive !== false).length;

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            أدمن (صلاحية كاملة)
          </span>
        );
      case 'technician':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
            <Wrench className="w-3.5 h-3.5" />
            فني صيانة
          </span>
        );
      case 'supervisor':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" />
            مشرف قسم
          </span>
        );
    }
  };

  const handleDeleteUser = () => {
    if (!deleteConfirmUser) return;
    try {
      StorageService.deleteUser(deleteConfirmUser.id);
      setDeleteConfirmUser(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'تعذر حذف المستخدم');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <UsersIcon className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              إدارة المستخدمين والصلاحيات 👥
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            التحكم في حسابات الأدمن، الفنيين، ومشرفي الأقسام وتخصيص الأقسام والصلاحيات بدقة.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingUser(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all hover:scale-105"
        >
          <Plus className="w-4 h-4" />
          إضافة مستخدم جديد
        </button>
      </div>

      {/* Role Explanations Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-1.5">
          <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
            <Shield className="w-4 h-4 text-blue-600" />
            الأدمن (Admin)
          </div>
          <p className="text-[11px] text-blue-800 leading-relaxed">
            صلاحية كاملة: إضافة وتعديل ومسح الأجهزة والأقسام، إدارة المستخدمين، استيراد وتصدير Excel، الاطلاع على الـ History وإعادة ضبط المصنع.
          </p>
          <div className="text-[10px] text-blue-600 font-mono pt-1">
            الحساب الافتراضي: admin / admin
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-1.5">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
            <Wrench className="w-4 h-4 text-amber-600" />
            فني الصيانة (Technician)
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            الاطلاع على جميع الأجهزة، استلام طلبات الصيانة وإدارتها، تسجيل التقارير الفنية وقطع الغيار، وإدارة ومتابعة الصيانة الدورية.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-1.5">
          <div className="flex items-center gap-2 text-purple-900 font-bold text-xs">
            <Building2 className="w-4 h-4 text-purple-600" />
            مشرف القسم (Supervisor)
          </div>
          <p className="text-[11px] text-purple-800 leading-relaxed">
            صلاحية مقتصرة على القسم المحدد فقط (لا يرى الأقسام الأخرى)، وإمكانية تقديم بلاغات صيانة لأجهزة قسمه حصرياً.
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">
            قائمة مستخدمي النظام ({activeCount} نشط)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs divide-y divide-slate-200">
            <thead className="bg-slate-50 text-slate-700 font-bold">
              <tr>
                <th className="p-3.5">الاسم والصفة</th>
                <th className="p-3.5">اسم المستخدم</th>
                <th className="p-3.5">الدور والصلاحية</th>
                <th className="p-3.5">القسم المعين</th>
                <th className="p-3.5">الحالة</th>
                <th className="p-3.5 text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3.5 font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                        {u.fullName.charAt(0)}
                      </div>
                      <span>{u.fullName}</span>
                      {u.id === currentUser?.id && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-normal">
                          أنت
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3.5 font-mono text-slate-700 font-semibold">{u.username}</td>
                  <td className="p-3.5">{getRoleBadge(u.role)}</td>
                  <td className="p-3.5">
                    {u.role === 'supervisor' ? (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">
                        {u.assignedDepartment || 'غير محدد'}
                      </span>
                    ) : (
                      <span className="text-slate-400">كافة الأقسام</span>
                    )}
                  </td>
                  <td className="p-3.5">
                    {u.isActive !== false ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        نشط
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <XCircle className="w-3.5 h-3.5" />
                        معطل
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-left">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setEditingUser(u);
                          setShowAddModal(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="تعديل المستخدم"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {u.username !== 'admin' && (
                        <button
                          onClick={() => setDeleteConfirmUser(u)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="حذف المستخدم"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT USER */}
      {/* ========================================================================= */}
      {showAddModal && (
        <AddEditUserModal
          user={editingUser}
          departmentsList={departmentsList}
          onClose={() => {
            setShowAddModal(false);
            setEditingUser(null);
          }}
          onSaved={() => {
            setShowAddModal(false);
            setEditingUser(null);
            onRefresh();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRM DELETE USER */}
      {/* ========================================================================= */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">تأكيد حذف المستخدم</h3>
              <p className="text-xs text-slate-500 mt-1">
                هل أنت متأكد من حذف الحساب (
                <span className="font-bold text-slate-800">{deleteConfirmUser.fullName}</span> -{' '}
                <span className="font-mono text-slate-800">{deleteConfirmUser.username}</span>)؟
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                onClick={handleDeleteUser}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================================
// SUB-COMPONENT: ADD / EDIT USER MODAL
// =========================================================================
interface AddEditUserModalProps {
  user: User | null;
  departmentsList: string[];
  onClose: () => void;
  onSaved: () => void;
}

const AddEditUserModal: React.FC<AddEditUserModalProps> = ({
  user,
  departmentsList,
  onClose,
  onSaved,
}) => {
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [password, setPassword] = useState(user?.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>(user?.role || 'technician');
  const [assignedDepartment, setAssignedDepartment] = useState(user?.assignedDepartment || '');
  const [customDeptInput, setCustomDeptInput] = useState('');
  const [isActive, setIsActive] = useState(user?.isActive !== false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !fullName.trim()) {
      setErrorMsg('اسم المستخدم والاسم الكامل مطلوبان');
      return;
    }

    if (!user && !password.trim()) {
      setErrorMsg('كلمة المرور مطلوبة للمستخدم الجديد');
      return;
    }

    const finalDept = customDeptInput.trim() || assignedDepartment.trim();

    if (role === 'supervisor' && !finalDept) {
      setErrorMsg('يجب تعيين قسم محدد لمشرف القسم');
      return;
    }

    try {
      StorageService.saveUser({
        id: user?.id,
        fullName: fullName.trim(),
        username: username.trim(),
        password: password.trim() || user?.password || '123456',
        role,
        assignedDepartment: role === 'supervisor' ? finalDept : undefined,
        isActive,
      });

      onSaved();
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ المستخدم');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-right">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-indigo-600" />
            {user ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد للنظام'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              الاسم الكامل / المسمى الوظيفي: <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="مثال: م. أحمد عبد الله"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              اسم المستخدم (Username): <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="مثال: ahmed_tech"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Password field with show/hide icon */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              كلمة المرور: {user && <span className="text-slate-400 font-normal">(اتركها كما هي إذا لم ترغب في التغيير)</span>}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={user ? '••••••••' : 'أدخل كلمة المرور'}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              صلاحية ودور المستخدم: <span className="text-red-500">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold"
            >
              <option value="admin">الأدمن (Admin) - صلاحية كاملة وإدارة النظام</option>
              <option value="technician">فني صيانة (Technician) - استلام وإدارة البلاغات والدورية</option>
              <option value="supervisor">مشرف قسم (Department Supervisor) - قسم محدد فقط</option>
            </select>
          </div>

          {/* If Role is Supervisor: Assign Department */}
          {role === 'supervisor' && (
            <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
              <label className="block font-bold text-purple-900 text-xs">
                تعيين القسم الخاص بالمشرف: <span className="text-red-500">*</span>
              </label>

              {departmentsList.length > 0 && (
                <select
                  value={assignedDepartment}
                  onChange={(e) => {
                    setAssignedDepartment(e.target.value);
                    setCustomDeptInput('');
                  }}
                  className="w-full p-2 rounded-lg border border-purple-300 text-xs font-semibold bg-white"
                >
                  <option value="">— اختر من الأقسام المسجلة —</option>
                  {departmentsList.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              )}

              <div>
                <span className="text-[11px] text-purple-700 block mb-1">أو اكتب اسم قسم جديد:</span>
                <input
                  type="text"
                  value={customDeptInput}
                  onChange={(e) => {
                    setCustomDeptInput(e.target.value);
                    setAssignedDepartment('');
                  }}
                  placeholder="مثال: قسم العناية المركزة (ICU)"
                  className="w-full p-2 rounded-lg border border-purple-300 text-xs bg-white"
                />
              </div>
            </div>
          )}

          {/* Status Checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="user-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded"
            />
            <label htmlFor="user-active" className="font-semibold text-slate-700">
              حساب نشط (يمكنه تسجيل الدخول واستخدام النظام)
            </label>
          </div>

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
              className="px-5 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20"
            >
              {user ? 'حفظ التعديلات' : 'إضافة المستخدم'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
