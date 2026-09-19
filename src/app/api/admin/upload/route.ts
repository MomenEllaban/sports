import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-guard';
import { uploadBufferToCloudinary, uploadImageToCloudinary } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ success: false, error: 'لم يتم إرسال أي ملف' }, { status: 400 });
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ success: false, error: 'الملف المرفوع يجب أن يكون صورة' }, { status: 400 });
      }

      // Max size: 10MB
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ success: false, error: 'حجم الصورة يجب ألا يتجاوز 10 ميجابايت' }, { status: 400 });
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
      return NextResponse.json({ success: false, error: 'يرجى تقديم رابط صورة صالح أو ملف' }, { status: 400 });
    }

    const url = await uploadImageToCloudinary(source, 'sports-champions/products');
    return NextResponse.json({ success: true, url });
  } catch (err: unknown) {
    console.error('Upload to Cloudinary error:', err);
    const message = err instanceof Error ? err.message : 'فشل رفع الصورة إلى Cloudinary';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
