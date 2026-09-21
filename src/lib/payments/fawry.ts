/**
 * Real Fawry ECommerce charge client (T02) — Pay-at-Fawry reference numbers.
 * Pure functions with injectable fetch for tests (HTTP mocked, no network).
 * Uses WebCrypto (no node: imports — safe for client bundles).
 *
 * NOTE (verify in sandbox before live): signature field order follows the
 * Fawry ECommerce v2 charge doc
 *   sha256(merchantCode + merchantRefNum + customerProfileId
 *          + paymentMethod + amount(2dp) + secureKey)
 * Confirm exact order against the merchant integration PDF during sandbox
 * onboarding; the builder is isolated here so a one-line change fixes it.
 */
import type { FawryConfig } from './fawry-config';

export const FAWRY_BASE = 'https://www.atfawry.com';
export const FAWRY_EXPIRY_HOURS = 24;

export type FetchFn = typeof fetch;

export async function fawryChargeSignature(args: {
  merchantCode: string;
  merchantRefNum: string;
  customerProfileId: string;
  paymentMethod?: string;
  amount: string;
  secureKey: string;
}): Promise<string> {
  const method = args.paymentMethod || 'PAYATFAWRY';
  const subtle = (globalThis as { crypto: Crypto }).crypto.subtle;
  const digest = await subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${args.merchantCode}${args.merchantRefNum}${args.customerProfileId}${method}${args.amount}${args.secureKey}`)
  );
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface FawryChargeResult {
  fawryRef: string;
  merchantRefNum: string;
  expiresAt: string;
}

export async function createRealFawryCharge(
  cfg: FawryConfig,
  orderNumber: string,
  amountEgp: number,
  customer: { phone: string; name?: string },
  f: FetchFn = fetch
): Promise<FawryChargeResult> {
  const amount = amountEgp.toFixed(2);
  if (!Number.isFinite(amountEgp) || amountEgp <= 0) throw new Error('Invalid amount for Fawry charge');
  const customerProfileId = customer.phone.replace(/\D/g, '') || 'guest';
  const signature = await fawryChargeSignature({
    merchantCode: cfg.merchantCode,
    merchantRefNum: orderNumber,
    customerProfileId,
    amount,
    secureKey: cfg.secureKey,
  });
  const res = await f(`${FAWRY_BASE}/ECommerceWeb/Fawry/payments/charge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchantCode: cfg.merchantCode,
      merchantRefNum: orderNumber,
      customerMobile: customer.phone,
      customerName: customer.name || 'Customer',
      customerProfileId,
      paymentMethod: 'PAYATFAWRY',
      amount,
      currencyCode: 'EGP',
      language: 'ar-eg',
      chargeItems: [{ itemId: orderNumber, description: `Sports Champions ${orderNumber}`, price: amount, quantity: 1 }],
      signature,
    }),
  });
  if (!res.ok) throw new Error(`Fawry charge failed (HTTP ${res.status})`);
  const data = (await res.json()) as { referenceNumber?: string; statusCode?: number; statusDescription?: string };
  if (!data.referenceNumber) {
    throw new Error(`Fawry charge rejected: ${data.statusDescription || data.statusCode || 'no reference'}`);
  }
  return {
    fawryRef: String(data.referenceNumber),
    merchantRefNum: orderNumber,
    expiresAt: new Date(Date.now() + FAWRY_EXPIRY_HOURS * 3600_000).toISOString(),
  };
}
