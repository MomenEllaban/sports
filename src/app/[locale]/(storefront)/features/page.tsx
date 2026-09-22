import React from 'react';
import Reveal from '@/components/storefront/Reveal';
import { prisma } from '@/lib/db';
import { Link } from '@/i18n/routing';
import {
  ClipboardList,
  ShoppingCart,
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
  Users,
  PackageSearch,
  CheckCircle2,
  Gem,
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
};

const MODULES: Module[] = [
  {
    icon: <MonitorPlay className="w-6 h-6 text-amber-400" />,
    titleAr: 'نقطة البيع (POS)',
    titleEn: 'Point of Sale (POS)',
    descAr:
      'كاشير احترافي مخصص لمتاجر الرياضة: مسح باركود، بحث فوري، خصومات يدوية وكوبونات، تحويل فضة ورديات (فتح/غلق الدرج)، وحفظ الفواتير محلياً عند انقطاع النت.',
    descEn:
      'A professional cashier terminal built for sports retail: barcode scanning, instant search, manual discounts & coupons, open/close cash drawer shifts, and offline-safe invoicing.',
    pointsAr: ['وردية مفتوحة لكل كاشير مع رصيد افتتاحي', 'فرت الماء (Offline Queue) يحفظ الفاتورة ويواكبها تلقائياً', 'فواتير برقم + متوافقة مع منظومة الضرائب'],
    pointsEn: ['Per-cashier shifts with opening float', 'Offline queue stores invoices and auto-syncs', 'Numbered, tax-compliant receipts'],
  },
  {
    icon: <ClipboardList className="w-6 h-6 text-blue-400" />,
    titleAr: 'إدارة الطلبات (أونلاين / كاشير / واتساب)',
    titleEn: 'Orders (Online / POS / WhatsApp)',
    descAr:
      'طلبات المتجر الإلكتروني وطلبات الكاشير والوافد بهاتف في مكان واحد: حالات اكتمال، شحن جاهز، تسليم COD، وتتبع للعميل لحظة بلحظة.',
    descEn:
      'Online, POS and phone orders in one place: fulfilment states, ready-to-ship, COD delivery, and live customer tracking.',
    pointsAr: ['تكامل شحن فعلي (Bosta + Mylerz)', 'حالة تتبع تظهر للعميل في صفحة "تبع طلبك"', 'طباعة بوليصة + تسليم واستلام COD'],
    pointsEn: ['Real courier integrations (Bosta + Mylerz)', 'Status timeline shown on the customer tracking page', 'Shipping label print + COD pickup'],
  },
  {
    icon: <Boxes className="w-6 h-6 text-emerald-400" />,
    titleAr: 'المخزون والفروع',
    titleEn: 'Multi-Branch Inventory',
    descAr:
      'مخزون منفصل لكل فرع، تحويلات بين الفروع، تنبيه انخفاض المخزون، جرد دوري (Stocktake)، وباركودات طباعة للرفوف.',
    descEn:
      'Per-branch stock, inter-branch transfers, low-stock alerts, periodic stocktaking, and printable shelf barcode labels.',
    pointsAr: ['نقل الكميات بين الفروع محاسبي الحسم', 'جرد بالعرب (Wizard) مع فروقات تلقائية', '384 صنفاً مع أصناف متعددة والأهلية'],
    pointsEn: ['Accounted stock transfers between branches', 'Guided stocktake wizard with auto-differences', 'Multi-variant catalog with eligibility tracking'],
  },
  {
    icon: <RotateCcw className="w-6 h-6 text-orange-400" />,
    titleAr: 'المرتجعات والاستبدال (RMA)',
    titleEn: 'Returns & Exchange (RMA)',
    descAr:
      'نظام مرتجعات متكامل: ارجاع من الكاشير، استبدال بفرق سعر، أو استرداد، مع خصم تلقائي من المخزون وإرجاع للأهبة (Restock-First) وإشعار ائتمان.',
    descEn:
      'A complete returns engine: cashier returns, exchange with price difference or refund, automatic restock-first inventory reversal and credit notes.',
    pointsAr: ['أسباب مرتجعات مُصنفة (SIZE_ISSUE…) مع تقرير إبراز', 'متابعة لكل حالة حتى المعالجة (Outbox)', 'استرداد عبر Paymob/Fawry + إشعار ائتمان للمحاسب'],
    pointsEn: ['Categorized return causes (SIZE_ISSUE…) with highlight report', 'Per-case follow-up until resolution (Outbox)', 'Paymob/Fawry refunds + accountant credit note'],
  },
  {
    icon: <Landmark className="w-6 h-6 text-emerald-300" />,
    titleAr: 'الحسابات و P&L',
    titleEn: 'Accounting & P&L',
    descAr:
      'مصاريف، أرباح تقريبية لكل فرع، تسوية تحصيل نقدي (COD)، مدفوعات موردين، ومراجعة شاملة لكل حركة حسابية.',
    descEn:
      'Expenses, per-branch P&L, COD settlement, supplier payments, and a full audit trail of every money movement.',
    pointsAr: ['أرباح فعلية بعد احتساب التكلفة والمرتجعات', 'تسوية COD بين المندوب والفروع', 'مصروفات مرتبطة بفرع بتاريخ وموظف'],
    pointsEn: ['True profit after COGS and returns', 'COD settlement between courier and branches', 'Branch-dated expenses with owner'],
  },
  {
    icon: <ReceiptText className="w-6 h-6 text-rose-400" />,
    titleAr: 'منظومة الضرائب (ETA)',
    titleEn: 'E-Invoicing (ETA)',
    descAr:
      'إصدار الفاتورة الإلكترونية المصرية تلقائياً مع GS1، ومتابعة مراحل الـ INVALID وإعادة الإرسال، وصندوق الضرائب كله تحت السيطرة.',
    descEn:
      'Automatic Egyptian e-invoice issuance with GS1, tracked INVALID retries and full tax compliance under control.',
    pointsAr: ['تكامل مع منظومة الضرائب المصرية فور توفر مفاتيح ETA', 'حالة كل فاتورة (مُقبولة/فاشلة/قيد الإعادة)', 'أرقام ضريبية للفروع قابلة للإعداد'],
    pointsEn: ['Egyptian Tax Authority integration (ready for ETA keys)', 'Every invoice status tracked (accepted/failed/retrying)', 'Per-branch tax numbers configurable'],
  },
  {
    icon: <HeartHandshake className="w-6 h-6 text-indigo-400" />,
    titleAr: 'العملاء والولاء',
    titleEn: 'Customers & Loyalty',
    descAr:
      'سجل عملاء كامل (محفوظ تواصل، عناوين محفوظة، طلبات سابقة)، نقاط ولاء، كوبونات وعروض، وتقييمات بعد الشراء.',
    descEn:
      'A full customer directory (contacts, saved addresses, order history), loyalty points, coupons & promos, and post-purchase reviews.',
    pointsAr: ['نقاط ولاء تصرف على خصومات', 'كوبونات (نسبة / مبلغ / شحن مجاني) مع PIN', 'تقييمات ومراجعات تنشر في المتجر'],
    pointsEn: ['Loyalty points redeemable as discounts', 'Coupons (percent/amount/free-shipping) with PIN', 'Reviews published on the storefront'],
  },
  {
    icon: <BarChart3 className="w-6 h-6 text-blue-500" />,
    titleAr: 'التقارير والتحليلات',
    titleEn: 'Reports & Analytics',
    descAr:
      'لوحة أرقام KPI ورسوم بيانية للإيرادات، تقارير ربحية وتقارير كاشير شاملة، وتصدير CSV لكل تقرير لحسابات أكسل اليدوية.',
    descEn:
      'A KPI dashboard with revenue charts, per-cashier and profitability reports, and one-click CSV export replacing manual Excel work.',
    pointsAr: ['إيرادات اليوم/الأسبوع/الشهر لكل فرع', 'أكثر المنتجات ربحاً والأصناف الراكدة', 'تصدير CSV لـ Excel خلال ثانية'],
    pointsEn: ['Daily/weekly/monthly revenue per branch', 'Top-grossing products and dead stock', 'One-click CSV to Excel export'],
  },
  {
    icon: <Clock3 className="w-6 h-6 text-cyan-400" />,
    titleAr: 'الورديات والدرج النقدي',
    titleEn: 'Shifts & Cash Drawer',
    descAr:
      'كل كاشير بيفتح ورديته برصيد افتتاحي ويقفلها بإقرار فعلي — المبيعات لا تتم إلا في وردية مفتوحة، وفرق النقدية يظهر فوراً.',
    descEn:
      'Every cashier opens their shift with a float and closes with a declaration — sales only happen on an open shift, differences surface instantly.',
    pointsAr: ['Gate إجباري: لا بيع خارج الوردية', 'تسوية متوقعة مقابل الفعلي عند الإغلاق', 'سجل تاريخي لكل وردية'],
    pointsEn: ['Hard gate: no sales outside an open shift', 'Expected vs declared reconciliation on close', 'Historical record of every shift'],
  },
  {
    icon: <ShieldCheck className="w-6 h-6 text-teal-400" />,
    titleAr: 'الصلاحيات والأمان',
    titleEn: 'Access Control & Security',
    descAr:
      'أدوار محددة (مدير / محاسب / كاشير) لكل شاشة وزر، حماية مسارات API، تقييد معدلات (Rate Limit)، وتبديل أمان عبر JWT.',
    descEn:
      'Granular role-based access (manager/accounting/cashier) on every screen and button, protected API routes, rate limiting and secure JWT sessions.',
    pointsAr: ['Matrix صلاحيات لكل endpoint', 'تقييد محاولات الوصول والتحميلات', 'جلسات آمنة ومنتهية الصلاحية'],
    pointsEn: ['Per-endpoint RBAC ~matrix enforced', 'Rate-limited endpoints and uploads', 'Expiring secure JWT sessions'],
  },
  {
    icon: <Globe2 className="w-6 h-6 text-fuchsia-400" />,
    titleAr: 'متجر إلكتروني مزدوج اللغة',
    titleEn: 'Bilingual Storefront',
    descAr:
      'متجر عربي/إنجليزي بالكامل: كتالوج أقسام، صفحة منتج، سلة، إتمام شراء بعناوين محفوظة، أمنيات، وتقييمات — كله على نطاق واحد.',
    descEn:
      'A fully Arabic/English store: categorized catalog, product pages, cart, checkout with saved addresses, wishlist and reviews — all on one domain.',
    pointsAr: ['سلة وعطل مشتركة مع طلب كاشير', 'اطلب واتساب مباشر بضغطة واحدة', 'استلام من الفرع بدون رسوم شحن'],
    pointsEn: ['Shared cart that also feeds POS orders', 'One-tap WhatsApp ordering', 'Free in-branch pickup'],
  },
  {
    icon: <Factory className="w-6 h-6 text-slate-300" />,
    titleAr: 'المشتريات والموردون',
    titleEn: 'Purchasing & Suppliers',
    descAr:
      'أوامر شراء برقم، استلام بفرق سعر، رجوع مورد (Supplier Return)، دفعات موردين، وربط كل صنف بأهلية الشراء.',
    descEn:
      'Numbered purchase orders, receives with price variance, supplier returns, supplier payments, and purchase eligibility tracking.',
    pointsAr: ['استلام جزئي/كلي مع اعتماد', 'رقم مرجعي لكل أمر توريد', 'دفعات جارية وتاريخية للمورد'],
    pointsEn: ['Partial or full receives with approval', 'Reference number for every PO', 'Current and historical supplier payments'],
  },
];

