import { PaymentMethod } from '@prisma/client';

export interface PaymentInitializationResult {
  success: boolean;
  paymentMethod: PaymentMethod;
  transactionRef: string;
  redirectUrl?: string;
  fawryReferenceNumber?: string;
  instructionsAr?: string;
  instructionsEn?: string;
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

/**
 * Primary Payment Engine for Egypt
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
      // Paymob API integration placeholder
      // Step 1: Authentication Token -> Step 2: Order Registration -> Step 3: Payment Key Generation
      const iframeId = process.env.PAYMOB_FRAMES_ID || '123456';
      return {
        success: true,
        paymentMethod: PaymentMethod.PAYMOB,
        transactionRef,
        redirectUrl: `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=sample_token_${transactionRef}`,
        instructionsAr: 'سيتم تحويلك بأمان لشركة باي مب لإتمام الدفع بالبطاقة البنكية أو المحفظة الإلكترونية.',
        instructionsEn: 'You will be redirected securely to Paymob to complete your card or mobile wallet payment.',
      };
    }

    case PaymentMethod.FAWRY: {
      // Fawry Reference Number generation
      const fawryRef = `${Math.floor(100000000 + Math.random() * 900000000)}`;
      return {
        success: true,
        paymentMethod: PaymentMethod.FAWRY,
        transactionRef: fawryRef,
        fawryReferenceNumber: fawryRef,
        instructionsAr: `رقم الدفع كاش في منافذ فوري هو: ${fawryRef}. يرجى السداد خلال 24 ساعة.`,
        instructionsEn: `Your Fawry payment reference code is: ${fawryRef}. Please pay at any Fawry kiosk within 24 hours.`,
      };
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
      return {
        success: true,
        paymentMethod: PaymentMethod.KASHIER,
        transactionRef,
        redirectUrl: `https://checkout.kashier.io/?merchantId=${process.env.KASHIER_MERCHANT_ID || 'test'}&orderId=${orderNumber}&amount=${amountEgp}&currency=EGP`,
        instructionsAr: 'سيتم تحويلك لشركة كاشير للدفع الإلكتروني.',
        instructionsEn: 'Redirecting to Kashier payment gateway.',
      };
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
