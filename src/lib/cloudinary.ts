import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'djseokhow',
  api_key: process.env.CLOUDINARY_API_KEY || '536896379712448',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'C3zQ1AjZOm8X7oVapjMT8IkHPlk',
  secure: true,
});

export async function uploadImageToCloudinary(base64OrUrl: string, folder = 'sports-champions'): Promise<string> {
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

export default cloudinary;
