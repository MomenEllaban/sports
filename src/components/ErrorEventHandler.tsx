'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from '@/i18n/routing';
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
  const { toast } = useToast();

  useEffect(() => {
    const onAuthRequired = (event: Event) => {
      const detail = (event as CustomEvent<ErrorEventDetail>).detail;
      if (pathname.startsWith('/admin')) {
        if (!pathname.startsWith('/admin/login')) router.push('/admin/login');
        return;
      }
      toast('انتهت الجلسة أو لم يتم تسجيل الدخول. سجّل الدخول ثم حاول مجددًا.', 'info');
      void detail;
    };
    const onForbidden = (event: Event) => {
      const detail = (event as CustomEvent<ErrorEventDetail>).detail;
      toast(detail?.error?.message || 'لا تملك صلاحية لتنفيذ هذا الإجراء.', 'error');
    };
    const onFetchError = (event: Event) => {
      const detail = (event as CustomEvent<ErrorEventDetail>).detail;
      const message = detail?.error?.message || 'حدث خطأ، حاول مرة أخرى.';
      toast(message, 'error', detail?.retry ? { actionLabel: 'إعادة المحاولة', onAction: () => { void detail.retry?.(); } } : undefined);
    };
    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
    window.addEventListener(FORBIDDEN_EVENT, onForbidden);
    window.addEventListener(FETCH_ERROR_EVENT, onFetchError);
    return () => {
      window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
      window.removeEventListener(FORBIDDEN_EVENT, onForbidden);
      window.removeEventListener(FETCH_ERROR_EVENT, onFetchError);
    };
  }, [pathname, router, toast]);

  return null;
}
