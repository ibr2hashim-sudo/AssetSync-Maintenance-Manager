import React, { useState } from 'react';
import { User as UserIcon, Shield, Wrench, Building2, Key, Eye, EyeOff, X, LogIn } from 'lucide-react';
import { User } from '../types';
import { StorageService } from '../services/storage';

interface SwitchUserModalProps {
  users: User[];
  currentUser: User | null;
  onClose: () => void;
  onUserSwitched: (user: User) => void;
}

export const SwitchUserModal: React.FC<SwitchUserModalProps> = ({
  users,
  currentUser,
  onClose,
  onUserSwitched,
}) => {
  const [selectedUserId, setSelectedUserId] = useState(currentUser?.id || users[0]?.id || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const targetUser = users.find((u) => u.id === selectedUserId);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!targetUser) return;

    // Check password
    if (targetUser.password && targetUser.password !== password) {
      setErrorMsg('كلمة المرور غير صحيحة');
      return;
    }

    StorageService.setCurrentUser(targetUser);
    onUserSwitched(targetUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-right">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <LogIn className="w-5 h-5 text-blue-600" />
            تبديل الحساب / تسجيل الدخول
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

        <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">اختر الحساب:</label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {users.map((u) => {
                const isSelected = u.id === selectedUserId;
                return (
                  <div
                    key={u.id}
                    onClick={() => {
                      setSelectedUserId(u.id);
                      setPassword('');
                      setErrorMsg('');
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                        {u.fullName.charAt(0)}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 block">{u.fullName}</span>
                        <span className="text-[11px] font-mono text-slate-500">@{u.username}</span>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border text-slate-700">
                        {u.role === 'admin'
                          ? 'أدمن'
                          : u.role === 'technician'
                          ? 'فني'
                          : `مشرف (${u.assignedDepartment || 'قسم'})`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">كلمة المرور:</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الخاصة بالحساب"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {targetUser?.username === 'admin' && (
              <span className="text-[10px] text-slate-400 block mt-1">
                (كلمة المرور الافتراضية لحساب الأدمن: admin)
              </span>
            )}
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
              className="px-5 py-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20"
            >
              تسجيل الدخول
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
