'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, Link } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Layers,
  Truck,
  HandCoins,
  Users,
  UserCog,
  DollarSign,
  Briefcase,
  BarChart3,
  Bell,
  Clock3,
  RotateCcw,
  Star,
  TicketPercent,
  Settings,
  ShieldAlert,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  User,
} from 'lucide-react';
import { Role } from '@prisma/client';
import Image from 'next/image';
import NavPending from '@/components/layout/NavPending';

export interface SidebarItem {
  key: string;
  labelAr: string;
  labelEn: string;
  href: string;
  icon: React.ReactNode;
  allowedRoles?: Role[];
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const locale = useLocale();
  const isAr = locale === 'ar';
  const { data: session } = useSession();

  const userRole = (session?.user as { role?: Role })?.role || Role.SUPER_ADMIN;

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    let saved = false;
    try {
      saved = localStorage.getItem('admin:sidebar-collapsed') === '1';
    } catch {
      /* private-mode storage unavailable: keep expanded */
    }
    setCollapsed(saved);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem('admin:sidebar-collapsed', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const sidebarNav: SidebarItem[] = [
    {
      key: 'dashboard',
      labelAr: 'لوحة المعلومات والملخص',
      labelEn: 'Dashboard Overview',
      href: '/admin',
      icon: <LayoutDashboard className="w-5 h-5" />,
      allowedRoles: [Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.FINANCE],
    },
    {
      key: 'orders',
      labelAr: 'إدارة الطلبات (Online/POS/WA)',
      labelEn: 'Orders Management',
      href: '/admin/orders',
      icon: <ShoppingBag className="w-5 h-5" />,
      allowedRoles: [Role.SUPER_ADMIN, Role.BRANCH_MANAGER],
    },
    {
      key: 'products',
      labelAr: 'المنتجات والكتالوج',
      labelEn: 'Product Catalog',
      href: '/admin/products',
      icon: <Package className="w-5 h-5" />,
      allowedRoles: [Role.SUPER_ADMIN, Role.BRANCH_MANAGER],
    },
    {
      key: 'inventory',
      labelAr: 'المخزون والتحويلات بين الفروع',
      labelEn: 'Inventory & Stock Transfers',
      href: '/admin/inventory',
      icon: <Layers className="w-5 h-5" />,
      allowedRoles: [Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.STAFF],
    },
    {
      key: 'purchasing',
      labelAr: 'المشتريات وأوامر التوريد',
      labelEn: 'Purchasing & Suppliers',
      href: '/admin/purchasing',
      icon: <Truck className="w-5 h-5" />,
      allowedRoles: [Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.FINANCE],
    },
    {
      key: 'customers',
      labelAr: 'سجل العملاء والولاء',
      labelEn: 'Customer Directory & Loyalty',
      href: '/admin/customers',
      icon: <Users className="w-5 h-5" />,
      allowedRoles: [Role.SUPER_ADMIN, Role.BRANCH_MANAGER],
    },
    {
      key: 'employees',
      labelAr: 'الموظفين والكادر الوظيفي',
      labelEn: 'Employees & Staff',
      href: '/admin/employees',
      icon: <UserCog className="w-5 h-5" />,
      allowedRoles: [Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.FINANCE],
    },
    {
      key: 'accounting',
      labelAr: 'الحسابات، الأرباح، وضرائب ETA',
      labelEn: 'Accounting & P&L',
      href: '/admin/accounting',
      icon: <DollarSign className="w-5 h-5" />,
      allowedRoles: [Role.SUPER_ADMIN, Role.FINANCE],
    },
    {
      key: 'payroll',
      labelAr: 'مرتبات الموظفين والعمولات',
      labelEn: 'Payroll & Commissions',
      href: '/admin/payroll',
      icon: <Briefcase className="w-5 h-5" />,
      allowedRoles: [Role.SUPER_ADMIN, Role.FINANCE],
    },
    {
      key: 'cod-settlement',
      labelAr: 'تسوية التحصيل النقدي COD',
      labelEn: 'COD Settlement',
      href: '/admin/cod-settlement',
      icon: <HandCoins className="w-5 h-5" />,
      allowedRoles: [Role.SUPER_ADMIN, Role.FINANCE],
    },
    {
      key: 'returns',
      labelAr: 'المرتجعات والاستبدال',
      labelEn: 'Returns & Exchange',
      href: '/admin/returns',
      icon: <RotateCcw className="w-5 h-5" />,
      allowedRoles: [Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.FINANCE],
    },
    {
      key: 'reviews',
      labelAr: 'تقييمات العملاء',
      labelEn: 'Customer Reviews',
      href: '/admin/reviews',
      icon: <Star className="w-5 h-5" />,
      allowedRoles: [Role.SUPER_ADMIN, Role.BRANCH_MANAGER],
    },
    {
      key: 'coupons',
      labelAr: 'الكوبونات والعروض',
      labelEn: 'Coupons & Promos',
      href: '/admin/coupons',
      icon: <TicketPercent className="w-5 h-5" />,
      allowedRoles: [Role.SUPER_ADMIN, Role.BRANCH_MANAGER],
    },
    {
      key: 'shifts',
      labelAr: 'الورديات والدرج',
      labelEn: 'Shifts & Cash Drawer',
      href: '/admin/shifts',
      icon: <Clock3 className="w-5 h-5" />,
      allowedRoles: [Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.FINANCE],
    },
    {
      key: 'reports',
      labelAr: 'التقارير التحليلية للفروع',
      labelEn: 'Analytics & Reports',
      href: '/admin/reports',
      icon: <BarChart3 className="w-5 h-5" />,
      allowedRoles: [Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.FINANCE],
    },
    {
      key: 'notifications',
      labelAr: 'مركز التنبيهات والإشعارات',
      labelEn: 'Notification Center',
      href: '/admin/notifications',
      icon: <Bell className="w-5 h-5" />,
      allowedRoles: [Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.FINANCE, Role.CASHIER, Role.STAFF],
    },
    {
      key: 'users',
      labelAr: 'المستخدمين والصلاحيات',
      labelEn: 'Users & Permissions',
      href: '/admin/users',
      icon: <ShieldAlert className="w-5 h-5" />,
      allowedRoles: [Role.SUPER_ADMIN],
    },
    {
      key: 'settings',
      labelAr: 'إعدادات الفروع والضرائب',
      labelEn: 'System & Branch Settings',
      href: '/admin/settings',
      icon: <Settings className="w-5 h-5" />,
      allowedRoles: [Role.SUPER_ADMIN],
    },
  ];

  // Role Gating Filter: Hide Accounting & Payroll from CASHIER and STAFF
  const filteredNav = sidebarNav.filter(
    (item) => !item.allowedRoles || item.allowedRoles.includes(userRole)
  );

  return (
    <aside className={`${collapsed ? 'w-20' : 'w-64'} h-full bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 min-h-0 overflow-y-auto transition-[width] duration-200 ease-in-out`}>
      <div className="p-3 space-y-4 flex-1">
        {/* Brand Header + Collapse toggle */}
        <div className={`flex items-center gap-2 border-b border-slate-800 pb-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <Link href="/admin" className={`flex items-center gap-3 min-w-0 ${collapsed ? 'flex-1 justify-center' : 'flex-1'}`}>
            <Image
              src="/logo.avif"
              alt="أبطال الرياضة الإبراهيمية"
              width={960}
              height={822}
              priority
              quality={80}
              sizes="48px"
              className="h-10 w-auto rounded-lg object-contain shrink-0"
            />
            {!collapsed && (
              <div className="min-w-0">
                <h2 className="font-extrabold text-sm text-slate-100 truncate">ابطال الرياضة</h2>
                <p className="text-[10px] text-amber-400 font-semibold truncate">ERP الإسكندرية</p>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? (isAr ? 'توسيع القائمة الجانبية' : 'Expand sidebar') : (isAr ? 'طي القائمة الجانبية' : 'Collapse sidebar')}
            aria-label={collapsed ? (isAr ? 'توسيع القائمة الجانبية' : 'Expand sidebar') : (isAr ? 'طي القائمة الجانبية' : 'Collapse sidebar')}
            className="shrink-0 p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* User & Role Badge */}
        {collapsed ? (
          <div className="flex justify-center">
            <div
              title={`${session?.user?.name || (session?.user?.email ? session.user.email.split('@')[0] : 'مستخدم النظام')} — ${userRole}`}
              className="w-10 h-10 rounded-2xl bg-slate-950/90 border border-slate-800 flex items-center justify-center text-slate-300"
            >
              <User className="w-5 h-5" />
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[10px] font-medium">المستخدم المسجل:</span>
              <span className="font-black text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {userRole}
              </span>
            </div>
            <p className="font-black text-slate-100 text-xs truncate">
              {session?.user?.name || (session?.user?.email ? session.user.email.split('@')[0] : 'مستخدم النظام')}
            </p>
            <p className="text-[10px] text-slate-400 font-mono truncate" dir="ltr">
              {session?.user?.email || ''}
            </p>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="space-y-1">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href;
            const label = isAr ? item.labelAr : item.labelEn;
            return (
              <Link
                key={item.key}
                href={item.href}
                title={collapsed ? label : undefined}
                aria-label={label}
                className={`flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-3.5'} py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                }`}
              >
                {item.icon}
                {!collapsed && <span className="flex-1">{label}</span>}
                {!collapsed && <NavPending className={isActive ? 'text-white' : 'text-blue-400'} />}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Shortcut to POS */}
      <div className="p-4 border-t border-slate-800">
        <Link
          href="/pos"
          title={collapsed ? 'الانتقال لنقطة البيع POS' : undefined}
          aria-label="الانتقال لنقطة البيع POS"
          className={`${collapsed ? 'justify-center' : ''} w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-slate-950 border border-amber-500/40 text-xs font-bold flex items-center gap-2 transition-all`}
        >
          <Monitor className="w-4 h-4" />
          {!collapsed && <span>الانتقال لنقطة البيع POS</span>}
        </Link>
      </div>
    </aside>
  );
}
