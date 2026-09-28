import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { apiError } from '@/lib/api-response';
import { writeAudit } from '@/lib/audit';
import {
  readAnnouncement,
  readHeroBanners,
  saveAnnouncement,
  saveHeroBanners,
  MAX_BANNERS,
} from '@/lib/website/cms';

export const dynamic = 'force-dynamic';

/**
 * Storefront CMS. This replaces the editor's old `PUT /api/admin/settings`
 * call, which could never succeed: that route only accepts keys present in
 * `REGISTRY_KEYS`, and no `cms.*` key is registered there.
 *
 * BRANCH_MANAGER is allowed because the editor page already grants it, and
 * storefront content is not branch-scoped data.
 */
export async function GET() {
  const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  if (error) return error;

  const [announcement, banners] = await Promise.all([
    readAnnouncement(),
    readHeroBanners('ar'),
  ]);
  return NextResponse.json({ success: true, data: { announcement, banners, maxBanners: MAX_BANNERS } });
}

export async function PUT(req: Request) {
  const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Body must be valid JSON', 400);
  }

  const { announcement, banners } = (body && typeof body === 'object' ? body : {}) as {
    announcement?: unknown;
    banners?: unknown;
  };

  if (announcement === undefined && banners === undefined) {
    return apiError('VALIDATION_ERROR', 'Provide announcement and/or banners', 400);
  }

  try {
    const savedAnnouncement = announcement === undefined ? null : await saveAnnouncement(announcement);
    const bannerCount = banners === undefined ? null : await saveHeroBanners(banners);

    await writeAudit({
      actorId: (session?.user as { id?: string })?.id,
      action: 'website.content.updated',
      entity: 'Setting',
      entityId: 'website-content',
      metadata: {
        announcement: savedAnnouncement !== null,
        banners: bannerCount,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        announcement: savedAnnouncement ?? (await readAnnouncement()),
        bannerCount,
      },
    });
  } catch (e) {
    return apiError('VALIDATION_ERROR', e instanceof Error ? e.message : 'Invalid content', 400);
  }
}
