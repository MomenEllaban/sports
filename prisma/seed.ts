import { PrismaClient, Role, SalaryType, OrderSource, ShippingProvider, PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Sports Champions (ابطال الرياضة الإبراهيمية) Database...');

  // 1. Clean existing records
  await prisma.taxInvoice.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.inventoryLog.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.address.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.payrollItem.deleteMany();
  await prisma.payrollRun.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  await prisma.stockTransferItem.deleteMany();
  await prisma.stockTransfer.deleteMany();
  await prisma.branchInventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.branch.deleteMany();

  // 2. Create Branches
  const ibrahimeyahBranch = await prisma.branch.create({
    data: {
      name: 'فرع الإبراهيمية (الرئيسي)',
      nameEn: 'Al Ibrahimeyah Flagship Branch',
      address: '92 شارع عمر لطفى، الإبراهيمية بحري، سيدي جابر، باب شرقي، الإسكندرية',
      addressEn: '92 Omar Lotfy St, Al Ibrahimeyah Bahri, Sidi Gaber, Bab Sharqi, Alexandria',
      phone: '03 5926908',
      city: 'Alexandria',
      workingHours: 'Sat–Wed 10am–10pm, Thu–Fri 10am–11pm',
      isActive: true,
    },
  });

  const smouhaBranch = await prisma.branch.create({
    data: {
      name: 'فرع سموحة',
      nameEn: 'Smouha Branch',
      address: 'شارع فوزي معاذ، أمام نادى سموحة، الإسكندرية',
      addressEn: 'Fawzy Moaz St, opposite Smouha Club, Alexandria',
      phone: '03 4200112',
      city: 'Alexandria',
      workingHours: 'Everyday 10am–11pm',
      isActive: true,
    },
  });

  console.log(`✅ Branches created: ${ibrahimeyahBranch.nameEn} & ${smouhaBranch.nameEn}`);

  // 3. Create Categories
  const catCardio = await prisma.category.create({
    data: {
      slug: 'cardio-fitness',
      nameAr: 'معدات اللياقة البدنية والكارديو',
      nameEn: 'Cardio & Fitness Equipment',
      description: 'مشايات كهربائية، عجل رياضي، وأجهزة لياقة بدنية منزلية واحترافية',
    },
  });

  const catSwimming = await prisma.category.create({
    data: {
      slug: 'swimming-gear',
      nameAr: 'مستلزمات الرياضات المائية والسباحة',
      nameEn: 'Swimming & Water Sports Gear',
      description: 'نظارات سباحة، كابات سيليكون، مايوهات وأدوات غوص',
    },
  });

  const catGymAccessories = await prisma.category.create({
    data: {
      slug: 'gym-accessories',
      nameAr: 'أدوات الجيم والإكسسوارات',
      nameEn: 'Gym Accessories & Training Gear',
      description: 'حبال TRX، قفازات، جريب جلد، وبلوك يوجا',
    },
  });

  const catApparelShoes = await prisma.category.create({
    data: {
      slug: 'apparel-footwear',
      nameAr: 'الملابس والأحذية الرياضية',
      nameEn: 'Sportswear & Specialty Shoes',
      description: 'أحذية باليه، كروكس طبي، ملابس تمرين وواقيات',
    },
  });

  const catProtection = await prisma.category.create({
    data: {
      slug: 'medical-protection',
      nameAr: 'الواقيات والأحزمة العلاجية',
      nameEn: 'Sports Medical & Protection',
      description: 'شرائط كينيسيو KT Tape، واقيات الهيب والوسط',
    },
  });

  // 4. Create Brands
  const brandCougar = await prisma.brand.create({
    data: { slug: 'cougar', nameAr: 'كوجار', nameEn: 'Cougar Fitness' },
  });

  const brandSpeedo = await prisma.brand.create({
    data: { slug: 'speedo', nameAr: 'سبيدو', nameEn: 'Speedo' },
  });

  const brandTRX = await prisma.brand.create({
    data: { slug: 'trx', nameAr: 'تي آر إكس', nameEn: 'TRX Training' },
  });

  const brandKTTape = await prisma.brand.create({
    data: { slug: 'kt-tape', nameAr: 'كا تي تيب', nameEn: 'KT Tape' },
  });

  const brandCrocs = await prisma.brand.create({
    data: { slug: 'crocs', nameAr: 'كروكس', nameEn: 'Crocs Sports' },
  });

  // 5. Create Products & Branch Inventories
  const productsData = [
    {
      sku: 'COU-TR-900',
      barcode: '622100011001',
      nameAr: 'مشاية كهربائية احترافية كوجار T-900 بمحرك 3.5 حصان',
      nameEn: 'Cougar Professional Treadmill T-900 (3.5 HP)',
      descriptionAr: 'مشاية كهربائية بموتور قوي، انحدار أوتوماتيكي، وشاشة LCD تعرض السرعة والسعرات ودقات القلب.',
      descriptionEn: 'Heavy duty motorized treadmill with automatic incline, LCD screen, heart rate sensors & AUX speakers.',
      price: 18500.0,
      costPrice: 14000.0,
      categoryId: catCardio.id,
      brandId: brandCougar.id,
      isFeatured: true,
      images: ['https://images.unsplash.com/photo-1576678927484-cc909957088c?auto=format&fit=crop&w=800&q=80'],
      stockIbrahimeyah: 4,
      stockSmouha: 2,
    },
    {
      sku: 'COU-BK-500',
      barcode: '622100011002',
      nameAr: 'عجلة رياضية مغناطيسية كوجار B-500 لشَدّ الجسم',
      nameEn: 'Cougar Magnetic Fitness Bike B-500',
      descriptionAr: 'عجلة ثابتة بمستويات مقاومة متعددة، كرسي مريح قابل للتعديل ومقاييس لياقة دقيقة.',
      descriptionEn: 'Magnetic stationary exercise bike with adjustable seat, multi-level resistance & digital monitor.',
      price: 6800.0,
      costPrice: 4900.0,
      categoryId: catCardio.id,
      brandId: brandCougar.id,
      isFeatured: true,
      images: ['https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80'],
      stockIbrahimeyah: 6,
      stockSmouha: 3,
    },
    {
      sku: 'SPD-CAP-SIL',
      barcode: '622100011003',
      nameAr: 'كاب سباحة سيليكون سبيدو أصلي',
      nameEn: 'Speedo Original Silicone Swimming Cap',
      descriptionAr: 'كاب سيليكون 100% مقاوم للماء وحافظ للشعر من الكلوور.',
      descriptionEn: '100% premium silicone swim cap providing ergonomic fit & chlorine protection.',
      price: 350.0,
      costPrice: 200.0,
      categoryId: catSwimming.id,
      brandId: brandSpeedo.id,
      isFeatured: true,
      images: ['https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=800&q=80'],
      stockIbrahimeyah: 45,
      stockSmouha: 30,
    },
    {
      sku: 'SWM-SNK-SET',
      barcode: '622100011004',
      nameAr: 'طقم ماسك وسنوركل للغوص والسباحة ضد التغبيش',
      nameEn: 'Anti-Fog Snorkeling Mask & Dry Snorkel Set',
      descriptionAr: 'ماسك زجاج مقوى مع أنبوب تنفس خشابي يمنع دخول الماء أثناء الغوص.',
      descriptionEn: 'Tempered glass mask with dry-top snorkel gear for crystal clear underwater vision.',
      price: 850.0,
      costPrice: 520.0,
      categoryId: catSwimming.id,
      brandId: brandSpeedo.id,
      isFeatured: false,
      images: ['https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80'],
      stockIbrahimeyah: 15,
      stockSmouha: 10,
    },
    {
      sku: 'TRX-PRO-KIT',
      barcode: '622100011005',
      nameAr: 'طقم أحزمة تمارين المعلقة TRX Pro Tactical',
      nameEn: 'TRX Pro Tactical Suspension Trainer Kit',
      descriptionAr: 'حبال تمارين مقاومة عالية التحمل مع مقبض مطاطي وحامل باب وحقيبة حمل.',
      descriptionEn: 'Complete bodyweight resistance suspension trainer set with door anchor and mesh bag.',
      price: 1450.0,
      costPrice: 900.0,
      categoryId: catGymAccessories.id,
      brandId: brandTRX.id,
      isFeatured: true,
      images: ['https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?auto=format&fit=crop&w=800&q=80'],
      stockIbrahimeyah: 22,
      stockSmouha: 12,
    },
    {
      sku: 'BLT-SH-CNV',
      barcode: '622100011006',
      nameAr: 'حذاء باليه احترافي قماش مزدوج النعل',
      nameEn: 'Professional Split-Sole Canvas Ballet Shoes',
      descriptionAr: 'حذاء باليه قماشي مريح مرن يناسب التدريبات العادية والعروض.',
      descriptionEn: 'Breathable canvas ballet slippers with split leather sole & pre-sewn cross elastics.',
      price: 420.0,
      costPrice: 240.0,
      categoryId: catApparelShoes.id,
      brandId: null,
      isFeatured: false,
      images: ['https://images.unsplash.com/photo-1518834107812-67b0b7c58434?auto=format&fit=crop&w=800&q=80'],
      stockIbrahimeyah: 35,
      stockSmouha: 20,
    },
    {
      sku: 'CRC-MED-CLG',
      barcode: '622100011007',
      nameAr: 'كروكس رياضي طبي مريح للتمارين والتنقل',
      nameEn: 'Crocs Specialist Athletic Medical Clog',
      descriptionAr: 'قباقيب كروكس مريحة للغاية ومقاومة للانزلاق ومناسبة للرياضيين والمدربين.',
      descriptionEn: 'Slip-resistant, cushioned athletic clogs built for maximum comfort and durability.',
      price: 1200.0,
      costPrice: 780.0,
      categoryId: catApparelShoes.id,
      brandId: brandCrocs.id,
      isFeatured: true,
      images: ['https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=800&q=80'],
      stockIbrahimeyah: 28,
      stockSmouha: 14,
    },
    {
      sku: 'KTT-PRO-5M',
      barcode: '622100011008',
      nameAr: 'شريط كينيسيو علاجي KT Tape Pro (5 متر)',
      nameEn: 'KT Tape Pro Kinesiology Therapeutic Tape 5M',
      descriptionAr: 'شريط علاجي لاصق لدعم العضلات والمفاصل أثناء التمرين وتقليل الآلام.',
      descriptionEn: '100% synthetic kinesiology tape for muscle pain relief & joint stability.',
      price: 490.0,
      costPrice: 290.0,
      categoryId: catProtection.id,
      brandId: brandKTTape.id,
      isFeatured: true,
      images: ['https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=800&q=80'],
      stockIbrahimeyah: 50,
      stockSmouha: 35,
    },
    {
      sku: 'NEO-HIP-CVR',
      barcode: '622100011009',
      nameAr: 'حزام وواقي وسط وهيب نيوباد حراري',
      nameEn: 'Neoprene Thermal Hip & Waist Cover Support',
      descriptionAr: 'واقي نيوباد حراري يساعد على التدفئة ودعم أسفل الظهر والوسط أثناء ألعاب القوى.',
      descriptionEn: 'Thermal compression waist belt and hip cover for core stability and sweat enhancement.',
      price: 380.0,
      costPrice: 210.0,
      categoryId: catProtection.id,
      brandId: null,
      isFeatured: false,
      images: ['https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80'],
      stockIbrahimeyah: 40,
      stockSmouha: 25,
    },
    {
      sku: 'GYM-GRP-WRP',
      barcode: '622100011010',
      nameAr: 'جريب جلدي لحماية الكف + داغية المعصم للكروس فيت والجيم',
      nameEn: 'Gym Leather Hand Grips & Wrist Wraps Combo',
      descriptionAr: 'واقي جلدي حقيقي مع شريط معصم لحماية الكف من التسلخات أثناء تمارين العقلة والبار.',
      descriptionEn: 'Genuine leather hand palm grips with integrated wrist wraps for pull-ups & deadlifts.',
      price: 320.0,
      costPrice: 170.0,
      categoryId: catGymAccessories.id,
      brandId: null,
      isFeatured: false,
      images: ['https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=80'],
      stockIbrahimeyah: 60,
      stockSmouha: 40,
    },
    {
      sku: 'GYM-GLV-PAD',
      barcode: '622100011011',
      nameAr: 'قفازات جيم مبطنة احترافية ضد التزحلق',
      nameEn: 'Heavy Duty Padded Non-Slip Gym Gloves',
      descriptionAr: 'قفازات تدريب جيم مع بطانة جل لحماية اليدين وتهوية ممتازة.',
      descriptionEn: 'Padded weightlifting gloves with breathable mesh and anti-slip silicone grip.',
      price: 290.0,
      costPrice: 150.0,
      categoryId: catGymAccessories.id,
      brandId: null,
      isFeatured: false,
      images: ['https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80'],
      stockIbrahimeyah: 45,
      stockSmouha: 30,
    },
    {
      sku: 'YGA-BLK-EVA',
      barcode: '622100011012',
      nameAr: 'بلوك يوجا كلاسيك بالفوم EVA عالي الكثافة',
      nameEn: 'High-Density EVA Foam Yoga Block',
      descriptionAr: 'مكعب يوجا خفيف الوزن ومتين لمساعدة الثبات والإطالات.',
      descriptionEn: 'Durable and supportive EVA foam block for yoga, pilates and stretching balance.',
      price: 180.0,
      costPrice: 95.0,
      categoryId: catGymAccessories.id,
      brandId: null,
      isFeatured: false,
      images: ['https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=800&q=80'],
      stockIbrahimeyah: 70,
      stockSmouha: 50,
    },
  ];

  for (const item of productsData) {
    const product = await prisma.product.create({
      data: {
        sku: item.sku,
        barcode: item.barcode,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        descriptionAr: item.descriptionAr,
        descriptionEn: item.descriptionEn,
        price: item.price,
        costPrice: item.costPrice,
        categoryId: item.categoryId,
        brandId: item.brandId,
        isFeatured: item.isFeatured,
        images: item.images,
      },
    });

    await prisma.branchInventory.createMany({
      data: [
        { branchId: ibrahimeyahBranch.id, productId: product.id, stockQuantity: item.stockIbrahimeyah, lowStockThreshold: 5 },
        { branchId: smouhaBranch.id, productId: product.id, stockQuantity: item.stockSmouha, lowStockThreshold: 5 },
      ],
    });
  }

  console.log(`✅ ${productsData.length} products and branch inventories seeded successfully!`);

  // 6. Create Staff Users & Employees
  const passwordHashAdmin = await bcrypt.hash('Admin@123456', 10);
  const passwordHashManager = await bcrypt.hash('Manager@123456', 10);
  const passwordHashCashier = await bcrypt.hash('Cashier@123456', 10);
  const passwordHashFinance = await bcrypt.hash('Finance@123456', 10);

  // Super Admin
  const adminUser = await prisma.user.create({
    data: {
      name: 'أحمد الإبراهيمي (المدير العام)',
      email: 'admin@sportschampions.eg',
      passwordHash: passwordHashAdmin,
      phone: '01001234567',
      role: Role.SUPER_ADMIN,
      branchIds: [ibrahimeyahBranch.id, smouhaBranch.id],
    },
  });

  // Branch Manager
  const managerUser = await prisma.user.create({
    data: {
      name: 'محمود سلامة (مدير الفرع)',
      email: 'manager.ibrahimeyah@sportschampions.eg',
      passwordHash: passwordHashManager,
      phone: '01223456789',
      role: Role.BRANCH_MANAGER,
      branchIds: [ibrahimeyahBranch.id],
    },
  });

  const managerEmployee = await prisma.employee.create({
    data: {
      userId: managerUser.id,
      name: managerUser.name,
      phone: managerUser.phone!,
      roleTitle: 'Branch Manager - Al Ibrahimeyah',
      salary: 12000.0,
      salaryType: SalaryType.MONTHLY,
      commissionRate: 0.02,
      branchId: ibrahimeyahBranch.id,
    },
  });

  // Cashier
  const cashierUser = await prisma.user.create({
    data: {
      name: 'سارة فهمي (كاشير الإبراهيمية)',
      email: 'cashier.ibrahimeyah@sportschampions.eg',
      passwordHash: passwordHashCashier,
      phone: '01112345678',
      role: Role.CASHIER,
      branchIds: [ibrahimeyahBranch.id],
    },
  });

  const cashierEmployee = await prisma.employee.create({
    data: {
      userId: cashierUser.id,
      name: cashierUser.name,
      phone: cashierUser.phone!,
      roleTitle: 'POS Cashier - Al Ibrahimeyah',
      salary: 6500.0,
      salaryType: SalaryType.MONTHLY,
      commissionRate: 0.01,
      branchId: ibrahimeyahBranch.id,
    },
  });

  // Finance Role
  const financeUser = await prisma.user.create({
    data: {
      name: 'طارق عبد العزيز (مدير الحسابات)',
      email: 'finance@sportschampions.eg',
      passwordHash: passwordHashFinance,
      phone: '01009998877',
      role: Role.FINANCE,
      branchIds: [ibrahimeyahBranch.id, smouhaBranch.id],
    },
  });

  console.log(`✅ Staff users seeded (Admin, Manager, Cashier, Finance).`);

  // 7. Seed Sample Customer & Sample Order
  const sampleCustomer = await prisma.customer.create({
    data: {
      phone: '01098765432',
      name: 'عمرو حسني',
      email: 'amr.hosny@gmail.com',
      loyaltyPoints: 120,
      addresses: {
        create: {
          title: 'المنزل',
          street: '15 شارع سوريا، رشدي',
          building: 'عمارة الأمل، الشقة 402',
          city: 'الإسكندرية',
          governorate: 'الإسكندرية',
          isDefault: true,
        },
      },
    },
  });

  const speedoCap = await prisma.product.findUnique({ where: { sku: 'SPD-CAP-SIL' } });
  const trxKit = await prisma.product.findUnique({ where: { sku: 'TRX-PRO-KIT' } });

  if (speedoCap && trxKit) {
    const sampleOrder = await prisma.order.create({
      data: {
        orderNumber: 'ORD-2026-001',
        orderSource: OrderSource.ONLINE,
        customerId: sampleCustomer.id,
        guestPhone: '01098765432',
        guestName: 'عمرو حسني',
        deliveryAddress: '15 شارع سوريا، رشدي، الإسكندرية',
        branchId: ibrahimeyahBranch.id,
        deliveryZone: 'Alexandria East',
        deliveryFee: 35.0,
        shippingProvider: ShippingProvider.BOSTA,
        trackingNumber: 'BST-ALX-98210',
        paymentMethod: PaymentMethod.COD,
        paymentStatus: PaymentStatus.PENDING,
        orderStatus: OrderStatus.CONFIRMED,
        subtotal: 1800.0,
        taxAmount: 252.0,
        totalAmount: 2087.0,
        items: {
          create: [
            { productId: speedoCap.id, unitPrice: 350.0, quantity: 1, totalPrice: 350.0 },
            { productId: trxKit.id, unitPrice: 1450.0, quantity: 1, totalPrice: 1450.0 },
          ],
        },
      },
    });

    console.log(`✅ Sample online order created: ${sampleOrder.orderNumber}`);
  }

  // 8. Seed Sample Supplier
  const supplier = await prisma.supplier.create({
    data: {
      code: 'SUP-EGY-01',
      name: 'شركة النصر للاستيراد والأدوات الرياضية',
      contactPerson: 'المهندس مصطفى كامل',
      phone: '02 33458899',
      email: 'info@elnasr-sports.eg',
      address: 'منطقة شق الثعبان، القاهرة',
      taxNumber: '499-102-334',
    },
  });

  console.log(`✅ Supplier seeded: ${supplier.name}`);

  console.log('🚀 Seed finished successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
