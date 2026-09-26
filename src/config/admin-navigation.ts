/**
 * Admin navigation is intentionally data-driven.
 *
 * Keep route and permission decisions here so the shell, breadcrumbs, section
 * tabs, and the command palette all share one source of truth.  UI icons are
 * represented by stable names and mapped in the client shell; this keeps this
 * module safe to import from Server Components and tests.
 */

export const ADMIN_ROLES = [
  'SUPER_ADMIN',
  'BRANCH_MANAGER',
  'STAFF',
  'CASHIER',
  'FINANCE',
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export type AdminIconName =
  | 'dashboard'
  | 'bell'
  | 'orders'
  | 'returns'
  | 'cash'
  | 'shifts'
  | 'invoices'
  | 'shipping'
  | 'products'
  | 'inventory'
  | 'stocktake'
  | 'barcode'
  | 'purchasing'
  | 'suppliers'
  | 'customers'
  | 'loyalty'
  | 'reviews'
  | 'coupons'
  | 'campaigns'
  | 'accounting'
  | 'expenses'
  | 'treasury'
  | 'tax'
  | 'receivables'
  | 'employees'
  | 'attendance'
  | 'payroll'
  | 'leave'
  | 'reports'
  | 'branches-report'
  | 'content'
  | 'store-settings'
  | 'carts'
  | 'users'
  | 'roles'
  | 'branches'
  | 'settings'
  | 'audit'
  | 'backup';

export interface AdminTab {
  key: string;
  labelAr: string;
  labelEn: string;
  href: string;
}

export interface AdminNavItem {
  key: string;
  section: string;
  labelAr: string;
  labelEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  href: string;
  icon: AdminIconName;
  allowedRoles?: readonly AdminRole[];
  tabs?: readonly AdminTab[];
  status?: 'live' | 'partial' | 'planned';
}

export interface AdminNavGroup {
  key: string;
  labelAr: string;
  labelEn: string;
  icon: AdminIconName;
  allowedRoles?: readonly AdminRole[];
  items: readonly AdminNavItem[];
}

const ALL_ADMIN: readonly AdminRole[] = ADMIN_ROLES;
const MANAGERS: readonly AdminRole[] = ['SUPER_ADMIN', 'BRANCH_MANAGER'];
const FINANCE: readonly AdminRole[] = ['SUPER_ADMIN', 'FINANCE'];
const SALES_OPERATIONS: readonly AdminRole[] = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE'];

const ordersTabs: readonly AdminTab[] = [
  { key: 'all', labelAr: 'الكل', labelEn: 'All', href: '/admin/orders' },
  { key: 'online', labelAr: 'Online', labelEn: 'Online', href: '/admin/orders/online' },
  { key: 'pos', labelAr: 'POS', labelEn: 'POS', href: '/admin/orders/pos' },
  { key: 'whatsapp', labelAr: 'WhatsApp', labelEn: 'WhatsApp', href: '/admin/orders/whatsapp' },
  { key: 'processing', labelAr: 'قيد التجهيز', labelEn: 'Processing', href: '/admin/orders/processing' },
  { key: 'completed', labelAr: 'مكتملة', labelEn: 'Completed', href: '/admin/orders/completed' },
  { key: 'cancelled', labelAr: 'ملغاة', labelEn: 'Cancelled', href: '/admin/orders/cancelled' },
];

const productsTabs: readonly AdminTab[] = [
  { key: 'list', labelAr: 'قائمة المنتجات', labelEn: 'Product list', href: '/admin/products' },
  { key: 'categories', labelAr: 'التصنيفات', labelEn: 'Categories', href: '/admin/products/categories' },
  { key: 'brands', labelAr: 'الماركات', labelEn: 'Brands', href: '/admin/products/brands' },
];

const inventoryTabs: readonly AdminTab[] = [
  { key: 'balances', labelAr: 'أرصدة الفروع', labelEn: 'Branch balances', href: '/admin/inventory' },
  { key: 'movements', labelAr: 'حركة المخزون', labelEn: 'Movements ledger', href: '/admin/inventory/movements' },
  { key: 'transfers', labelAr: 'التحويلات بين الفروع', labelEn: 'Inter-branch transfers', href: '/admin/inventory/transfers' },
  { key: 'alerts', labelAr: 'تنبيهات إعادة الطلب', labelEn: 'Reorder alerts', href: '/admin/inventory/alerts' },
];

const purchasingTabs: readonly AdminTab[] = [
  { key: 'orders', labelAr: 'أوامر التوريد والشراء', labelEn: 'Purchase orders', href: '/admin/purchasing' },
  { key: 'receiving', labelAr: 'استلام البضائع والفحص', labelEn: 'Goods receiving', href: '/admin/purchasing/receiving' },
  { key: 'invoices', labelAr: 'فواتير المشتريات ومطابقة الموردين', labelEn: 'Purchase invoices', href: '/admin/purchasing/invoices' },
];

const customersTabs: readonly AdminTab[] = [
  { key: 'list', labelAr: 'قائمة العملاء', labelEn: 'Customer list', href: '/admin/customers' },
  { key: 'groups', labelAr: 'المجموعات', labelEn: 'Segments', href: '/admin/customers/groups' },
  { key: 'loyalty', labelAr: 'الولاء والنقاط', labelEn: 'Loyalty & points', href: '/admin/customers/loyalty' },
  { key: 'ledger', labelAr: 'السجل المالي', labelEn: 'Financial ledger', href: '/admin/customers/ledger' },
];

const employeesTabs: readonly AdminTab[] = [
  { key: 'list', labelAr: 'قائمة الموظفين', labelEn: 'Employee list', href: '/admin/employees' },
  { key: 'departments', labelAr: 'الأقسام والوظائف', labelEn: 'Departments & roles', href: '/admin/employees/departments' },
  { key: 'attendance', labelAr: 'الحضور والانصراف', labelEn: 'Attendance', href: '/admin/employees/attendance' },
  { key: 'documents', labelAr: 'المستندات', labelEn: 'Documents', href: '/admin/employees/documents' },
];

const accountingTabs: readonly AdminTab[] = [
  { key: 'overview', labelAr: 'نظرة عامة', labelEn: 'Overview', href: '/admin/accounting' },
  { key: 'pnl', labelAr: 'الأرباح والخسائر', labelEn: 'P&L', href: '/admin/accounting/pnl' },
  { key: 'expenses', labelAr: 'المصروفات', labelEn: 'Expenses', href: '/admin/accounting/expenses' },
  { key: 'treasury', labelAr: 'الخزينة والسيولة', labelEn: 'Treasury & liquidity', href: '/admin/accounting/treasury' },
  { key: 'receivables', labelAr: 'ذمم العملاء والتحصيل', labelEn: 'Receivables & collection', href: '/admin/accounting/receivables' },
  { key: 'eta', labelAr: 'ضرائب ETA', labelEn: 'ETA tax', href: '/admin/accounting/eta' },
];

const payrollTabs: readonly AdminTab[] = [
  { key: 'payslips', labelAr: 'كشف المرتب', labelEn: 'Payslips', href: '/admin/payroll' },
  { key: 'commissions', labelAr: 'العمولات', labelEn: 'Commissions', href: '/admin/payroll/commissions' },
  { key: 'advances', labelAr: 'السلف والخصومات', labelEn: 'Advances & deductions', href: '/admin/payroll/advances' },
  { key: 'history', labelAr: 'تاريخ الصرف', labelEn: 'Payment history', href: '/admin/payroll/history' },
];

const returnsTabs: readonly AdminTab[] = [
  { key: 'requests', labelAr: 'طلبات المرتجع', labelEn: 'Return requests', href: '/admin/returns' },
  { key: 'exchanges', labelAr: 'الاستبدال', labelEn: 'Exchanges', href: '/admin/returns/exchanges' },
  { key: 'policies', labelAr: 'القبول والرفض', labelEn: 'Acceptance policy', href: '/admin/returns/policies' },
];

const couponsTabs: readonly AdminTab[] = [
  { key: 'coupons', labelAr: 'الكوبونات', labelEn: 'Coupons', href: '/admin/coupons' },
  { key: 'promos', labelAr: 'العروض التلقائية', labelEn: 'Automatic offers', href: '/admin/coupons/promos' },
  { key: 'usage', labelAr: 'سجل الاستخدام', labelEn: 'Usage log', href: '/admin/coupons/usage' },
];

const shiftsTabs: readonly AdminTab[] = [
  { key: 'current', labelAr: 'الوردية الحالية', labelEn: 'Current shift', href: '/admin/shifts' },
  { key: 'history', labelAr: 'سجل الورديات', labelEn: 'Shift history', href: '/admin/shifts/history' },
  { key: 'differences', labelAr: 'فروق الدرج', labelEn: 'Drawer differences', href: '/admin/shifts/differences' },
];

const settingsTabs: readonly AdminTab[] = [
  { key: 'general', labelAr: 'عام', labelEn: 'General', href: '/admin/settings' },
  { key: 'branches', labelAr: 'الفروع', labelEn: 'Branches', href: '/admin/settings/branches' },
  { key: 'tax', labelAr: 'الضرائب', labelEn: 'Tax', href: '/admin/settings/tax' },
  { key: 'payments', labelAr: 'الدفع', labelEn: 'Payments', href: '/admin/settings/payments' },
  { key: 'printing', labelAr: 'الطباعة', labelEn: 'Printing', href: '/admin/settings/printing' },
  { key: 'notifications', labelAr: 'الإشعارات', labelEn: 'Notifications', href: '/admin/settings/notifications' },
];

const reportsTabs: readonly AdminTab[] = [
  { key: 'overview', labelAr: 'نظرة عامة', labelEn: 'Overview', href: '/admin/reports' },
  { key: 'sales', labelAr: 'المبيعات', labelEn: 'Sales', href: '/admin/reports/sales' },
  { key: 'inventory', labelAr: 'المخزون', labelEn: 'Inventory', href: '/admin/reports/inventory' },
  { key: 'branches', labelAr: 'الفروع', labelEn: 'Branches', href: '/admin/reports/branches' },
  { key: 'finance', labelAr: 'المالية والأرباح', labelEn: 'Finance & profit', href: '/admin/reports/finance' },
  { key: 'reorder', labelAr: 'كشكول النواقص', labelEn: 'Shortages reorder sheet', href: '/admin/reports/reorder' },
];

const websiteTabs: readonly AdminTab[] = [
  { key: 'content', labelAr: 'البنرات والصفحات', labelEn: 'Banners & pages', href: '/admin/website/content' },
  { key: 'store', labelAr: 'إعدادات المتجر', labelEn: 'Store settings', href: '/admin/website/store' },
  { key: 'carts', labelAr: 'السلات المتروكة', labelEn: 'Abandoned carts', href: '/admin/website/carts' },
];

const salesInvoicesTabs: readonly AdminTab[] = [
  { key: 'quotes', labelAr: 'عروض الأسعار', labelEn: 'Quotations', href: '/admin/sales/quotations' },
  { key: 'invoices', labelAr: 'فواتير العملاء', labelEn: 'Customer invoices', href: '/admin/sales/invoices' },
  { key: 'payments', labelAr: 'تحصيل الدفعات', labelEn: 'Payments received', href: '/admin/sales/payments' },
];

function tabSet(tabs: readonly AdminTab[]) {
  return tabs;
}

export const adminNavigation: readonly AdminNavGroup[] = [
  {
    key: 'home',
    labelAr: 'الرئيسية',
    labelEn: 'Home',
    icon: 'dashboard',
    items: [
      {
        key: 'dashboard', section: 'dashboard', labelAr: 'لوحة المعلومات', labelEn: 'Dashboard',
        descriptionAr: 'ملخص الأداء والتنبيهات', descriptionEn: 'Performance overview',
        href: '/admin', icon: 'dashboard', allowedRoles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE'], status: 'live',
      },
      {
        key: 'notifications', section: 'notifications', labelAr: 'مركز التنبيهات', labelEn: 'Notification center',
        href: '/admin/notifications', icon: 'bell', allowedRoles: ALL_ADMIN, status: 'live',
      },
    ],
  },
  {
    key: 'sales',
    labelAr: 'المبيعات',
    labelEn: 'Sales',
    icon: 'orders',
    items: [
      {
        key: 'orders', section: 'orders', labelAr: 'الطلبات', labelEn: 'Orders',
        descriptionAr: 'Online / POS / WhatsApp', descriptionEn: 'Online / POS / WhatsApp',
        href: '/admin/orders', icon: 'orders', allowedRoles: MANAGERS, tabs: tabSet(ordersTabs), status: 'live',
      },
      {
        key: 'returns', section: 'returns', labelAr: 'المرتجعات والاستبدال', labelEn: 'Returns & exchanges',
        href: '/admin/returns', icon: 'returns', allowedRoles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE'], tabs: tabSet(returnsTabs), status: 'live',
      },
      {
        key: 'cod', section: 'cod-settlement', labelAr: 'تسوية COD', labelEn: 'COD settlement',
        href: '/admin/cod-settlement', icon: 'cash', allowedRoles: FINANCE, status: 'live',
      },
      {
        key: 'shifts', section: 'shifts', labelAr: 'الورديات والدرج', labelEn: 'Shifts & drawer',
        href: '/admin/shifts', icon: 'shifts', allowedRoles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE'], tabs: tabSet(shiftsTabs), status: 'live',
      },
      {
        key: 'sales-invoices', section: 'sales-invoices', labelAr: 'عروض الأسعار والفواتير', labelEn: 'Quotes & invoices',
        href: '/admin/sales/invoices', icon: 'invoices', allowedRoles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE'], tabs: tabSet(salesInvoicesTabs), status: 'live',
      },
      {
        key: 'shipping', section: 'shipping', labelAr: 'الشحن وشركات التوصيل', labelEn: 'Shipping & couriers',
        href: '/admin/shipping', icon: 'shipping', allowedRoles: SALES_OPERATIONS, status: 'live',
      },
    ],
  },
  {
    key: 'products',
    labelAr: 'المنتجات والمخزون',
    labelEn: 'Products & inventory',
    icon: 'products',
    items: [
      {
        key: 'products', section: 'products', labelAr: 'المنتجات والكتالوج', labelEn: 'Products catalog',
        href: '/admin/products', icon: 'products', allowedRoles: MANAGERS, tabs: tabSet(productsTabs), status: 'live',
      },
      {
        key: 'inventory', section: 'inventory', labelAr: 'المخزون والتحويلات', labelEn: 'Inventory & transfers',
        href: '/admin/inventory', icon: 'inventory', allowedRoles: MANAGERS, tabs: tabSet(inventoryTabs), status: 'live',
      },
      {
        key: 'stocktake', section: 'stocktake', labelAr: 'الجرد وتسوية المخزون', labelEn: 'Stocktake & reconciliation',
        href: '/admin/inventory/count', icon: 'stocktake', allowedRoles: MANAGERS, status: 'live',
      },
      {
        key: 'barcode', section: 'barcode', labelAr: 'الباركود والطباعة', labelEn: 'Barcode & printing',
        href: '/admin/inventory/labels', icon: 'barcode', allowedRoles: MANAGERS, status: 'live',
      },
    ],
  },
  {
    key: 'purchasing',
    labelAr: 'المشتريات',
    labelEn: 'Purchasing',
    icon: 'purchasing',
    items: [
      {
        key: 'purchasing', section: 'purchasing', labelAr: 'أوامر التوريد والاستلام', labelEn: 'Purchase orders',
        href: '/admin/purchasing', icon: 'purchasing', allowedRoles: MANAGERS, tabs: tabSet(purchasingTabs), status: 'live',
      },
      {
        key: 'suppliers', section: 'suppliers', labelAr: 'الموردون', labelEn: 'Suppliers',
        href: '/admin/purchasing/suppliers', icon: 'suppliers', allowedRoles: MANAGERS, status: 'live',
      },
      {
        key: 'purchase-returns', section: 'purchase-returns', labelAr: 'مرتجعات الموردين', labelEn: 'Supplier returns',
        href: '/admin/purchasing/returns', icon: 'returns', allowedRoles: MANAGERS, status: 'live',
      },
    ],
  },
  {
    key: 'customers',
    labelAr: 'العملاء والتسويق',
    labelEn: 'Customers & marketing',
    icon: 'customers',
    items: [
      {
        key: 'customers', section: 'customers', labelAr: 'سجل العملاء', labelEn: 'Customers',
        href: '/admin/customers', icon: 'customers', allowedRoles: MANAGERS, tabs: tabSet(customersTabs), status: 'live',
      },
      {
        key: 'coupons', section: 'coupons', labelAr: 'الكوبونات والعروض', labelEn: 'Coupons & offers',
        href: '/admin/coupons', icon: 'coupons', allowedRoles: MANAGERS, tabs: tabSet(couponsTabs), status: 'live',
      },
      {
        key: 'campaigns', section: 'campaigns', labelAr: 'الحملات والرسائل', labelEn: 'Campaigns & messages',
        href: '/admin/campaigns', icon: 'campaigns', allowedRoles: MANAGERS, status: 'live',
      },
      {
        key: 'reviews', section: 'reviews', labelAr: 'التقييمات', labelEn: 'Reviews',
        href: '/admin/reviews', icon: 'reviews', allowedRoles: MANAGERS, status: 'live',
      },
    ],
  },
  {
    key: 'finance',
    labelAr: 'المالية',
    labelEn: 'Finance',
    icon: 'accounting',
    items: [
      {
        key: 'accounting', section: 'accounting', labelAr: 'الحسابات والأرباح', labelEn: 'Accounting & profit',
        href: '/admin/accounting', icon: 'accounting', allowedRoles: FINANCE, tabs: tabSet(accountingTabs), status: 'live',
      },
      {
        key: 'expenses', section: 'expenses', labelAr: 'المصروفات والإيرادات', labelEn: 'Expenses & income',
        href: '/admin/expenses', icon: 'expenses', allowedRoles: FINANCE, status: 'live',
      },
      {
        key: 'treasury', section: 'treasury', labelAr: 'الخزينة والبنوك', labelEn: 'Treasury & banks',
        href: '/admin/accounting/treasury', icon: 'treasury', allowedRoles: FINANCE, status: 'live',
      },
      {
        key: 'eta', section: 'eta', labelAr: 'ضرائب ETA', labelEn: 'ETA taxes',
        href: '/admin/accounting/eta', icon: 'tax', allowedRoles: FINANCE, status: 'live',
      },
      {
        key: 'receivables', section: 'receivables', labelAr: 'ذمم العملاء والموردين', labelEn: 'Receivables & payables',
        href: '/admin/accounting/receivables', icon: 'receivables', allowedRoles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE'], status: 'live',
      },
    ],
  },
  {
    key: 'hr',
    labelAr: 'الموارد البشرية',
    labelEn: 'Human resources',
    icon: 'employees',
    items: [
      {
        key: 'employees', section: 'employees', labelAr: 'الموظفون', labelEn: 'Employees',
        href: '/admin/employees', icon: 'employees', allowedRoles: MANAGERS, tabs: tabSet(employeesTabs), status: 'live',
      },
      {
        key: 'attendance', section: 'attendance', labelAr: 'الحضور والانصراف', labelEn: 'Attendance',
        href: '/admin/attendance', icon: 'attendance', allowedRoles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE'], status: 'live',
      },
      {
        key: 'payroll', section: 'payroll', labelAr: 'المرتبات والعمولات', labelEn: 'Payroll & commissions',
        href: '/admin/payroll', icon: 'payroll', allowedRoles: FINANCE, tabs: tabSet(payrollTabs), status: 'live',
      },
      {
        key: 'leave', section: 'leave', labelAr: 'السلف والجزاءات والإجازات', labelEn: 'Advances, penalties & leave',
        href: '/admin/leave', icon: 'leave', allowedRoles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE'], status: 'live',
      },
    ],
  },
  {
    key: 'reports',
    labelAr: 'التقارير',
    labelEn: 'Reports',
    icon: 'reports',
    items: [
      {
        key: 'reports', section: 'reports', labelAr: 'التقارير التحليلية', labelEn: 'Analytics',
        href: '/admin/reports', icon: 'reports', allowedRoles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE'], tabs: tabSet(reportsTabs), status: 'live',
      },
    ],
  },
  {
    key: 'website',
    labelAr: 'الموقع الإلكتروني',
    labelEn: 'Website',
    icon: 'content',
    allowedRoles: ['SUPER_ADMIN', 'BRANCH_MANAGER'],
    items: [
      {
        key: 'website-content', section: 'website-content', labelAr: 'البنرات والصفحات', labelEn: 'Banners & pages',
        href: '/admin/website/content', icon: 'content', allowedRoles: ['SUPER_ADMIN', 'BRANCH_MANAGER'], tabs: tabSet(websiteTabs), status: 'live',
      },
      {
        key: 'store-settings', section: 'store-settings', labelAr: 'إعدادات المتجر والدفع والشحن', labelEn: 'Store, payment & shipping settings',
        href: '/admin/website/store', icon: 'store-settings', allowedRoles: ['SUPER_ADMIN'], status: 'live',
      },
      {
        key: 'abandoned-carts', section: 'abandoned-carts', labelAr: 'السلات المتروكة', labelEn: 'Abandoned carts',
        href: '/admin/website/carts', icon: 'carts', allowedRoles: ['SUPER_ADMIN', 'BRANCH_MANAGER'], status: 'live',
      },
    ],
  },
  {
    key: 'settings',
    labelAr: 'الإعدادات',
    labelEn: 'Settings',
    icon: 'settings',
    allowedRoles: ['SUPER_ADMIN'],
    items: [
      {
        key: 'users', section: 'users', labelAr: 'المستخدمون', labelEn: 'Users',
        href: '/admin/users', icon: 'users', allowedRoles: ['SUPER_ADMIN'], status: 'live',
      },
      {
        key: 'roles', section: 'roles', labelAr: 'الأدوار والصلاحيات', labelEn: 'Roles & permissions',
        href: '/admin/users/roles', icon: 'roles', allowedRoles: ['SUPER_ADMIN'], status: 'live',
      },
      {
        key: 'branches-settings', section: 'branches-settings', labelAr: 'الفروع', labelEn: 'Branches',
        href: '/admin/branches', icon: 'branches', allowedRoles: ['SUPER_ADMIN'], status: 'live',
      },
      {
        key: 'system-settings', section: 'settings', labelAr: 'إعدادات النظام', labelEn: 'System settings',
        href: '/admin/settings', icon: 'settings', allowedRoles: ['SUPER_ADMIN'], tabs: tabSet(settingsTabs), status: 'live',
      },
      {
        key: 'audit', section: 'audit', labelAr: 'سجل النشاط', labelEn: 'Audit log',
        href: '/admin/audit', icon: 'audit', allowedRoles: ['SUPER_ADMIN'], status: 'live',
      },
      {
        key: 'backup', section: 'backup', labelAr: 'النسخ الاحتياطي', labelEn: 'Backup',
        href: '/admin/backup', icon: 'backup', allowedRoles: ['SUPER_ADMIN'], status: 'live',
      },
    ],
  },
] as const;

export function isRoleAllowed(
  allowedRoles: readonly AdminRole[] | undefined,
  role: AdminRole | undefined,
): boolean {
  return !allowedRoles || (!!role && allowedRoles.includes(role));
}

export function normalizeAdminPath(pathname: string | null | undefined): string {
  if (!pathname) return '/admin';
  const clean = pathname.replace(/^\/(?:ar|en)(?=\/|$)/, '') || '/';
  if (clean === '/') return '/admin';
  return clean.length > 1 ? clean.replace(/\/$/, '') : clean;
}

export function pathMatches(pathname: string, href: string): boolean {
  const current = normalizeAdminPath(pathname);
  const target = normalizeAdminPath(href);
  return current === target || (target !== '/admin' && current.startsWith(`${target}/`));
}

export function findAdminNavItem(pathname: string, role?: AdminRole): {
  group: AdminNavGroup;
  item: AdminNavItem;
  tab?: AdminTab;
} | null {
  const current = normalizeAdminPath(pathname);
  let result: { group: AdminNavGroup; item: AdminNavItem; tab?: AdminTab } | null = null;
  let bestLength = -1;

  for (const group of adminNavigation) {
    for (const item of group.items) {
      // A section the caller's role cannot open must not win the match, or the
      // breadcrumb would advertise a page the sidebar never offered them.
      if (!isRoleAllowed(item.allowedRoles, role)) continue;
      const candidates = [item, ...(item.tabs ?? [])];
      for (const candidate of candidates) {
        if (pathMatches(current, candidate.href) && candidate.href.length > bestLength) {
          bestLength = candidate.href.length;
          result = { group, item, tab: candidate === item ? undefined : candidate };
        }
      }
    }
  }
  return result;
}

export function findAdminItemBySection(section: string): { group: AdminNavGroup; item: AdminNavItem } | null {
  for (const group of adminNavigation) {
    const item = group.items.find((candidate) => candidate.section === section);
    if (item) return { group, item };
  }
  return null;
}

/**
 * Tabs for a section, filtered by role. The section tabs are a second surface
 * for the same permission decision the sidebar makes, so both must use this.
 */
export function getVisibleAdminTabs(section: string, role: AdminRole | undefined): readonly AdminTab[] {
  const entry = findAdminItemBySection(section);
  if (!entry || !isRoleAllowed(entry.item.allowedRoles, role)) return [];
  return entry.item.tabs ?? [];
}

export function getVisibleAdminGroups(role: AdminRole | undefined): readonly AdminNavGroup[] {
  return adminNavigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isRoleAllowed(item.allowedRoles, role)),
    }))
    .filter((group) => isRoleAllowed(group.allowedRoles, role) && group.items.length > 0);
}
