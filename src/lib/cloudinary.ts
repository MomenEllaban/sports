import { v2 as cloudinary } from 'cloudinary';

/**
 * F1: no hardcoded credentials. Missing env fails the upload call with a
 * clear message (never a leaked fallback). Required:
 * CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.
 */
function ensureConfigured(): void {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary is not configured (missing env credentials)');
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export async function uploadImageToCloudinary(base64OrUrl: string, folder = 'sports-champions/products'): Promise<string> {
  try {
    ensureConfigured();
    const result = await cloudinary.uploader.upload(base64OrUrl, {
      folder,
      resource_type: 'auto',
    });
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}

export async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder = 'sports-champions/products'
): Promise<string> {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
      },
      (error, result) => {
        if (error || !result) {
          console.error('Cloudinary buffer upload error:', error);
          return reject(error || new Error('Upload failed'));
        }
        resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

export default cloudinary;
