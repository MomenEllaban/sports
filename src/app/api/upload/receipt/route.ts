import { uploadBufferToCloudinary } from '@/lib/cloudinary';
import { checkRateLimit, clientIp, rateLimitedResponse } from '@/lib/rate-limit';
import { getSetting } from '@/lib/settings';
import { apiError, apiInternalError, apiSuccess, getRequestId } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** Magic-byte signatures for allowed image types (F1: no MIME spoofing). */
const SIGNATURES: Array<{ mime: string; test: (b: Buffer) => boolean }> = [
  { mime: 'image/png', test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/jpeg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/gif', test: (b) => b.length > 6 && b.toString('ascii', 0, 6).startsWith('GIF8') },
  { mime: 'image/webp', test: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
];

/** Public receipt upload: rate-limited, magic-byte verified, size-capped. */
export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const uploadLimit = await getSetting<number>('ratelimit.uploadPerMin', 20).catch(() => 20);
    const rl = checkRateLimit(`upload:${clientIp(req)}`, uploadLimit, 60_000);
    if (!rl.ok) return rateLimitedResponse(rl.retryAfterSec);

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) return apiError('VALIDATION_ERROR', 'أرسل الصورة كملف (form-data)', 400, requestId);
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return apiError('VALIDATION_ERROR', 'لم يتم إرسال أي ملف', 400, requestId);
    const maxMb = await getSetting<number>('upload.receiptMaxMb', 5).catch(() => 5);
    if (file.size > maxMb * 1024 * 1024) return apiError('VALIDATION_ERROR', `حجم الصورة يجب ألا يتجاوز ${maxMb} ميجابايت`, 400, requestId);
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!SIGNATURES.some((signature) => signature.test(buffer))) return apiError('VALIDATION_ERROR', 'الملف ليس صورة صالحة (PNG/JPEG/WebP/GIF فقط)', 400, requestId);
    const url = await uploadBufferToCloudinary(buffer, 'sports-champions/receipts');
    return apiSuccess({ url }, 200, requestId);
  } catch (error) {
    return apiInternalError(req, error, 'فشل رفع صورة الإيصال');
  }
}
