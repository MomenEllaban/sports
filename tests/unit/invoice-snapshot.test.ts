import { describe, expect, it } from 'vitest';
import { makeInvoiceSnapshot } from '../../src/lib/invoices/snapshot.js';

describe('invoice snapshots', () => {
  it('captures immutable presentation fields at issuance', () => {
    const snapshot = makeInvoiceSnapshot({
      invoiceNumber: 'TEST-1',
      source: 'ORDER',
      sourceId: 'order-1',
      createdAt: new Date('2026-09-24T00:00:00.000Z'),
      branch: { id: 'branch-1', name: 'الفرع' },
      customer: { name: 'عميل', phone: '01000000000' },
      paymentMethod: 'COD',
      subtotal: 100,
      discount: 5,
      vat: 13.3,
      deliveryFee: 20,
      total: 128.3,
      lines: [{ productId: 'p1', nameAr: 'منتج', nameEn: 'Product', sku: 'SKU-1', quantity: 1, unitPrice: 100, totalPrice: 100 }],
    });
    expect(snapshot).toMatchObject({ invoiceNumber: 'TEST-1', source: 'ORDER', subtotal: 100, total: 128.3 });
    expect((snapshot as { lines: unknown[] }).lines).toHaveLength(1);
  });
});