const QUICK = [
  { icon: <MonitorPlay className="w-5 h-5 text-amber-400" />, ar: 'كاشير POS', en: 'POS Terminal' },
  { icon: <Boxes className="w-5 h-5 text-emerald-400" />, ar: 'فروع متعددة بعرب', en: 'Multi-branch inventory' },
  { icon: <ReceiptText className="w-5 h-5 text-rose-400" />, ar: 'فواتير إلكترونية ETA', en: 'ETA e-invoicing' },
  { icon: <RotateCcw className="w-5 h-5 text-orange-400" />, ar: 'مرتجعات واستبدال', en: 'Returns & exchange' },
  { icon: <HeartHandshake className="w-5 h-5 text-indigo-400" />, ar: 'ولاء وكوبونات', en: 'Loyalty & coupons' },
  { icon: <Landmark className="w-5 h-5 text-emerald-300" />, ar: 'محاسبة وربحية', en: 'Accounting & P&L' },
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
    { value: categoryCount, labelAr: 'تصنيفات', labelEn: 'categories' },
    { value: userCount, labelAr: 'مستخدم يعمل على النظام', labelEn: 'team accounts' },
  ];

  const howToAr = ['سجّل وادخل على اللوحة', 'أضف أصناف وفروع', 'بيع من الكاشير أو المتجر', 'تتبع الأرباح والمرتجعات'];
  const howToEn = ['Sign in and open the dashboard', 'Add products and branches', 'Sell from the POS or the store', 'Track profit and returns'];

  return (
    <main className="flex-1 pb-20">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,0.25),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(245,166,35,0.15),transparent_55%)]" />
        <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-12 text-center">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
            <Cpu className="w-3.5 h-3.5" />
            {isAr ? 'نظام إدارة متكامل ERP — الرياضة الأخنبرية' : 'All-in-one ERP for Sports Retail'}
          </span>
          <h1 className="mt-5 text-3xl sm:text-5xl font-black text-slate-100 leading-tight">
            {isAr ? 'كل تجارتك في نظام واحد' : 'Your whole business on one system'}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base text-slate-400 leading-relaxed">
            {isAr
              ? 'من لحظة البيع في الكاشير أو المتجر، مروراً بالمخزون والمرتجعات والضرائب، حتى تقارير الأرباح — بتهجّب النتيجة كلها على Levantine واحدة. وداعاً للأعشاب والدفاتر الورقية.'
              : 'From the moment of sale at the POS or online, through inventory, returns and taxes, to profit reports — everything reconciles into one ledger. No more loose Excel files.'}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3 text-xs font-bold">
            <Link href="/admin" className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/25 inline-flex items-center gap-2 transition-all">
              <span>{isAr ? 'ادخل لوحة التحكم' : 'Open the Dashboard'}</span>
            </Link>
            <Link href="/catalog" className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 inline-flex items-center gap-2 transition-all">
              {isAr ? 'تصفح المتجر' : 'Browse the store'} {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </Link>
          </div>

          {/* quick strip */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {QUICK.map((q, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="glass-card p-4 rounded-2xl border border-slate-800 flex flex-col items-center gap-2 text-center">
                  {q.icon}
                  <span className="text-[11px] font-bold text-slate-200">{isAr ? q.ar : q.en}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="max-w-6xl mx-auto px-4">
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

      {/* MODULES */}
      <section className="max-w-6xl mx-auto px-4 mt-16">
        <Reveal>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-100">{isAr ? 'ما الذي يشمله النظام؟' : 'What the system covers'}</h2>
            <p className="mt-2 text-sm text-slate-400">{isAr ? '12 وحدة تعمل معاً كمنظومة واحدة' : '12 modules working as one system'}</p>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-2 gap-6">
          {MODULES.map((m, i) => (
            <Reveal key={i} delay={Math.min(i * 50, 300)}>
              <div className="glass-card h-full p-6 rounded-2xl border border-slate-800 hover:border-blue-500/40 transition-colors duration-300 flex flex-col gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">{m.icon}</div>
                <div>
                  <h3 className="text-lg font-black text-slate-100">{isAr ? m.titleAr : m.titleEn}</h3>
                  <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">{isAr ? m.descAr : m.descEn}</p>
                </div>
                <ul className="mt-auto space-y-1.5">
                  {(isAr ? m.pointsAr : m.pointsEn).map((p, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs font-semibold text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* WHY BUY */}
      <section className="max-w-6xl mx-auto px-4 mt-20">
        <Reveal>
          <div className="glass-panel p-8 sm:p-12 rounded-3xl border border-amber-500/25 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950/40">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                  {isAr ? 'لماذا تشتري هذا النظام؟' : 'Why choose this system?'}
                </span>
                <h2 className="mt-4 text-2xl sm:text-3xl font-black text-slate-100">
                  {isAr ? 'تحكم كامل، أرعب من النت، وجاهز للضرائب' : 'Full control, offline-safe, tax-ready'}
                </h2>
                <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                  {isAr
                    ? 'أوفر لك المصروفات الثابتة للأقزام، وأعطيك أداة واحدة تبيع وتشتري وتطلب وتدير. الفرق بين تقدير العميل والتجربة الحقيقية يظهر من أول وردية.'
                    : 'Cut the fixed cost of scattered tools. One instrument that sells, buys, returns and manages. The difference shows from the very first shift.'}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: <Zap className="w-5 h-5 text-amber-400" />, t: isAr ? 'أسرع 5×' : '5× faster', d: isAr ? 'وصل مباشر لقاعدة البيانات: لوجن ~0.3 ثانية' : 'Direct DB connection: ~0.3s login' },
                  { icon: <Wifi className="w-5 h-5 text-blue-400" />, t: isAr ? 'يشتغل بدون نت' : 'Offline-safe', d: isAr ? 'الفاتورة تحفظ محلياً وتتواكب تلقائياً' : 'Invoices store locally and auto-sync' },
                  { icon: <Banknote className="w-5 h-5 text-emerald-400" />, t: isAr ? 'مدفوعات حقيقية' : 'Real payments', d: isAr ? 'Paymob + Fawry وثبات مرتجعات' : 'Paymob + Fawry and refunds' },
                  { icon: <PackageSearch className="w-5 h-5 text-rose-400" />, t: isAr ? 'شحن وتتبع' : 'Shipping + tracking', d: isAr ? 'Bosta + Mylerz مع صفحة تتبع للعميل' : 'Bosta + Mylerz with customer tracking' },
                ].map((c, i) => (
                  <div key={i} className="rounded-2xl bg-slate-950/60 border border-slate-800 p-4">
                    <div className="flex items-center gap-2">{c.icon}<span className="text-sm font-black text-slate-100">{c.t}</span></div>
                    <p className="mt-1 text-xs text-slate-400">{c.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-6xl mx-auto px-4 mt-16">
        <Reveal>
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-100">{isAr ? 'تبدأ في 4 خطوات' : 'Start in 4 steps'}</h2>
          </div>
          <div className="grid sm:grid-cols-4 gap-4">
            {(isAr ? howToAr : howToEn).map((h, i) => (
              <div key={i} className="glass-card p-5 rounded-2xl border border-slate-800 text-center relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center">{i + 1}</div>
                <p className="mt-3 text-sm font-bold text-slate-200">{h}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* FINAL CTA */}
      <section className="max-w-6xl mx-auto px-4 mt-16">
        <Reveal>
          <div className="text-center glass-panel p-10 rounded-3xl border border-slate-800">
            <Gem className="w-8 h-8 text-amber-400 mx-auto" />
            <h2 className="mt-4 text-2xl font-black text-slate-100">{isAr ? 'جاهز تشغّل متجرك عليه؟' : 'Ready to run your store on it?'}</h2>
            <p className="mt-2 text-sm text-slate-400">{isAr ? 'لوحة التحكم مرفوعة الآن وكل الوحدات شغالة.' : 'The dashboard is live now and every module works.'}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/admin" className="px-8 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition-all shadow-lg shadow-amber-500/25">
                {isAr ? 'ادخل اللوحة الآن' : 'Open the dashboard'}
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}