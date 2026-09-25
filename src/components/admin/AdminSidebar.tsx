'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname, Link } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { Monitor, PanelLeftClose, PanelLeftOpen, User, X, ChevronRight, ChevronDown } from 'lucide-react';
import {
  ADMIN_ROLES,
  getVisibleAdminGroups,
  normalizeAdminPath,
  pathMatches,
  type AdminNavItem,
  type AdminRole,
} from '@/config/admin-navigation';
import { AdminIcon } from './AdminIcon';
import NavPending from '@/components/layout/NavPending';

const COLLAPSED_STORAGE_KEY = 'admin:sidebar-collapsed';

function Tooltip({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span className="group/tooltip relative inline-flex min-w-0">
      {children}
      <span className="pointer-events-none absolute start-1/2 top-full z-50 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[11px] font-bold text-slate-200 opacity-0 shadow-xl transition-opacity group-hover/tooltip:block group-hover/tooltip:opacity-100 rtl:translate-x-1/2">
        {label}
      </span>
    </span>
  );
}

function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value);
}

export default function AdminSidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname() || '/admin';
  const locale = useLocale();
  const isAr = locale === 'ar';
  const { data: session } = useSession();
  const rawRole = (session?.user as { role?: unknown } | undefined)?.role;
  const role: AdminRole | undefined = isAdminRole(rawRole) ? rawRole : undefined;

  const [collapsed, setCollapsed] = useState(false);
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let savedCollapsed = false;
    try {
      savedCollapsed = localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1';
    } catch {
      // Private browsing and storage-disabled browsers use defaults.
    }
    // Group open/closed state is intentionally NOT persisted: on every load the
    // sidebar starts with only the first category expanded so the rail stays
    // short and predictable instead of restoring a large previous tree.
    const visibleGroups = getVisibleAdminGroups(role);
    setCollapsed(savedCollapsed);
    setGroupOpen(Object.fromEntries(visibleGroups.map((group, index) => [group.key, index === 0])));
  }, [role]);

  // Keep the category that owns the current route expanded after navigation.
  useEffect(() => {
    const currentPath = normalizeAdminPath(pathname);
    const currentGroup = getVisibleAdminGroups(role).find((group) =>
      group.items.some((item) => pathMatches(currentPath, item.href)),
    );
    if (currentGroup) {
      setGroupOpen((previous) => (previous[currentGroup.key] ? previous : { ...previous, [currentGroup.key]: true }));
    }
  }, [pathname, role]);

  const groups = useMemo(() => getVisibleAdminGroups(role), [role]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Ignore storage failures.
      }
      return next;
    });
  };

  const toggleGroup = (key: string) => {
    if (collapsed) {
      setCollapsed(false);
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, '0');
      } catch {
        // Ignore storage failures.
      }
    }
    setGroupOpen((previous) => ({ ...previous, [key]: !(previous[key] ?? false) }));
  };

  const userName = session?.user?.name || (isAr ? 'مستخدم النظام' : 'System user');
  const userEmail = session?.user?.email || '';
  const visibleWidth = collapsed && !mobileOpen ? 'w-20' : 'w-72';
  const showLabels = !collapsed || mobileOpen;

  return (
    <>
      {mobileOpen && <button type="button" aria-label={isAr ? 'إغلاق القائمة' : 'Close menu'} onClick={onClose} className="fixed inset-0 z-40 bg-slate-950/70 lg:hidden" />}
      <aside
        className={`${visibleWidth} ${mobileOpen ? 'flex' : 'hidden lg:flex'} fixed inset-y-0 start-0 z-50 h-dvh min-h-0 flex-col overflow-hidden border-e border-slate-800 bg-slate-900 transition-[width] duration-200 ease-out lg:static lg:z-auto lg:shrink-0`}
        aria-label={isAr ? 'قائمة التنقل الرئيسية' : 'Primary navigation'}
      >
        <div className="flex min-h-0 flex-1 flex-col p-3">
          <div className={`mb-4 flex shrink-0 items-center gap-2 border-b border-slate-800 pb-3 ${showLabels ? 'justify-between' : 'justify-center'}`}>
            <Link href="/admin" onClick={onClose} className={`flex min-w-0 items-center gap-3 ${showLabels ? 'flex-1' : 'justify-center'}`}>
              <Image src="/logo.avif" alt={isAr ? 'أبطال الرياضة' : 'Sports Champions'} width={960} height={822} priority quality={80} sizes="48px" className="h-10 w-auto shrink-0 rounded-lg object-contain" />
              {showLabels && (
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-extrabold text-slate-100">{isAr ? 'ابطال الرياضة' : 'Sports Champions'}</h2>
                  <p className="truncate text-[10px] font-semibold text-amber-400">{isAr ? 'ERP الإسكندرية' : 'Alexandria ERP'}</p>
                </div>
              )}
            </Link>
            <div className="flex shrink-0 items-center gap-1">
              {mobileOpen && (
                <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700" aria-label={isAr ? 'إغلاق القائمة' : 'Close menu'}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={toggleCollapsed}
                title={collapsed ? (isAr ? 'توسيع القائمة الجانبية' : 'Expand sidebar') : (isAr ? 'طي القائمة الجانبية' : 'Collapse sidebar')}
                aria-label={collapsed ? (isAr ? 'توسيع القائمة الجانبية' : 'Expand sidebar') : (isAr ? 'طي القائمة الجانبية' : 'Collapse sidebar')}
                className="rounded-lg border border-slate-700 bg-slate-800/80 p-2 text-slate-300 transition-colors hover:bg-slate-700"
              >
                {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div data-scroll-region="admin-sidebar" className="app-scrollbar min-h-0 flex-1 overflow-y-auto pe-1">
            {!!role && (['SUPER_ADMIN', 'BRANCH_MANAGER', 'CASHIER'] as readonly string[]).includes(role) && (
              <Link
                href="/pos"
                onClick={onClose}
                title={isAr ? 'فتح نقطة البيع POS' : 'Open POS'}
                className={`mb-4 inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border border-amber-400/50 bg-gradient-to-l from-amber-500/25 to-amber-400/10 px-3 text-xs font-black text-amber-300 shadow-lg shadow-amber-500/10 transition hover:border-amber-300 hover:bg-amber-500 hover:text-slate-950 ${showLabels ? 'justify-start' : ''}`}
              >
                <Monitor className="h-5 w-5 shrink-0" aria-hidden="true" />
                {showLabels && <span>{isAr ? 'نقطة البيع POS' : 'Point of Sale POS'}</span>}
              </Link>
            )}

            {showLabels ? (
              <div className="mb-4 space-y-1.5 rounded-2xl border border-slate-800 bg-slate-950/90 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-slate-400">{isAr ? 'المستخدم المسجل' : 'Signed in'}</span>
                  <span className="max-w-[7rem] truncate rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black text-emerald-400">{role || (isAr ? 'جارٍ التحقق' : 'Checking role')}</span>
                </div>
                <p className="truncate font-black text-slate-100">{userName}</p>
                {userEmail && <p className="truncate font-mono text-[10px] text-slate-400" dir="ltr">{userEmail}</p>}
              </div>
            ) : (
              <Tooltip label={userName}>
                <div className="mb-4 flex h-10 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/90 text-slate-300" aria-label={userName}>
                  <User className="h-5 w-5" aria-hidden="true" />
                </div>
              </Tooltip>
            )}

            <nav className="min-h-0 space-y-2" aria-label={isAr ? 'أقسام الإدارة' : 'Admin sections'}>
              {groups.map((group, groupIndex) => {
                const groupActive = group.items.some((item) => pathMatches(pathname, item.href));
                const isOpen = groupOpen[group.key] ?? groupIndex === 0;
                const groupLabel = isAr ? group.labelAr : group.labelEn;
                return (
                  <section key={group.key} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      aria-expanded={isOpen}
                      aria-controls={`admin-group-${group.key}`}
                      className={`group flex min-h-10 w-full items-center rounded-xl border text-start transition-colors ${showLabels ? 'gap-2.5 px-3' : 'justify-center px-1'} ${groupActive ? 'border-blue-500/30 bg-blue-500/10 text-blue-300' : 'border-transparent text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'}`}
                    >
                      <AdminIcon name={group.icon} className="h-4.5 w-4.5 shrink-0" />
                      {showLabels && <span className="min-w-0 flex-1 truncate text-xs font-black">{groupLabel}</span>}
                      {/* The expand/collapse affordance stays visible in both dark and
                          light themes, and also in the icon-only rail. */}
                      <span
                        className={`sidebar-group-chevron grid size-5 shrink-0 place-items-center rounded-md ${showLabels ? '' : 'ms-0.5'}`}
                        data-state={isOpen ? 'open' : 'closed'}
                      >
                        {isOpen
                          ? <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          : <ChevronRight className="h-4 w-4 rtl-flip" aria-hidden="true" />}
                      </span>
                    </button>
                    {isOpen && (
                      <div id={`admin-group-${group.key}`} className="space-y-1 ps-2">
                        {group.items.map((item) => (
                          <SidebarLink key={item.key} item={item} pathname={pathname} collapsed={!showLabels} isAr={isAr} onNavigate={onClose} />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </nav>
            {groups.length === 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center text-[11px] text-slate-500">
                {isAr ? 'جارٍ تحميل الصلاحيات…' : 'Loading permissions…'}
              </div>
            )}
          </div>
        </div>
        <footer
          className="shrink-0 border-t border-slate-800 p-3 text-center text-[10px] text-slate-500"
          aria-label={isAr ? 'إصدار النظام' : 'System version'}
          title="Sports Champions ERP · v1.0"
        >
          <span dir="ltr" className="whitespace-nowrap">{showLabels ? 'Sports Champions ERP · v1.0' : 'ERP · v1.0'}</span>
        </footer>
      </aside>
    </>
  );
}

function SidebarLink({ item, pathname, collapsed, isAr, onNavigate }: { item: AdminNavItem; pathname: string; collapsed: boolean; isAr: boolean; onNavigate?: () => void }) {
  const label = isAr ? item.labelAr : item.labelEn;
  const active = pathMatches(pathname, item.href);
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`group/link relative flex min-h-10 items-center rounded-xl transition-all ${collapsed ? 'justify-center px-1' : 'gap-2.5 px-3'} ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'}`}
    >
      <AdminIcon name={item.icon} className="h-4.5 w-4.5 shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate text-xs font-bold">{label}</span>}
      {!collapsed && item.status && item.status !== 'live' && (
        <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] ${item.status === 'partial' ? 'status-info' : 'status-warning'}`}>
          {item.status === 'partial' ? (isAr ? 'جزئي' : 'Partial') : (isAr ? 'قريبًا' : 'Soon')}
        </span>
      )}
      {!collapsed && <NavPending className={active ? 'text-white' : 'text-blue-400'} />}
    </Link>
  );

  return collapsed ? <Tooltip label={label}>{link}</Tooltip> : link;
}
