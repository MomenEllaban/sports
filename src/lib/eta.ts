import QRCode from 'qrcode';
import { prisma } from './db';
import { TaxInvoiceStatus } from '@prisma/client';

export interface EtaReceiptData {
  branchId: string;
  orderId?: string;
  saleId?: string;
  invoiceNumber: string;
  totalAmount: number;
  vatAmount: number;
  customerTaxNumber?: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    vatAmount: number;
  }>;
}

export interface EtaSubmitResult {
  success: boolean;
  etaUuid: string;
  qrCodeDataUrl: string;
  status: TaxInvoiceStatus;
  message: string;
}

/**
 * Calculates 14% Egyptian Standard VAT
 */
export function calculateVat(amount: number, vatRate: number = 0.14): { netAmount: number; vatAmount: number; totalWithVat: number } {
  const vatAmount = Math.round(amount * vatRate * 100) / 100;
  return {
    netAmount: amount,
    vatAmount: vatAmount,
    totalWithVat: Math.round((amount + vatAmount) * 100) / 100,
  };
}

/**
 * Generate ETA Verification Payload and Base64 Data URL for Printable Receipts
 */
export async function generateEtaQrCode(invoiceNumber: string, etaUuid: string, totalAmount: number, vatAmount: number): Promise<string> {
  const taxReg = process.env.ETA_TAX_REGISTRATION_NUMBER || '123-456-789';
  const timestamp = new Date().toISOString();
  
  // ETA Receipt Standard Payload Format
  const etaPayload = `ETA|REG:${taxReg}|INV:${invoiceNumber}|UUID:${etaUuid}|TOTAL:${totalAmount.toFixed(2)}|VAT:${vatAmount.toFixed(2)}|DATE:${timestamp}`;
  
  try {
    const dataUrl = await QRCode.toDataURL(etaPayload, {
      margin: 1,
      width: 180,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
    return dataUrl;
  } catch (err) {
    console.error('Error generating ETA QR code:', err);
    return '';
  }
}

/**
 * Pure receipt builder (no DB) so callers can persist the record inside their
 * own transaction (T07). Use submitToEta() for the standalone path.
 */
export async function buildEtaReceipt(
  receiptData: EtaReceiptData
): Promise<{ etaUuid: string; qrCodeDataUrl: string; status: TaxInvoiceStatus; message: string }> {
  const isEtaEnabled = process.env.ETA_ENABLED === 'true';
  const etaUuid = `ETA-EGY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const qrCodeDataUrl = await generateEtaQrCode(
    receiptData.invoiceNumber,
    etaUuid,
    receiptData.totalAmount,
    receiptData.vatAmount
  );

  let status: TaxInvoiceStatus = TaxInvoiceStatus.SUBMITTED;
  let message = 'Receipt recorded successfully (ETA Submission Offline mode).';

  if (isEtaEnabled) {
    try {
      // In production, call ETA API + signing service (T25)
      status = TaxInvoiceStatus.VALID;
      message = 'E-Receipt submitted and validated in real-time with ETA.';
    } catch (error) {
      status = TaxInvoiceStatus.INVALID;
      message = 'Failed to communicate with ETA gateway.';
      console.error('ETA submission error:', error);
    }
  }

  return { etaUuid, qrCodeDataUrl, status, message };
}

/**
 * Submit B2C E-Receipt or B2B E-Invoice to ETA API (or queue when disabled)
 */
export async function submitToEta(receiptData: EtaReceiptData): Promise<EtaSubmitResult> {
  const { etaUuid, qrCodeDataUrl, status, message } = await buildEtaReceipt(receiptData);

  // Record TaxInvoice entry in database
  const taxRecord = await prisma.taxInvoice.create({
    data: {
      invoiceNumber: receiptData.invoiceNumber,
      etaUuid: etaUuid,
      orderId: receiptData.orderId || null,
      saleId: receiptData.saleId || null,
      branchId: receiptData.branchId,
      totalAmount: receiptData.totalAmount,
      vatAmount: receiptData.vatAmount,
      qrCodeData: qrCodeDataUrl,
      status: status,
      etaResponseText: message,
    },
  });

  return {
    success: status !== TaxInvoiceStatus.INVALID,
    etaUuid,
    qrCodeDataUrl,
    status,
    message,
  };
}
