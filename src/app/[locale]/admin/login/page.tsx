import React from 'react';
import { LoginForm } from '@/components/admin/LoginForm';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  // Only same-site absolute paths are allowed. Reject protocol-relative URLs
  // (//evil.example) and absolute URLs instead of trying to rewrite them.
  let cleanCallback = '/admin';
  if (typeof callbackUrl === 'string' && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')) {
    cleanCallback = callbackUrl.replace(/^\/(?:ar|en)(?=\/|$)+/g, '') || '/admin';
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <LoginForm callbackUrl={cleanCallback} />
    </div>
  );
}
