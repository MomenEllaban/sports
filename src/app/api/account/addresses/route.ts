import { prisma } from '@/lib/db';
import { readPortalSession } from '@/lib/account/session';
import { apiError, apiInternalError, apiSuccess, getRequestId } from '@/lib/api-response';

/** Customer portal: add / remove own delivery addresses (4.3). */
export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const session = await readPortalSession();
    if (!session) return apiError('UNAUTHORIZED', 'سجّل الدخول لإدارة العناوين', 401, requestId);
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const street = String(body?.street || '').trim();
    if (!street) return apiError('VALIDATION_ERROR', 'الشارع مطلوب', 400, requestId);
    const address = await prisma.address.create({
      data: {
        customerId: session.customerId,
        title: String(body?.title || 'Home').slice(0, 30),
        street: street.slice(0, 200),
        building: body?.building ? String(body.building).slice(0, 50) : null,
        city: body?.city ? String(body.city).slice(0, 50) : 'Alexandria',
        governorate: body?.governorate ? String(body.governorate).slice(0, 50) : 'Alexandria',
        isDefault: false,
      },
    });
    return apiSuccess({ address }, 201, requestId);
  } catch (error) {
    return apiInternalError(req, error, 'تعذر حفظ العنوان');
  }
}

export async function DELETE(req: Request) {
  const requestId = getRequestId(req);
  try {
    const session = await readPortalSession();
    if (!session) return apiError('UNAUTHORIZED', 'سجّل الدخول لإدارة العناوين', 401, requestId);
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return apiError('VALIDATION_ERROR', 'معرّف العنوان مطلوب', 400, requestId);
    const existing = await prisma.address.findFirst({ where: { id, customerId: session.customerId } });
    if (!existing) return apiError('NOT_FOUND', 'العنوان غير موجود', 404, requestId);
    await prisma.address.delete({ where: { id } });
    return apiSuccess({}, 200, requestId);
  } catch (error) {
    return apiInternalError(req, error, 'تعذر حذف العنوان');
  }
}
