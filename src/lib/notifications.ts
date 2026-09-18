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
 * WhatsApp Business API Connector
 */
export async function sendWhatsAppMessage(phone: string, message: string) {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.log(`[WhatsApp Mock Dispatch] To: ${phone} | Message: ${message}`);
    return { success: true, mock: true };
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
