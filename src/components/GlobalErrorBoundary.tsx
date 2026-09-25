'use client';

import React from 'react';
import { reportClientError } from '@/lib/client-api';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/** Catches client render errors below the locale shell without a white screen. */
export default class GlobalErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    reportClientError(error, `render:${info.componentStack?.split('\n')[1]?.trim() || 'unknown'}`);
  }

  private reset = () => this.setState({ hasError: false });

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;
    const isAr = typeof document !== 'undefined' && document.documentElement.lang === 'ar';
    return (
      <main role="alert" className="flex min-h-[60dvh] items-center justify-center p-6">
        <div className="glass-panel w-full max-w-md space-y-4 rounded-3xl border border-rose-500/30 p-8 text-center shadow-float">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-2xl">!</div>
          <h1 className="text-xl font-black text-slate-100">{isAr ? 'حدث خطأ ما' : 'Something went wrong'}</h1>
          <p className="text-xs leading-relaxed text-slate-400">{isAr ? 'تعذر عرض هذه الشاشة. يمكنك إعادة المحاولة دون فقدان بياناتك.' : 'This screen could not be rendered. You can retry without losing your data.'}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={this.reset} className="min-h-[44px] rounded-xl bg-blue-600 px-5 text-xs font-bold text-white hover:bg-blue-500">{isAr ? 'إعادة المحاولة' : 'Retry'}</button>
            <button type="button" onClick={() => window.location.reload()} className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-800 px-5 text-xs font-bold text-slate-200 hover:bg-slate-700">{isAr ? 'تحديث الصفحة' : 'Reload'}</button>
          </div>
        </div>
      </main>
    );
  }
}
