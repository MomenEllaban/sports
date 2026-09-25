'use client';

import { useCallback, useEffect } from 'react';
import { usePathname, useRouter } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import { useToast } from '@/components/Toast';
import { AUTH_REQUIRED_EVENT, ClientApiError, FORBIDDEN_EVENT, FETCH_ERROR_EVENT } from '@/lib/client-api';

type ErrorEventDetail = {
  error?: ClientApiError;
  path?: string;
  retry?: () => Promise<unknown>;
};

export default function ErrorEventHandler() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const isAr = useLocale() === 'ar';
  const L = useCallback((ar: string, en: string) => (isAr ? ar : en), [isAr]);
  const { toast } = useToast();

  useEffect(() => {
    const onAuthRequired = (event: Event) => {
      const detail = (event as CustomEvent<ErrorEventDetail>).detail;
      if (pathname.startsWith('/admin')) {
        if (!pathname.startsWith('/admin/login')) router.push('/admin/login');
        return;
      }
      toast(L('انتهت الجلسة أو لم يتم تسجيل الدخول. سجّل الدخول ثم حاول مجددًا.', 'Your session expired or you are not signed in. Sign in and try again.'), 'info');
      void detail;
    };
    const onForbidden = (event: Event) => {
      const detail = (event as CustomEvent<ErrorEventDetail>).detail;
      toast(detail?.error?.message || L('لا تملك صلاحية لتنفيذ هذا الإجراء.', 'You do not have permission to perform this action.'), 'error');
    };
    const onFetchError = (event: Event) => {
      const detail = (event as CustomEvent<ErrorEventDetail>).detail;
      const message = detail?.error?.message || L('حدث خطأ، حاول مرة أخرى.', 'Something went wrong. Please try again.');
      toast(message, 'error', detail?.retry ? { actionLabel: L('إعادة المحاولة', 'Retry'), onAction: () => { void detail.retry?.(); } } : undefined);
    };
    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
    window.addEventListener(FORBIDDEN_EVENT, onForbidden);
    window.addEventListener(FETCH_ERROR_EVENT, onFetchError);
    return () => {
      window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
      window.removeEventListener(FORBIDDEN_EVENT, onForbidden);
      window.removeEventListener(FETCH_ERROR_EVENT, onFetchError);
    };
  }, [pathname, router, toast, L]);

  return null;
}
