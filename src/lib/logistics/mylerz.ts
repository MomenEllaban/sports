/**
 * Real Mylerz client (T03): create parcel (token auth).
 * Pure functions with injectable fetch (HTTP mocked in tests).
 *
 * NOTE (verify in sandbox before live): Mylerz onboarding decides between
 * API-key Bearer auth and username/password login. This client uses the
 * Bearer form backed by `couriers.mylerzApiKey`; confirm the parcel schema
 * during sandbox onboarding — isolated here for one-line fixes.
 */
import type { CourierConfig } from './couriers-config';

export const MYLERZ_BASE = 'https://api.mylerz.com';
export type FetchFn = typeof fetch;

export interface MylerzCreateInput {
  orderNumber: string;
  codAmount: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
}

export interface MylerzCreateResult {
  trackingNumber: string;
  labelUrl?: string;
}

export async function createMylerzParcel(
  cfg: CourierConfig,
  input: MylerzCreateInput,
  f: FetchFn = fetch
): Promise<MylerzCreateResult> {
  if (!input.customerPhone || !input.customerAddress) throw new Error('Mylerz needs receiver phone + address');
  const res = await f(`${MYLERZ_BASE}/Parcel/CreateParcel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      Reference: input.orderNumber,
      ServiceType: input.codAmount > 0 ? 'COD' : 'Pickup & Delivery',
      CODValue: Math.round(input.codAmount * 100) / 100,
      CustomerName: input.customerName.slice(0, 60) || 'Customer',
      CustomerPhone: input.customerPhone,
      CustomerAddress: input.customerAddress.slice(0, 200),
      Pieces: 1,
    }),
  });
  if (!res.ok) throw new Error(`Mylerz create failed (HTTP ${res.status})`);
  const data = (await res.json()) as { TrackingNumber?: string; trackingNumber?: string; BarCode?: string; Message?: string };
  const trackingNumber = data.TrackingNumber || data.trackingNumber || data.BarCode;
  if (!trackingNumber) throw new Error(`Mylerz rejected parcel: ${data.Message || 'no tracking'}`);
  return { trackingNumber: String(trackingNumber) };
}
