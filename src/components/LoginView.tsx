import React, { useState } from 'react';
import {
  Package,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  LogIn,
  Shield,
  AlertCircle,
  Cloud,
} from 'lucide-react';
import { User } from '../types';
import { StorageService } from '../services/storage';

interface LoginViewProps {
  users?: User[];
  onLogin: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      if (!username.trim()) {
        throw new Error('يرجى إدخال اسم المستخدم');
      }
      if (!password) {
        throw new Error('يرجى إدخال كلمة المرور');
      }

      const loggedInUser = StorageService.login(username, password);
      setIsLoading(false);
      onLogin(loggedInUser);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err?.message || 'فشل تسجيل الدخول، تأكد من صحة البيانات');
    }
  };

  return (
    <div
      id="login-view-container"
      className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 font-['Tajawal',sans-serif] text-right relative overflow-hidden select-none"
      dir="rtl"
    >
      {/* Background Decorative Ambient Gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-slate-900/50 rounded-full blur-2xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/25 ring-4 ring-blue-500/10">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">
              نظام إدارة الأصول والصيانة
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              منظومة تتبع العهد وبلاغات الأعطال والصيانة الوقائية
            </p>
          </div>
        </div>

        {/* Error Alert Box */}
        {errorMessage && (
          <div
            id="login-error-alert"
            className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2.5 animate-shake"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-300">اسم المستخدم</label>
            <div className="relative">
              <input
                id="login-username-input"
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم (مثال: admin)"
                className="w-full pl-3 pr-10 py-3 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder:text-slate-500 font-medium text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-right"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <UserIcon className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-slate-300">كلمة المرور</label>
            </div>
            <div className="relative">
              <input
                id="login-password-input"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder:text-slate-500 font-mono text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-right"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Lock className="w-4 h-4" />
              </div>
              <button
                type="button"
                id="login-toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            id="login-submit-button"
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span className="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            <span>تسجيل الدخول للنظام</span>
          </button>
        </form>

        {/* Footer Security Badges */}
        <div className="pt-2 flex items-center justify-center gap-4 text-[10px] text-slate-500 border-t border-slate-800/80">
          <div className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-blue-500" />
            <span>نظام مشفر وآمن</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Cloud className="w-3.5 h-3.5 text-emerald-500" />
            <span>مزامنة سحابية حية</span>
          </div>
        </div>
      </div>
    </div>
  );
};
