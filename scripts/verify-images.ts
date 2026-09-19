import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const products = await prisma.product.findMany({
    select: { sku: true, nameAr: true, images: true },
  });
  console.log(`Total Products: ${products.length}`);
  products.forEach((p, idx) => {
    console.log(`${idx + 1}. [${p.sku}] ${p.nameAr}: ${p.images.join(', ')}`);
  });
}

check()
  .finally(() => prisma.$disconnect());
