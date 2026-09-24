import React from 'react';
import Reveal from '@/components/storefront/Reveal';
import { prisma } from '@/lib/db';
import { Link } from '@/i18n/routing';
import {
  ClipboardList,
  Boxes,
  RotateCcw,
  Landmark,
  ReceiptText,
  HeartHandshake,
  BarChart3,
  Clock3,
  ShieldCheck,
  Globe2,
  MonitorPlay,
  Factory,
  ArrowLeft,
  ArrowRight,
  Cpu,
  Zap,
  Wifi,
  Banknote,
  PackageSearch,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

type Module = {
  icon: React.ReactNode;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  pointsAr: string[];
  pointsEn: string[];
  href: string;
  ctaAr: string;
  ctaEn: string;
};

const MODULES: Module[] = [
  {
    icon: <MonitorPlay className="w-6 h-6 text-amber-400" />,
    titleAr: 'نقطة البيع السريعة (POS)',
    titleEn: 'Point of Sale (POS)',
    descAr:
      'كاشير متطور ومخصص للأجهزة اللوحية (التابلت) والشاشات اللمسية: مسح باركود، بحث فوري، نافذة دفع مستقلة، فئات كاش ذكية، وحفظ فواتير الأوفلاين محلياً.',
    descEn:
      'Advanced tablet-optimized cashier terminal: barcode scanning, instant search, dedicated checkout modal, smart cash denominations, and local offline persistence.',
    pointsAr: ['وردية مفتوحة لكل كاشير مع رصيد افتتاحي محمي', 'حفظ الفواتير محلياً (Offline Queue) والمزامنة الفورية', 'طباعة إيصالات حرارية 80mm وإيصالات ضريبية'],
    pointsEn: ['Per-cashier shifts with protected opening float', 'Local offline queue with automatic sync', '80mm thermal receipt printing and tax invoices'],
    href: '/pos',
    ctaAr: 'افتح شاشة الكاشير (POS)',
    ctaEn: 'Launch POS Terminal',
  },
  {
    icon: <ClipboardList className="w-6 h-6 text-blue-400" />,
    titleAr: 'إدارة الطلبات (أونلاين / كاشير / واتساب)',
    titleEn: 'Orders (Online / POS / WhatsApp)',
    descAr:
      'طلبات المتجر الإلكتروني وطلبات الكاشير والطلبات الهاتفية في مكان واحد: حالات تنفيذ الطلب، شحن جاهز، تسليم COD، وتتبع لحظي للعميل.',
    descEn:
      'Online, POS and phone orders in one unified hub: fulfillment states, ready-to-ship, COD delivery, and live customer tracking.',
    pointsAr: ['تكامل شحن فعلي مع (Bosta + Mylerz)', 'صفحة تتبع حية للعميل مع جدول زمني للطلب', 'طباعة بوليصة الشحن وتسوية متحصلات الدفع عند الاستلام'],
    pointsEn: ['Real shipping integrations with Bosta & Mylerz', 'Live customer tracking timeline', 'Shipping label printing and COD reconciliation'],
    href: '/admin/orders',
    ctaAr: 'استعراض شاشة الطلبات',
    ctaEn: 'View Orders Manager',
  },
  {
    icon: <Boxes className="w-6 h-6 text-emerald-400" />,
    titleAr: 'المخزون المتعدد والفروع',
    titleEn: 'Multi-Branch Inventory',
    descAr:
      'مخزون مستقل لكل فرع، تحويلات بين الفروع، تنبيه انخفاض المخزون، جرد دوري (Stocktake) مع تسوية الفروقات آلياً، وطباعة باركودات المنتجات.',
    descEn:
      'Independent per-branch stock, inter-branch transfers, low-stock alerts, periodic stocktaking with auto-variance, and barcode printing.',
    pointsAr: ['تحويل كميات بين الفروع مع تسجيل محاسبي', 'معالج الجرد الفعلي (Wizard) مع حساب العجز والزيادة', 'كتالوج متكامل مع تتبع الألوان والمقاسات'],
    pointsEn: ['Inter-branch stock transfers with accounting trail', 'Stocktake wizard calculating variance', 'Variant catalog tracking sizes and colors'],
    href: '/admin/inventory',
    ctaAr: 'شاشة المخزون والجرد',
    ctaEn: 'Manage Inventory & Stock',
  },
  {
    icon: <RotateCcw className="w-6 h-6 text-orange-400" />,
    titleAr: 'المرتجعات والاستبدال (RMA)',
    titleEn: 'Returns & Exchange (RMA)',
    descAr:
      'نظام مرتجعات متكامل: إرجاع أو استبدال فوري بفرق سعر من الكاشير، بوابة إرجاع ذاتية للعميل، إعادة المخزون أولاً، وإشعارات دائنة للمحاسبة.',
    descEn:
      'Complete returns engine: cashier returns and price-difference exchanges, self-service customer portal, restock-first logic, and credit notes.',
    pointsAr: ['تصنيف أسباب المرتجع (مقاس غير مناسب، عيب صناعة...)', 'معالج استبدال سريع في الـ POS بحساب فرق السعر', 'استرداد إلكتروني Paymob/Fawry مع إشعار دائن'],
    pointsEn: ['Categorized return reasons (Size issue, defect...)', 'POS quick exchange wizard with price difference', 'Paymob/Fawry refunds and accounting credit notes'],
    href: '/admin/returns',
    ctaAr: 'إدارة المرتجعات والاستبدال',
    ctaEn: 'Returns & RMA Center',
  },
  {
    icon: <Clock3 className="w-6 h-6 text-amber-400" />,
    titleAr: 'الورديات ودرج النقدية (Shifts)',
    titleEn: 'Shifts & Cash Drawer',
    descAr:
      'فتح وردية برصيد افتتاحي لكل كاشير، منع البيع نهائياً خارج الوردية، مقارنة النقدية المتوقعة بالمعدود الفعلي، وتسوية وإغلاق إداري من لوحة التحكم.',
    descEn:
      'Cash drawer session per cashier, strict POS selling gate, expected vs counted cash variance, and manager administrative reconciliation.',
    pointsAr: ['حماية صارمة: لا يمكن إصدار فاتورة بدون وردية مفتوحة', 'جرد تلقائي للنقدية والمبيعات والمرتجعات المستردة كاش', 'طباعة تقرير تقفيل الدرج (Z-Report) وتسوية الإدارة'],
    pointsEn: ['Strict shift gate: no sales outside an open session', 'Automatic audit of cash sales, floats and cash refunds', 'Z-Report printout and administrative close'],
    href: '/admin/shifts',
    ctaAr: 'إدارة الورديات وتقارير الدرج',
    ctaEn: 'Shifts & Cash Drawer',
  },
  {
    icon: <Landmark className="w-6 h-6 text-emerald-300" />,
    titleAr: 'الحسابات و P&L والربحية',
    titleEn: 'Accounting & P&L',
    descAr:
      'إدارة المصروفات التشغيلية، حساب الأرباح الصافية لكل فرع، تسوية تحصيل مناديب الشحن (COD)، وسجل مالي موثق لكل حركة نقدية.',
    descEn:
      'Operating expenses, net P&L per branch, courier COD settlements, and an audit trail of every monetary movement.',
    pointsAr: ['صافي ربح حقيقي بعد خصم تكلفة البضاعة والمرتجعات والمصروفات', 'تسوية تحصيل الشحن COD ومطابقة كشوف المناديب', 'مصروفات مرتبطة بالفروع والأقسام مع تصنيف مالي'],
    pointsEn: ['True net profit after COGS, returns, and OPEX', 'Courier COD settlement and remittance matching', 'Branch-scoped categorized expenses'],
    href: '/admin/accounting',
    ctaAr: 'شاشة الحسابات والأرباح',
    ctaEn: 'Accounting & Finance',
  },
  {
    icon: <ReceiptText className="w-6 h-6 text-rose-400" />,
    titleAr: 'منظومة الفاتورة الإلكترونية (ETA)',
    titleEn: 'E-Invoicing (ETA Compliance)',
    descAr:
      'إصدار فواتير وإيصالات إلكترونية متوافقة مع مصلحة الضرائب المصرية، دعم أكواد GS1 لكل صنف، وإعادة إرسال الفواتير غير الصالحة آلياً.',
    descEn:
      'Egyptian Tax Authority (ETA) e-invoicing compliance, GS1 barcode per SKU, QR code generation, and automated retry pipeline.',
    pointsAr: ['توليد رمز الاستجابة السريعة QR المتوافق مع متطلبات الضرائب', 'متابعة الفواتير المعتمدة والمرفوضة وطابور إعادة المحاولة', 'إشعارات دائنة ضريبية للمرتجعات والاستبدال'],
    pointsEn: ['Tax-compliant QR code on invoices', 'Retry queue for invalid receipts with status tracking', 'Automated tax credit notes on returns'],
    href: '/admin/accounting',
    ctaAr: 'متابعة الضرائب والفواتير',
    ctaEn: 'ETA Invoicing Hub',
  },
  {
    icon: <HeartHandshake className="w-6 h-6 text-indigo-400" />,
    titleAr: 'العملاء، الولاء، والكوبونات',
    titleEn: 'Customers, Loyalty & Coupons',
    descAr:
      'سجل عملاء موحد يربط مشتريات المتجر والـ POS، اكتساب واستبدال نقاط الولاء بلمسة واحدة، كوبونات ترويجية بنسبة أو مبلغ ثابت، وخصومات المدير بـ PIN.',
    descEn:
      'Unified customer directory linking storefront and POS, 1-tap loyalty points redemption, percentage and fixed promo coupons, and manager PIN discounts.',
    pointsAr: ['نقاط ولاء تكتسب وتستبدل في الكاشير والمتجر', 'كوبونات ترويجية مع قيود الاستخدام وسقف الخصم', 'حفظ عناوين العملاء لسرعة إتمام الطلبات'],
    pointsEn: ['Earn and redeem loyalty points in POS & online', 'Promo coupon campaigns with caps and limits', 'Saved delivery addresses for fast checkout'],
    href: '/admin/coupons',
    ctaAr: 'الكوبونات وبرامج الخصم',
    ctaEn: 'Coupons & Loyalty',
  },
  {
    icon: <BarChart3 className="w-6 h-6 text-blue-500" />,
    titleAr: 'التقارير المتقدمة وتصدير CSV',
    titleEn: 'Reports & Analytics',
    descAr:
      'لوحة مؤشرات أداء KPI حية، شارت إيرادات، تقارير ربحية الأصناف، أداء الكاشيرية، تكاليف الشحن، تقرير الأصناف الراكدة، وتصدير إكسل بنقرة زر.',
    descEn:
      'Live KPI dashboard, revenue charts, product profitability, cashier performance, shipping costs, dead-stock analysis, and 1-click CSV exports.',
    pointsAr: ['إيرادات وأرباح يومية وأسبوعية وشهرية لكل فرع', 'تحليل الأصناف الراكدة التي لم تبع خلال 60 يوماً', 'تصدير كامل لكافة التقارير بصيغة CSV لإكسل'],
    pointsEn: ['Daily/weekly/monthly revenue and margin per branch', 'Dead stock detection for unsold SKUs', '1-click CSV export ready for Excel'],
    href: '/admin/reports',
    ctaAr: 'شاشة التقارير وتصدير CSV',
    ctaEn: 'Reports & Analytics',
  },
  {
    icon: <Factory className="w-6 h-6 text-slate-300" />,
    titleAr: 'المشتريات وإدارة الموردين',
    titleEn: 'Purchasing & Suppliers',
    descAr:
      'أوامر شراء معتمدة، استلام جزئي أو كلي مع تسوية الأسعار، مرتجعات البضاعة للموردين، وسجل مدفوعات وسداد أرصدة الموردين.',
    descEn:
      'Purchase orders, partial and full receives with cost reconciliation, supplier returns, and supplier payment ledger.',
    pointsAr: ['دورة أمر الشراء من المسودة حتى الاستلام والاعتماد', 'تسجيل مدفوعات الموردين النقدية والبنكية', 'ربط تكلفة الشراء بتسعير وربحية المنتجات'],
    pointsEn: ['Full purchase order lifecycle from draft to received', 'Supplier payment recording (cash/transfer)', 'Cost tracking linked to product profitability'],
    href: '/admin/purchasing',
    ctaAr: 'إدارة المشتريات والموردين',
    ctaEn: 'Purchasing & Suppliers',
  },
  {
    icon: <ShieldCheck className="w-6 h-6 text-teal-400" />,
    titleAr: 'المستخدمون والصلاحيات والأمان',
    titleEn: 'RBAC Security & Permissions',
    descAr:
      'صلاحيات محددة بدقة (مدير عام، مدير فرع، محاسب، كاشير)، حماية كافة مسارات الـ API عبر مصفوفة RBAC صارمة، وجلسات مؤمنة بـ JWT.',
    descEn:
      'Granular roles (Super Admin, Branch Manager, Finance, Cashier), full RBAC matrix guarding all APIs and pages, and hardened JWT sessions.',
    pointsAr: ['حماية خاصة لـ POS الكاشير حسب الفرع المخصص له', 'تقييد معدلات الطلبات (Rate Limiting) لحماية التتبع والرفع', 'سجل عمليات وتشفير أسرار النظام'],
    pointsEn: ['Branch-scoped authorization for cashiers', 'Rate limiting protecting tracking and uploads', 'Secure encrypted configuration storage'],
    href: '/admin/users',
    ctaAr: 'إدارة المستخدمين والأدوار',
    ctaEn: 'Users & Permissions',
  },
  {
    icon: <Globe2 className="w-6 h-6 text-fuchsia-400" />,
    titleAr: 'المتجر الإلكتروني B2C',
    titleEn: 'Bilingual Storefront',
    descAr:
      'متجر عصري ثنائي اللغة بالكامل (عربي / إنجليزي): كتالوج رياضي مصنف، عائلات مقاسات وألوان، سلة شراء سريعة، تقييمات معتمدة، وقائمة رغبات.',
    descEn:
      'Modern bilingual storefront: categorized sports catalog, size/color variant families, fast cart, approval-gated reviews, and customer wishlist.',
    pointsAr: ['طلب سريع عبر واتساب مدمج بضغطة زر واحدة', 'توصيل للمنزل أو استلام مجاني من أقرب فرع', 'بوابة حساب عميل لمتابعة الطلبات ونقاط الولاء والعناوين'],
    pointsEn: ['1-tap WhatsApp direct order flow', 'Home delivery or free in-branch pickup', 'Customer portal for orders, loyalty and addresses'],
    href: '/catalog',
    ctaAr: 'تصفح المتجر والكتالوج',
    ctaEn: 'Explore Storefront',
  },
];

const QUICK = [
  { icon: <MonitorPlay className="w-5 h-5 text-amber-400" />, ar: 'كاشير POS', en: 'POS Terminal', href: '/pos' },
  { icon: <Boxes className="w-5 h-5 text-emerald-400" />, ar: 'المخزون والجرد', en: 'Inventory & Stock', href: '/admin/inventory' },
  { icon: <Clock3 className="w-5 h-5 text-amber-400" />, ar: 'الورديات والدرج', en: 'Cashier Shifts', href: '/admin/shifts' },
  { icon: <RotateCcw className="w-5 h-5 text-orange-400" />, ar: 'المرتجعات (RMA)', en: 'Returns & RMA', href: '/admin/returns' },
  { icon: <HeartHandshake className="w-5 h-5 text-indigo-400" />, ar: 'الولاء والكوبونات', en: 'Loyalty & Coupons', href: '/admin/coupons' },
  { icon: <BarChart3 className="w-5 h-5 text-blue-400" />, ar: 'التقارير والأرباح', en: 'Reports & P&L', href: '/admin/reports' },
];

export default async function FeaturesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isAr = locale === 'ar';

  const [branchCount, productCount, categoryCount, userCount] = await Promise.all([
    prisma.branch.count(),
    prisma.product.count(),
    prisma.category.count(),
    prisma.user.count(),
  ]);

  const stats = [
    { value: branchCount, labelAr: 'فروع مرتبطة في النظام', labelEn: 'linked branches' },
    { value: productCount, labelAr: 'صنف في الكتالوج', labelEn: 'catalog products' },
    { value: categoryCount, labelAr: 'تصنيفات رئيسية', labelEn: 'categories' },
    { value: userCount, labelAr: 'مستخدم يعمل على النظام', labelEn: 'team accounts' },
  ];

  return (
    <main className="flex-1 pb-20">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,0.25),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(245,166,35,0.15),transparent_55%)]" />
        <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-12 text-center">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
            <Cpu className="w-3.5 h-3.5" />
            {isAr ? 'نظام إدارة متكامل ERP — الرياضة السكندرية' : 'All-in-one ERP for Sports Retail'}
          </span>
          <h1 className="mt-5 text-3xl sm:text-5xl font-black text-slate-100 leading-tight">
            {isAr ? 'كل منظومة تجارتك في شاشة واحدة' : 'Your Whole Business in One System'}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base text-slate-400 leading-relaxed">
            {isAr
              ? 'من لحظة البيع في كاشير التابلت أو المتجر، مروراً بالمخزون والمرتجعات والضرائب، حتى تقارير الأرباح — كل حركة مسجلة ومتوافقة محاسبياً ولحظياً.'
              : 'From tablet POS or online checkout, through inventory, returns and e-invoicing, to profit reports — fully reconciled in real time.'}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3 text-xs font-bold">
            <Link
              href="/pos"
              className="px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-xl shadow-amber-500/25 inline-flex items-center gap-2 transition-all font-black text-sm"
            >
              <MonitorPlay className="w-4 h-4" />
              <span>{isAr ? 'شغل كاشير الـ POS الآن' : 'Launch POS Terminal'}</span>
            </Link>
            <Link
              href="/admin"
              className="px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 inline-flex items-center gap-2 transition-all font-bold text-sm"
            >
              <span>{isAr ? 'لوحة التحكم الإدارية' : 'Admin Dashboard'}</span>
              {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </Link>
          </div>

          {/* Quick interactive strip */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {QUICK.map((q, i) => (
              <Reveal key={i} delay={i * 50}>
                <Link
                  href={q.href}
                  className="glass-card p-4 rounded-2xl border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900 flex flex-col items-center gap-2 text-center transition-all group active:scale-95"
                >
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 group-hover:border-amber-500/40 transition-colors">
                    {q.icon}
                  </div>
                  <span className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                    {isAr ? q.ar : q.en}
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="max-w-6xl mx-auto px-4 mt-6">
        <Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s, i) => (
              <div key={i} className="glass-panel p-6 rounded-2xl border border-slate-800 text-center">
                <div className="text-3xl font-black text-amber-400 tabular-nums">{s.value}</div>
                <div className="mt-1 text-xs font-semibold text-slate-400">{isAr ? s.labelAr : s.labelEn}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* MODULES WITH DIRECT LINKS */}
      <section className="max-w-6xl mx-auto px-4 mt-16">
        <Reveal>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-100">
              {isAr ? 'وحدات المنظومة ومميزات النظام' : 'System Modules & Features'}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {isAr ? '12 وحدة تشغيلية متكاملة — اضغط على أي وحدة لتجربتها مباشرة' : '12 integrated modules — click any module to open directly'}
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {MODULES.map((m, i) => (
            <Reveal key={i} delay={Math.min(i * 40, 300)}>
              <div className="glass-card h-full p-5 rounded-3xl border border-slate-800 hover:border-amber-500/40 transition-all duration-300 flex flex-col justify-between bg-slate-950/60 shadow-lg">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">
                      {m.icon}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                      وحدة جاهزة ✓
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-black text-slate-100">{isAr ? m.titleAr : m.titleEn}</h3>
                    <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{isAr ? m.descAr : m.descEn}</p>
                  </div>

                  <ul className="space-y-1.5 pt-2 border-t border-slate-800/60">
                    {(isAr ? m.pointsAr : m.pointsEn).map((p, j) => (
                      <li key={j} className="flex items-start gap-2 text-[11px] font-semibold text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Direct Action Link */}
                <Link
                  href={m.href}
                  className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-black text-amber-400 hover:text-amber-300 group transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{isAr ? m.ctaAr : m.ctaEn}</span>
                  </span>
                  {isAr ? (
                    <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" />
                  ) : (
                    <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  )}
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* WHY CHOOSE THIS SYSTEM */}
      <section className="max-w-6xl mx-auto px-4 mt-20">
        <Reveal>
          <div className="glass-panel p-8 sm:p-12 rounded-3xl border border-amber-500/25 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950/40">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                  {isAr ? 'لماذا تختار هذا النظام لمتجرك؟' : 'Why Choose This ERP?'}
                </span>
                <h2 className="mt-4 text-2xl sm:text-3xl font-black text-slate-100">
                  {isAr ? 'سرعة فائقة، أمان أوفلاين، وجاهز للضرائب المصرية' : 'High Speed, Offline Safe, Tax Ready'}
                </h2>
                <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                  {isAr
                    ? 'وفر تكاليف البرامج المنفصلة وتشتت الدفاتر. نظام واحد يدير الكاشير والمخازن والمرتجعات والحسابات بضغطة زر وبدون تعقيد.'
                    : 'Consolidate multiple disconnected tools into one fast, reliable, tax-compliant system.'}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    icon: <Zap className="w-5 h-5 text-amber-400" />,
                    t: isAr ? 'أسرع 5× في الأداء' : '5× Faster',
                    d: isAr ? 'اتصال مباشر بقاعدة البيانات: لوجن في ~0.2 ثانية' : 'Direct DB pool: ~0.2s login',
                  },
                  {
                    icon: <Wifi className="w-5 h-5 text-blue-400" />,
                    t: isAr ? 'يعمل بدون إنترنت' : 'Offline Safe',
                    d: isAr ? 'فواتير الكاشير تُحفظ محلياً وتُزامن فور عودة النت' : 'Local storage offline queue auto-syncs',
                  },
                  {
                    icon: <Banknote className="w-5 h-5 text-emerald-400" />,
                    t: isAr ? 'مدفوعات ومرتجعات' : 'Payments & RMA',
                    d: isAr ? 'كاش، فيزا، انستاباي، فوري، ومحفظة إلكترونية' : 'Cash, Card, InstaPay, Fawry, Wallets',
                  },
                  {
                    icon: <PackageSearch className="w-5 h-5 text-rose-400" />,
                    t: isAr ? 'بوالص شحن وتتبع' : 'Shipping & Tracking',
                    d: isAr ? 'تكامل مع Bosta و Mylerz وتتبع بالهاتف' : 'Bosta and Mylerz integration',
                  },
                ].map((c, i) => (
                  <div key={i} className="rounded-2xl bg-slate-950/60 border border-slate-800 p-4">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center mb-2.5">
                      {c.icon}
                    </div>
                    <div className="font-bold text-xs text-slate-200">{c.t}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{c.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}