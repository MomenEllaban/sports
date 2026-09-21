/**
 * Real Paymob Accept client (T01): Auth → Order → PaymentKey → Iframe.
 * Pure functions with injectable fetch for tests (HTTP mocked, no network).
 * Amounts go to Paymob in piasters (amount_cents, integers).
 */
import type { PaymobConfig } from './paymob-config';

export const PAYMOB_BASE = 'https://accept.paymob.com/api';

export type FetchFn = typeof fetch;

export async function paymobAuthToken(cfg: PaymobConfig, f: FetchFn = fetch): Promise<string> {
  const res = await f(`${PAYMOB_BASE}/auth/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: cfg.apiKey }),
  });
  if (!res.ok) throw new Error(`Paymob auth failed (HTTP ${res.status})`);
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error('Paymob auth returned no token');
  return data.token;
}

export async function paymobRegisterOrder(
  token: string,
  orderNumber: string,
  amountEgp: number,
  f: FetchFn = fetch
): Promise<{ paymobOrderId: number }> {
  const amountCents = Math.round(amountEgp * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) throw new Error('Invalid amount for Paymob order');
  const res = await f(`${PAYMOB_BASE}/ecommerce/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: token,
      delivery_needed: false,
      amount_cents: String(amountCents),
      currency: 'EGP',
      merchant_order_id: orderNumber,
      items: [],
    }),
  });
  if (!res.ok) throw new Error(`Paymob order failed (HTTP ${res.status})`);
  const data = (await res.json()) as { id?: number };
  if (typeof data.id !== 'number') throw new Error('Paymob order returned no id');
  return { paymobOrderId: data.id };
}

export async function paymobPaymentKey(
  token: string,
  paymobOrderId: number,
  amountEgp: number,
  cfg: PaymobConfig,
  customer: { phone: string; name?: string },
  f: FetchFn = fetch
): Promise<{ paymentToken: string }> {
  const amountCents = Math.round(amountEgp * 100);
  const res = await f(`${PAYMOB_BASE}/acceptance/payment_keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: token,
      amount_cents: String(amountCents),
      expiration: 3600,
      order_id: paymobOrderId,
      currency: 'EGP',
      integration_id: Number(cfg.integrationId),
      lock_order_when_paid: true,
      billing_data: {
        first_name: (customer.name || 'Customer').slice(0, 30),
        last_name: '-',
        phone_number: customer.phone,
        email: 'na@sports-champions.local',
        country: 'EG',
        city: 'Alexandria',
        street: 'NA',
        building: 'NA',
        floor: 'NA',
        apartment: 'NA',
      },
    }),
  });
  if (!res.ok) throw new Error(`Paymob payment key failed (HTTP ${res.status})`);
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error('Paymob returned no payment token');
  return { paymentToken: data.token };
}

export function paymobIframeUrl(cfg: PaymobConfig, paymentToken: string): string {
  return `${PAYMOB_BASE}/acceptance/iframes/${cfg.iframeId}?payment_token=${paymentToken}`;
}

/** Full real flow. Throws on any gateway failure (caller degrades cleanly). */
export async function createRealPaymobPayment(
  cfg: PaymobConfig,
  orderNumber: string,
  amountEgp: number,
  customer: { phone: string; name?: string },
  f: FetchFn = fetch
): Promise<{ transactionRef: string; redirectUrl: string }> {
  const token = await paymobAuthToken(cfg, f);
  const { paymobOrderId } = await paymobRegisterOrder(token, orderNumber, amountEgp, f);
  const { paymentToken } = await paymobPaymentKey(token, paymobOrderId, amountEgp, cfg, customer, f);
  return { transactionRef: `PAYMOB-${paymobOrderId}`, redirectUrl: paymobIframeUrl(cfg, paymentToken) };
}
