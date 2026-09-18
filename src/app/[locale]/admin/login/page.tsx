'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from '@/i18n/routing';
import { Lock, Mail, ShieldCheck } from 'lucide-react';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('admin@sportschampions.eg');
  const [password, setPassword] = useState('Admin@123456');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
    });

    if (result?.error) {
      setErrorMsg('كلمة السر أو البريد الإلكتروني غير صحيح.');
      setLoading(false);
    } else {
      router.push('/admin');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full glass-panel p-8 rounded-3xl border border-slate-800 space-y-6 dir-rtl">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-blue-600 flex items-center justify-center font-black text-white text-2xl mx-auto shadow-lg shadow-blue-500/20">
            أ
          </div>
          <h1 className="text-2xl font-black text-slate-100">تسجيل دخول الموظفين والمديرين</h1>
          <p className="text-xs text-slate-400">منظومة الإدارة ERP - ابطال الرياضة الإبراهيمية</p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-300 mb-1">البريد الإلكتروني للموظف</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@sportschampions.eg"
                className="w-full p-3 pl-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-blue-500 font-semibold"
              />
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-300 mb-1">كلمة السر</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 pl-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-blue-500 font-semibold"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-extrabold text-xs shadow-lg shadow-blue-600/25 transition-all"
          >
            {loading ? 'جاري الدخول...' : 'تسجيل الدخول للنظام'}
          </button>
        </form>

        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <div className="font-bold text-slate-200">حسابات تجريبية للاختبار:</div>
          <div>• المدير العام: admin@sportschampions.eg / Admin@123456</div>
          <div>• مدير الفرع: manager.ibrahimeyah@sportschampions.eg / Manager@123456</div>
          <div>• الكاشير: cashier.ibrahimeyah@sportschampions.eg / Cashier@123456</div>
          <div>• الحسابات: finance@sportschampions.eg / Finance@123456</div>
        </div>
      </div>
    </div>
  );
}
