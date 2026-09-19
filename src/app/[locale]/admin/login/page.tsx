import React from 'react';
import { LoginForm } from '@/components/admin/LoginForm';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  // Sanitize callbackUrl: remove host if any and strip leading locale prefixes (/ar or /en)
  let cleanCallback = callbackUrl ? callbackUrl.replace(/^https?:\/\/[^\/]+/, '') : '/admin';
  cleanCallback = cleanCallback.replace(/^\/(?:ar|en)(?=\/|$)+/g, '') || '/admin';
  if (!cleanCallback.startsWith('/')) {
    cleanCallback = `/${cleanCallback}`;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <LoginForm callbackUrl={cleanCallback} />
    </div>
  );
}
