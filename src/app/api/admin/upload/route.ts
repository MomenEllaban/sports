import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { uploadBufferToCloudinary, uploadImageToCloudinary } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return apiError('VALIDATION_ERROR', 'لم يتم إرسال أي ملف', 400);
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        return apiError('VALIDATION_ERROR', 'الملف المرفوع يجب أن يكون صورة', 400);
      }

      // Max size: 10MB
      if (file.size > 10 * 1024 * 1024) {
        return apiError('VALIDATION_ERROR', 'حجم الصورة يجب ألا يتجاوز 10 ميجابايت', 400);
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const url = await uploadBufferToCloudinary(buffer, 'sports-champions/products');

      return NextResponse.json({ success: true, url });
    }

    // Otherwise expect JSON { url: string } or { base64: string }
    const body = await req.json();
    const source = body.url || body.base64 || body.image;

    if (!source || typeof source !== 'string') {
      return apiError('VALIDATION_ERROR', 'يرجى تقديم رابط صورة صالح أو ملف', 400);
    }

    const url = await uploadImageToCloudinary(source, 'sports-champions/products');
    return NextResponse.json({ success: true, url });
  } catch (err: unknown) {
    captureError('api/admin/upload', err);
    const message = err instanceof Error ? err.message : 'فشل رفع الصورة إلى Cloudinary';
    return apiError('INTERNAL_ERROR', String(message), 500);
  }
}
