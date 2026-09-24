import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';

const prisma = new PrismaClient();

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
if (!cloudName || !apiKey || !apiSecret) {
  throw new Error('CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are required; no fallback secrets are allowed.');
}

cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });

async function uploadToCloudinary(url: string, folder = 'sports-champions/products'): Promise<string> {
  const res = await cloudinary.uploader.upload(url, {
    folder,
    resource_type: 'auto',
  });
  return res.secure_url;
}

async function main() {
  console.log('🚀 Checking and migrating images to Cloudinary...\n');

  // Ping Cloudinary first
  try {
    const ping = await cloudinary.api.ping();
    console.log('✅ Cloudinary connected successfully:', ping.status);
  } catch (err) {
    console.error('❌ Cloudinary connection failed:', err);
    process.exit(1);
  }

  // 1. Migrate Products
  const products = await prisma.product.findMany();
  console.log(`📦 Found ${products.length} products to check.`);

  let updatedProductsCount = 0;

  for (const product of products) {
    const updatedImages: string[] = [];
    let hasChange = false;

    if (!product.images || product.images.length === 0) {
      console.log(`- Product [${product.sku}] has no images, skipping.`);
      continue;
    }

    for (const imgUrl of product.images) {
      if (imgUrl.includes('res.cloudinary.com')) {
        console.log(`- Product [${product.sku}] already on Cloudinary: ${imgUrl}`);
        updatedImages.push(imgUrl);
      } else {
        console.log(`- Product [${product.sku}] uploading to Cloudinary: ${imgUrl}`);
        try {
          const cloudUrl = await uploadToCloudinary(imgUrl, 'sports-champions/products');
          console.log(`  -> Uploaded: ${cloudUrl}`);
          updatedImages.push(cloudUrl);
          hasChange = true;
        } catch (e: unknown) {
          console.error(`  -> Failed to upload image for ${product.sku}:`, e instanceof Error ? e.message : e);
          updatedImages.push(imgUrl); // Keep existing as fallback
        }
      }
    }

    if (hasChange) {
      await prisma.product.update({
        where: { id: product.id },
        data: { images: updatedImages },
      });
      updatedProductsCount++;
      console.log(`  💾 Updated product ${product.sku} in database.`);
    }
  }

  console.log(`\n🎉 Done! Updated ${updatedProductsCount} products with Cloudinary URLs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
