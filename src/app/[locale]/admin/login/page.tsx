import React from 'react';
import { LoginForm } from '@/components/admin/LoginForm';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <LoginForm callbackUrl={callbackUrl || '/admin'} />
    </div>
  );
}
