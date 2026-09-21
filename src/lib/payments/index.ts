import { PaymentMethod } from '@prisma/client';
import { getPaymobConfig } from './paymob-config';
import { createRealPaymobPayment } from './paymob';
import { getFawryConfig } from './fawry-config';
import { createRealFawryCharge, FAWRY_EXPIRY_HOURS } from './fawry';

export interface PaymentInitializationResult {
  success: boolean;
  paymentMethod: PaymentMethod;
  transactionRef: string;
  redirectUrl?: string;
  fawryReferenceNumber?: string;
  instructionsAr?: string;
  instructionsEn?: string;
}

export class PaymentUnavailableError extends Error {
  status = 503;
  constructor(message: string) {
    super(message);
    this.status = 503;
  }
}

/**
 * Which checkout methods are actually usable right now (T01):
 * - COD/INSTAPAY/VODAFONE_CASH/CASH/CARD: from `payments.methods` settings.
 * - PAYMOB: only when gateway ready (keys filled). Hidden otherwise.
 * - FAWRY/KASHIER: T02/T15 (hidden until then).
 */
export async function availablePaymentMethods(): Promise<PaymentMethod[]> {
  const { getSetting } = await import('../settings');
  const configured = await getSetting<Array<{ id: string; enabled: boolean }>>('payments.methods', []).catch(() => []);
  const enabled = new Set(configured.filter((m) => m.enabled).map((m) => m.id));
  const out: PaymentMethod[] = [];
  if (enabled.has('COD')) out.push(PaymentMethod.COD);
  if (enabled.has('INSTAPAY')) out.push(PaymentMethod.INSTAPAY);
  if (enabled.has('VODAFONE_CASH')) out.push(PaymentMethod.VODAFONE_CASH);
  if (enabled.has('CASH')) out.push(PaymentMethod.CASH);
  if (enabled.has('CARD')) out.push(PaymentMethod.CARD);
  const paymob = await getPaymobConfig().catch(() => null);
  if (paymob && (paymob.ready || paymob.mock)) out.push(PaymentMethod.PAYMOB);
  const fawry = await getFawryConfig().catch(() => null);
  if (fawry && (fawry.ready || fawry.mock)) out.push(PaymentMethod.FAWRY);
  return out;
}

/**
 * Primary Payment Engine for Egypt (T01: real Paymob, mock only in dev/test).
 */
export async function initializePayment(
  paymentMethod: PaymentMethod,
  orderNumber: string,
  amountEgp: number,
  customerPhone: string,
  customerName?: string
): Promise<PaymentInitializationResult> {
  const transactionRef = `TXN-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

  switch (paymentMethod) {
    case PaymentMethod.PAYMOB: {
      // DB failures degrade to "not ready" (never a fake success).
      const cfg = await getPaymobConfig().catch(() => ({ ready: false, mock: false, iframeId: '', apiKey: '', integrationId: '', hmacSecret: '', missing: ['config'] }));
      if (cfg.ready) {
        const real = await createRealPaymobPayment(cfg, orderNumber, amountEgp, { phone: customerPhone, name: customerName });
        return {
          success: true,
          paymentMethod: PaymentMethod.PAYMOB,
          transactionRef: real.transactionRef,
          redirectUrl: real.redirectUrl,
          instructionsAr: 'سيتم تحويلك بأمان لشركة باي مب لإتمام الدفع بالبطاقة البنكية أو المحفظة الإلكترونية.',
          instructionsEn: 'You will be redirected securely to Paymob to complete your card or mobile wallet payment.',
        };
      }
      // Explicit mock only (test/dev with PAYMOB_PROVIDER=mock). Production: hide the method.
      if (cfg.mock) {
        return {
          success: true,
          paymentMethod: PaymentMethod.PAYMOB,
          transactionRef,
          redirectUrl: `https://accept.paymob.com/api/acceptance/iframes/${cfg.iframeId || '123456'}?payment_token=mock_${transactionRef}`,
          instructionsAr: '(وضع تجريبي) سيتم تحويلك لصفحة دفع وهمية.',
          instructionsEn: '(Mock mode) redirect to a fake payment page.',
        };
      }
      throw new PaymentUnavailableError('الدفع بباي مب غير متاح حالياً — اختر طريقة أخرى');
    }

    case PaymentMethod.FAWRY: {
      // T02: real Pay-at-Fawry reference. Fails closed without keys.
      const fcfg = await getFawryConfig().catch(() => ({ ready: false, mock: false, merchantCode: '', secureKey: '', missing: ['config'] }));
      if (fcfg.ready) {
        const charge = await createRealFawryCharge(fcfg, orderNumber, amountEgp, { phone: customerPhone, name: customerName });
        return {
          success: true,
          paymentMethod: PaymentMethod.FAWRY,
          transactionRef: charge.fawryRef,
          fawryReferenceNumber: charge.fawryRef,
          instructionsAr: `رقم الدفع في منافذ فوري هو: ${charge.fawryRef}. يرجى السداد خلال ${FAWRY_EXPIRY_HOURS} ساعة.`,
          instructionsEn: `Your Fawry payment reference code is: ${charge.fawryRef}. Please pay within ${FAWRY_EXPIRY_HOURS} hours.`,
        };
      }
      if (fcfg.mock) {
        const fawryRef = `${Math.floor(100000000 + Math.random() * 900000000)}`;
        return {
          success: true,
          paymentMethod: PaymentMethod.FAWRY,
          transactionRef: fawryRef,
          fawryReferenceNumber: fawryRef,
          instructionsAr: `(وضع تجريبي) رقم فوري: ${fawryRef}.`,
          instructionsEn: `(Mock mode) Fawry code: ${fawryRef}.`,
        };
      }
      throw new PaymentUnavailableError('الدفع بفوري غير متاح حالياً — اختر طريقة أخرى');
    }

    case PaymentMethod.INSTAPAY:
    case PaymentMethod.VODAFONE_CASH: {
      return {
        success: true,
        paymentMethod,
        transactionRef,
        instructionsAr: 'يرجى التحويل إلى حساب انستا باي (sports.champions@instapay) أو رقم المحفظة (01001234567) وإرفاق صورة الإيصال.',
        instructionsEn: 'Please transfer to InstaPay IPA (sports.champions@instapay) or Wallet (01001234567) and upload receipt screenshot.',
      };
    }

    case PaymentMethod.KASHIER: {
      throw new PaymentUnavailableError('الدفع بكاشير غير متاح حالياً — اختر طريقة أخرى');
    }

    case PaymentMethod.COD:
    default: {
      return {
        success: true,
        paymentMethod: PaymentMethod.COD,
        transactionRef,
        instructionsAr: 'الدفع نقداً عند استلام الشحنة من المندوب.',
        instructionsEn: 'Cash payment upon delivery by courier.',
      };
    }
  }
}

/**
 * Reconciles Cash on Delivery (COD) amounts collected by couriers vs remitted to branch finance
 */
export function calculateCodReconciliation(record: CodReconciliationRecord) {
  const discrepancy = record.collectedAmount - record.remittedAmount;
  return {
    ...record,
    discrepancy,
    isReconciled: Math.abs(discrepancy) < 0.01,
  };
}

export interface CodReconciliationRecord {
  courierId?: string;
  branchId: string;
  orderNumber: string;
  collectedAmount: number;
  remittedAmount: number;
  discrepancy: number;
  isReconciled: boolean;
}
