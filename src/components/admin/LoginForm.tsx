'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Lock, Mail } from 'lucide-react';
import Image from 'next/image';

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        setErrorMsg(t('invalidCredentials'));
        setLoading(false);
      } else {
        // Normalize target: remove host and strip any leading locale prefix so next-intl router doesn't duplicate
        let target = (callbackUrl || '/admin').replace(/^https?:\/\/[^\/]+/, '');
        target = target.replace(/^\/(?:ar|en)(?=\/|$)+/g, '') || '/admin';
        if (!target.startsWith('/')) target = `/${target}`;
        router.push(target);
        router.refresh();
      }
    } catch {
      setErrorMsg(t('connectionError'));
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full glass-panel p-8 rounded-3xl border border-slate-800 space-y-6 animate-fade-up">
      <div className="text-center space-y-2">
        <Image
          src="/logo.avif"
          alt="أبطال الرياضة الإبراهيمية"
          width={960}
          height={822}
          priority
          quality={85}
          sizes="64px"
          className="h-16 w-auto rounded-xl object-contain mx-auto drop-shadow-[0_0_16px_rgba(245,166,35,0.35)]"
        />
        <h1 className="text-2xl font-black text-slate-100">{t('title')}</h1>
        <p className="text-xs text-slate-400">{t('subtitle')}</p>
      </div>

      {errorMsg && (
        <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center animate-fade-in">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4 text-xs">
        <div>
          <label htmlFor="login-email" className="block font-bold text-slate-300 mb-1">{t('emailLabel')}</label>
          <div className="relative">
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@sportschampions.eg"
              autoComplete="email"
              className="w-full p-3 pl-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-blue-500 font-semibold placeholder:text-slate-500"
            />
            <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
          </div>
        </div>

        <div>
          <label htmlFor="login-password" className="block font-bold text-slate-300 mb-1">{t('passwordLabel')}</label>
          <div className="relative">
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full p-3 pl-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-blue-500 font-semibold placeholder:text-slate-500"
            />
            <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-60 text-white font-extrabold text-xs shadow-lg shadow-blue-600/25 transition-all"
        >
          {loading ? t('loading') : t('submit')}
        </button>
      </form>
    </div>
  );
}
