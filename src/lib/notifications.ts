import { prisma } from './db';
import { NotificationType, Role } from '@prisma/client';

export interface DispatchNotificationParams {
  type: NotificationType;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  targetRole?: Role;
  branchId?: string;
  sendWhatsAppPhone?: string;
  sendEmailAddress?: string;
}

/**
 * Dispatch system notifications across In-App Bell, WhatsApp Business API & Email
 */
export async function dispatchNotification(params: DispatchNotificationParams) {
  try {
    // 1. Save in-app notification in DB
    const notif = await prisma.notification.create({
      data: {
        type: params.type,
        titleAr: params.titleAr,
        titleEn: params.titleEn,
        messageAr: params.messageAr,
        messageEn: params.messageEn,
        targetRole: params.targetRole || null,
        branchId: params.branchId || null,
      },
    });

    // 2. Dispatch WhatsApp alert if customer or manager phone provided
    if (params.sendWhatsAppPhone) {
      sendWhatsAppMessage(params.sendWhatsAppPhone, params.messageAr);
    }

    return notif;
  } catch (error) {
    console.error('Failed to dispatch notification:', error);
    return null;
  }
}

/**
 * WhatsApp Business API Connector (4.2, settings-gated).
 * - mode 'off' (default) → mock log, returns { mock: true, reason: 'not-configured' }.
 * - mode 'cloud' + Phone ID/token filled in Settings → real Meta Graph API call
 *   (text or approved template). Env vars WHATSAPP_PHONE_NUMBER_ID /
 *   WHATSAPP_API_TOKEN remain as fallback for server-managed secrets.
 */
export async function sendWhatsAppMessage(phone: string, message: string) {
  const { getWhatsAppConfig } = await import('./settings');
  const cfg = await getWhatsAppConfig().catch(() => null);

  const phoneId = cfg?.phoneId?.trim() || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = cfg?.token?.trim() || process.env.WHATSAPP_API_TOKEN;
  const live = cfg?.mode === 'cloud' && !!phoneId && !!token;

  if (!live) {
    const reason =
      !cfg || cfg.mode === 'off'
        ? 'not-configured: enable WhatsApp in Settings → Integrations'
        : `not-configured: missing ${cfg.missing.join(', ')} in Settings → Integrations`;
    console.log(`[WhatsApp disabled] phone=***${phone.slice(-4)} (${reason})`);
    return { success: false, queued: false, mock: true, reason };
  }

  try {
    // Call Facebook Meta Graph API for WhatsApp Business
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.replace(/^0/, '20'), // Egypt country code prefix +20
        type: 'text',
        text: { body: message },
      }),
    });

    const data = await response.json();
    return { success: response.ok, data };
  } catch (err) {
    console.error('WhatsApp API Error:', err);
    return { success: false, error: err };
  }
}

/**
 * 4.2 — Send an APPROVED Meta template (required for business-initiated
 * messages outside the 24h window). Falls back to mock when not configured.
 */
export async function sendWhatsAppTemplate(
  phone: string,
  templateName?: string,
  languageCode = 'ar',
  bodyParams: string[] = []
) {
  const { getWhatsAppConfig } = await import('./settings');
  const cfg = await getWhatsAppConfig().catch(() => null);
  const name = templateName || cfg?.templateOrder || 'order_confirmation';

  const phoneId = cfg?.phoneId?.trim() || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = cfg?.token?.trim() || process.env.WHATSAPP_API_TOKEN;
  if (cfg?.mode !== 'cloud' || !phoneId || !token) {
    console.log(`[WhatsApp template disabled] phone=***${phone.slice(-4)} template=${name}`);
    return { success: false, queued: false, mock: true, reason: 'not-configured' };
  }
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.replace(/^0/, '20'),
        type: 'template',
        template: {
          name,
          language: { code: languageCode },
          components: bodyParams.length
            ? [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) }]
            : [],
        },
      }),
    });
    const data = await response.json();
    return { success: response.ok, data };
  } catch (err) {
    console.error('WhatsApp template error:', err);
    return { success: false, error: err };
  }
}
