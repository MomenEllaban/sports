import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function run() {
  console.log('Uploading valid treadmill image to Cloudinary...');
  const res = await cloudinary.uploader.upload(
    'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=800&q=80',
    { folder: 'sports-champions/products' }
  );
  console.log('Uploaded secure URL:', res.secure_url);

  await prisma.product.update({
    where: { sku: 'COU-TR-900' },
    data: { images: [res.secure_url] },
  });
  console.log('Successfully updated COU-TR-900 product in database!');
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
