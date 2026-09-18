'use client';

import React from 'react';
import { usePathname, Link } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Layers,
  Truck,
  Users,
  DollarSign,
  Briefcase,
  BarChart3,
  Bell,
  Settings,
  ShieldAlert,
  Monitor,
} from 'lucide-react';
import { Role } from '@prisma/client';

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

  const sidebarNav: SidebarItem[] = [
    {
      key: 'dashboard',
      labelAr: 'لوحة المعلومات والملخص',
      labelEn: 'Dashboard Overview',
      href: '/admin',
      icon: <LayoutDashboard className="w-5 h-5 text-blue-400" />,
    },
    {
      key: 'orders',
      labelAr: 'إدارة الطلبات (Online/POS/WA)',
      labelEn: 'Orders Management',
      href: '/admin/orders',
      icon: <ShoppingBag className="w-5 h-5 text-amber-400" />,
    },
    {
      key: 'products',
      labelAr: 'المنتجات والكتالوج',
      labelEn: 'Product Catalog',
      href: '/admin/products',
      icon: <Package className="w-5 h-5 text-emerald-400" />,
    },
    {
      key: 'inventory',
      labelAr: 'المخزون والتحويلات بين الفروع',
      labelEn: 'Inventory & Stock Transfers',
      href: '/admin/inventory',
      icon: <Layers className="w-5 h-5 text-purple-400" />,
    },
    {
      key: 'purchasing',
      labelAr: 'المشتريات وأوامر التوريد',
      labelEn: 'Purchasing & Suppliers',
      href: '/admin/purchasing',
      icon: <Truck className="w-5 h-5 text-cyan-400" />,
      allowedRoles: [Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.FINANCE],
    },
    {
      key: 'customers',
      labelAr: 'سجل العملاء والولاء',
      labelEn: 'Customer Directory & Loyalty',
      href: '/admin/customers',
      icon: <Users className="w-5 h-5 text-indigo-400" />,
    },
    {
      key: 'accounting',
      labelAr: 'الحسابات، الأرباح، وضرائب ETA',
      labelEn: 'Accounting & P&L',
      href: '/admin/accounting',
      icon: <DollarSign className="w-5 h-5 text-emerald-400" />,
      allowedRoles: [Role.SUPER_ADMIN, Role.FINANCE],
    },
    {
      key: 'payroll',
      labelAr: 'مرتبات الموظفين والعمولات',
      labelEn: 'Payroll & Commissions',
      href: '/admin/payroll',
      icon: <Briefcase className="w-5 h-5 text-amber-500" />,
      allowedRoles: [Role.SUPER_ADMIN, Role.FINANCE],
    },
    {
      key: 'reports',
      labelAr: 'التقارير التحليلية للفروع',
      labelEn: 'Analytics & Reports',
      href: '/admin/reports',
      icon: <BarChart3 className="w-5 h-5 text-blue-500" />,
      allowedRoles: [Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.FINANCE],
    },
    {
      key: 'notifications',
      labelAr: 'مركز التنبيهات والإشعارات',
      labelEn: 'Notification Center',
      href: '/admin/notifications',
      icon: <Bell className="w-5 h-5 text-rose-400" />,
    },
    {
      key: 'settings',
      labelAr: 'إعدادات الفروع والضرائب',
      labelEn: 'System & Branch Settings',
      href: '/admin/settings',
      icon: <Settings className="w-5 h-5 text-slate-400" />,
      allowedRoles: [Role.SUPER_ADMIN],
    },
  ];

  // Role Gating Filter: Hide Accounting & Payroll from CASHIER and STAFF
  const filteredNav = sidebarNav.filter(
    (item) => !item.allowedRoles || item.allowedRoles.includes(userRole)
  );

  return (
    <aside className="w-64 bg-slate-900 border-l border-slate-800 flex flex-col justify-between shrink-0 min-h-screen">
      <div className="p-4 space-y-6">
        {/* Brand Header */}
        <Link href="/admin" className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-blue-600 flex items-center justify-center font-black text-white text-xl">
            أ
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-slate-100">ابطال الرياضة</h2>
            <p className="text-[10px] text-amber-400 font-semibold">ERP الإسكندرية</p>
          </div>
        </Link>

        {/* Quick Role Badge */}
        <div className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">الصلاحية:</span>
          <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            {userRole}
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{isAr ? item.labelAr : item.labelEn}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Shortcut to POS */}
      <div className="p-4 border-t border-slate-800">
        <Link
          href="/pos"
          className="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-slate-950 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-2 transition-all"
        >
          <Monitor className="w-4 h-4" />
          <span>الانتقال لنقطة البيع POS</span>
        </Link>
      </div>
    </aside>
  );
}
