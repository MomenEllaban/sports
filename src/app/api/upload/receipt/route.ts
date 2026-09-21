import { NextResponse } from 'next/server';
import { uploadBufferToCloudinary } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

/**
 * Public receipt upload (2.3) — checkout customers attach an InstaPay /
 * Vodafone Cash transfer screenshot. Image-only, 5MB max, stored in
 * sports-champions/receipts. No auth by design (guest checkout).
 */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ success: false, error: 'أرسل الصورة كملف (form-data)' }, { status: 400 });
    }
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: 'لم يتم إرسال أي ملف' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, error: 'الملف يجب أن يكون صورة' }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'حجم الصورة يجب ألا يتجاوز 5 ميجابايت' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadBufferToCloudinary(buffer, 'sports-champions/receipts');
    return NextResponse.json({ success: true, url });
  } catch (err: unknown) {
    console.error('Receipt upload error:', err);
    return NextResponse.json({ success: false, error: 'فشل رفع صورة الإيصال' }, { status: 500 });
  }
}
