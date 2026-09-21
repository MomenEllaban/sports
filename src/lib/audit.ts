import { prisma } from '@/lib/db';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  branchId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Audit writer (T12). Fire-and-forget from callers (`.catch(() => null)`) so it
 * NEVER fails the business operation. Sensitive actions MUST log here.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId || null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId || null,
        branchId: entry.branchId || null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      },
    });
  } catch {
    /* audit must never break the operation */
  }
}
