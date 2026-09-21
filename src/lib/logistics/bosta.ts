/**
 * Real Bosta client (T03): create forward delivery.
 * Pure functions with injectable fetch (HTTP mocked in tests).
 *
 * NOTE (verify in sandbox before live): payload follows Bosta deliveries v2
 * docs. Confirm district/pickup codes + auth header scheme during sandbox
 * onboarding; the builder is isolated here for one-line fixes.
 */
import type { CourierConfig } from './couriers-config';

export const BOSTA_BASE = 'https://api.bosta.co/api';
export type FetchFn = typeof fetch;

export interface BostaCreateInput {
  orderNumber: string;
  codAmount: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes?: string;
}

export interface BostaCreateResult {
  trackingNumber: string;
  labelUrl?: string;
  rawId: string;
}

export async function createBostaDelivery(
  cfg: CourierConfig,
  input: BostaCreateInput,
  f: FetchFn = fetch
): Promise<BostaCreateResult> {
  if (!input.customerPhone || !input.customerAddress) throw new Error('Bosta needs receiver phone + address');
  const res = await f(`${BOSTA_BASE}/v2/deliveries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: cfg.apiKey },
    body: JSON.stringify({
      type: 10,
      specs: { size: 'Default' },
      notes: input.notes || input.orderNumber,
      cod: { amount: Math.round(input.codAmount * 100) / 100 },
      receiver: {
        firstName: input.customerName.slice(0, 30) || 'Customer',
        lastName: '-',
        phone: input.customerPhone,
        addressLine1: input.customerAddress.slice(0, 200),
      },
      merchantOrderId: input.orderNumber,
    }),
  });
  if (!res.ok) throw new Error(`Bosta create failed (HTTP ${res.status})`);
  const data = (await res.json()) as { data?: { _id?: string; trackingNumber?: string; awb?: string }; trackingNumber?: string; awb?: string };
  const trackingNumber = data.data?.trackingNumber || data.data?.awb || data.trackingNumber || data.awb;
  if (!trackingNumber) throw new Error('Bosta returned no tracking number');
  return {
    trackingNumber: String(trackingNumber),
    labelUrl: `https://bosta.co/tracking?trackingId=${trackingNumber}`,
    rawId: String(data.data?._id || trackingNumber),
  };
}
