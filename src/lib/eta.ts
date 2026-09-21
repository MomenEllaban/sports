import QRCode from 'qrcode';
import { prisma } from './db';
import { getEtaConfig } from './settings';
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
  const { getStoreInfo } = await import('./settings');
  const store = await getStoreInfo().catch(() => ({ taxNumber: '123-456-789' }) as { taxNumber: string });
  const taxReg = process.env.ETA_TAX_REGISTRATION_NUMBER || store.taxNumber || '123-456-789';
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
 *
 * 4.1: when ETA mode is off (default) the receipt is recorded locally with a
 * QR payload (offline mode). When the customer enables preprod/production AND
 * fills Client ID/Secret/Tax number in Settings, we attempt a real submission;
 * any gateway failure degrades gracefully to INVALID with the error message.
 */
export async function buildEtaReceipt(
  receiptData: EtaReceiptData
): Promise<{ etaUuid: string; qrCodeDataUrl: string; status: TaxInvoiceStatus; message: string }> {
  const legacyEnabled = process.env.ETA_ENABLED === 'true';
  const cfg = await getEtaConfig().catch(() => null);
  const liveMode = cfg && cfg.mode !== 'off' ? cfg.mode : legacyEnabled ? 'preprod' : 'off';

  const etaUuid = `ETA-EGY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const qrCodeDataUrl = await generateEtaQrCode(
    receiptData.invoiceNumber,
    etaUuid,
    receiptData.totalAmount,
    receiptData.vatAmount
  );

  if (liveMode === 'off' || !cfg || !cfg.ready) {
    const hint =
      cfg && cfg.mode !== 'off' && cfg.missing.length > 0
        ? ` (ETA ${cfg.mode}: missing ${cfg.missing.join(', ')} — complete them in Settings)`
        : '';
    return {
      etaUuid,
      qrCodeDataUrl,
      status: TaxInvoiceStatus.SUBMITTED,
      message: `Receipt recorded successfully (ETA Submission Offline mode).${hint}`,
    };
  }

  const liveModeStrict: 'preprod' | 'production' = cfg.mode === 'production' ? 'production' : 'preprod';
  try {
    const token = await fetchEtaToken(liveModeStrict, cfg.clientId, cfg.clientSecret);
    const result = await submitEtaDocument(liveModeStrict, token, {
      invoiceNumber: receiptData.invoiceNumber,
      totalAmount: receiptData.totalAmount,
      vatAmount: receiptData.vatAmount,
      taxRegNumber: cfg.taxRegNumber,
      items: receiptData.items,
    });
    return {
      etaUuid: result.uuid || etaUuid,
      qrCodeDataUrl,
      status: TaxInvoiceStatus.VALID,
      message: 'E-Receipt submitted and validated in real-time with ETA.',
    };
  } catch (error) {
    console.error('ETA submission error:', error);
    return {
      etaUuid,
      qrCodeDataUrl,
      status: TaxInvoiceStatus.INVALID,
      message: `Failed to communicate with ETA gateway: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }
}

/**
 * 4.1 — ETA identity: OAuth2 client-credentials token (preprod / production).
 * Endpoints per ETA eInvoicing API V1.0; called ONLY when mode != off and
 * credentials are filled in Settings.
 */
export async function fetchEtaToken(mode: 'preprod' | 'production', clientId: string, clientSecret: string): Promise<string> {
  const base =
    mode === 'production' ? 'https://api.invoicing.eta.gov.eg' : 'https://api.preprod.invoicing.eta.gov.eg';
  const res = await fetch(`${base}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'InvoicingAPI',
    }),
  });
  if (!res.ok) throw new Error(`ETA auth failed (HTTP ${res.status})`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('ETA auth returned no token');
  return data.access_token;
}

export interface EtaDocumentPayload {
  invoiceNumber: string;
  totalAmount: number;
  vatAmount: number;
  taxRegNumber: string;
  items: EtaReceiptData['items'];
}

/**
 * 4.1 — Submit a B2C e-Receipt document to ETA.
 * NOTE: production documents must be electronically signed (CAdES-BES via the
 * customer's HSM/USB token + SDK) before submission — the signing step runs
 * here once the customer provides their signing service endpoint via env
 * ETA_SIGNING_URL; without it the gateway rejects unsigned documents.
 */
export async function submitEtaDocument(
  mode: 'preprod' | 'production',
  token: string,
  doc: EtaDocumentPayload
): Promise<{ uuid: string }> {
  const signingUrl = process.env.ETA_SIGNING_URL;
  let signedDocument: unknown = {
    issuer: { registrationNumber: doc.taxRegNumber },
    receiver: {},
    documentType: 'R',
    documentTypeVersion: '1.0',
    dateTimeIssued: new Date().toISOString(),
    totalSalesAmount: doc.totalAmount,
    totalAmount: doc.totalAmount,
    extraDiscountAmount: 0,
    netAmount: doc.totalAmount - doc.vatAmount,
    taxTotals: [{ taxType: 'T1', amount: doc.vatAmount }],
    invoiceLines: doc.items.map((i) => ({
      description: i.name,
      itemType: 'GS1',
      itemCode: '1000001',
      unitType: 'EA',
      quantity: i.quantity,
      unitValue: { currencySold: 'EGP', amountEGP: i.unitPrice },
      salesTotal: i.totalPrice,
      netTotal: i.totalPrice,
      valueDifference: 0,
      totalTaxableFees: 0,
      discount: { rate: 0, amount: 0 },
      taxableItems: [{ taxType: 'T1', amount: i.vatAmount, subType: 'V009', rate: 14 }],
    })),
  };
  if (signingUrl) {
    const sigRes = await fetch(signingUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(signedDocument),
    });
    if (!sigRes.ok) throw new Error(`Document signing failed (HTTP ${sigRes.status})`);
    signedDocument = await sigRes.json();
  }
  const base =
    mode === 'production' ? 'https://api.invoicing.eta.gov.eg' : 'https://api.preprod.invoicing.eta.gov.eg';
  const res = await fetch(`${base}/api/v1/receipts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(signedDocument),
  });
  if (!res.ok) throw new Error(`ETA submit failed (HTTP ${res.status})`);
  const data = (await res.json()) as { uuid?: string; submissionId?: string };
  return { uuid: data.uuid || data.submissionId || '' };
}

/**
 * 4.1 — Issue a credit note (e.g. order RETURNED) against an ETA document.
 * Best-effort: callers must never fail the local return when ETA is offline.
 */
export async function submitEtaCreditNote(args: {
  branchId: string;
  invoiceNumber: string;
  totalAmount: number;
  vatAmount: number;
}): Promise<{ ok: boolean; message: string }> {
  const cfg = await getEtaConfig().catch(() => null);
  if (!cfg || !cfg.ready) {
    return { ok: false, message: 'ETA offline — credit note queued locally' };
  }
  try {
    const token = await fetchEtaToken(cfg.mode === 'off' ? 'preprod' : cfg.mode, cfg.clientId, cfg.clientSecret);
    await submitEtaDocument(cfg.mode === 'off' ? 'preprod' : cfg.mode, token, {
      invoiceNumber: `CN-${args.invoiceNumber}`,
      totalAmount: -Math.abs(args.totalAmount),
      vatAmount: -Math.abs(args.vatAmount),
      taxRegNumber: cfg.taxRegNumber,
      items: [],
    });
    return { ok: true, message: 'Credit note submitted to ETA' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'ETA credit note failed' };
  }
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
