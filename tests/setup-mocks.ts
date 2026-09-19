import { vi } from 'vitest';

// Shared mock: every route's getServerSession('next-auth') resolves the
// session installed by setMockSession(). Registered via vitest setupFiles.
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => (globalThis as Record<string, unknown>).__mockSession ?? null),
}));

export interface MockSession {
  user: { id: string; name: string; email: string; role: string; branchIds: string[] };
}

export function setMockSession(session: MockSession | null): void {
  (globalThis as Record<string, unknown>).__mockSession = session;
}
