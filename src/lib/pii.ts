/** PII minimization helpers (F1). */
export function maskPhone(p: string | null | undefined): string {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  if (d.length < 7) return '••••';
  return `${d.slice(0, 3)}••••${d.slice(-4)}`;
}
