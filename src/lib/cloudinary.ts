import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'djseokhow',
  api_key: process.env.CLOUDINARY_API_KEY || '536896379712448',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'C3zQ1AjZOm8X7oVapjMT8IkHPlk',
  secure: true,
});

export async function uploadImageToCloudinary(base64OrUrl: string, folder = 'sports-champions/products'): Promise<string> {
  try {
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
