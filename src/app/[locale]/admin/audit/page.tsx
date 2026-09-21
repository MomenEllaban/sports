import React from 'react';
import AuditViewer from '@/components/admin/AuditViewer';
import { prisma } from '@/lib/db';
import { ShieldAlert } from 'lucide-react';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function AdminAuditPage() {
  await requirePageRole('SUPER_ADMIN');
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });

  return (
    <>
          <div className="border-b border-slate-800 pb-4">
            <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-rose-400" />
              سجل التدقيق (Audit Log)
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">كل الإجراءات الحساسة: خصومات، أدوار، أسعار، مخزون، إلغاءات</p>
          </div>

          <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-4 animate-fade-up">
            <AuditViewer logs={logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }))} />
          </div>
        </>
  );
}
