import { NextResponse } from 'next/server';
import { uploadBufferToCloudinary } from '@/lib/cloudinary';
import { checkRateLimit, clientIp, rateLimitedResponse } from '@/lib/rate-limit';
import { getSetting } from '@/lib/settings';
import { captureError } from '@/lib/monitor';

export const dynamic = 'force-dynamic';

/** Magic-byte signatures for allowed image types (F1: no MIME spoofing). */
const SIGNATURES: Array<{ mime: string; test: (b: Buffer) => boolean }> = [
  { mime: 'image/png', test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/jpeg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/gif', test: (b) => b.length > 6 && b.toString('ascii', 0, 6).startsWith('GIF8') },
  { mime: 'image/webp', test: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
];

/**
 * Public receipt upload (2.3, hardened F1) — rate-limited, magic-byte
 * verified, size-capped from Settings, randomized storage name.
 */
export async function POST(req: Request) {
  try {
    const uploadLimit = await getSetting<number>('ratelimit.uploadPerMin', 20).catch(() => 20);
    const rl = checkRateLimit(`upload:${clientIp(req)}`, uploadLimit, 60_000);
    if (!rl.ok) return rateLimitedResponse(rl.retryAfterSec);

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ success: false, error: 'أرسل الصورة كملف (form-data)' }, { status: 400 });
    }
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: 'لم يتم إرسال أي ملف' }, { status: 400 });
    }
    const maxMb = await getSetting<number>('upload.receiptMaxMb', 5).catch(() => 5);
    if (file.size > maxMb * 1024 * 1024) {
      return NextResponse.json({ success: false, error: `حجم الصورة يجب ألا يتجاوز ${maxMb} ميجابايت` }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const real = SIGNATURES.find((s) => s.test(buffer));
    if (!real) {
      return NextResponse.json({ success: false, error: 'الملف ليس صورة صالحة (PNG/JPEG/WebP/GIF فقط)' }, { status: 400 });
    }
    // Cloudinary assigns a random public_id; the original filename is never
    // reused, and only magic-byte-verified images reach storage (F1).
    const url = await uploadBufferToCloudinary(buffer, 'sports-champions/receipts');
    return NextResponse.json({ success: true, url });
  } catch (err: unknown) {
    captureError('upload/receipt', err);
    return NextResponse.json({ success: false, error: 'فشل رفع صورة الإيصال' }, { status: 500 });
  }
}
