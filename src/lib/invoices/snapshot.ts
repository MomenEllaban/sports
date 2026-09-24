import type { Prisma } from '@prisma/client';

export interface InvoiceSnapshotLine {
  productId: string;
  nameAr: string;
  nameEn: string;
  sku: string;
  barcode?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface InvoiceSnapshotInput {
  invoiceNumber: string;
  source: 'ORDER' | 'SALE';
  sourceId: string;
  createdAt: Date;
  branch: { id: string; name: string; nameEn?: string };
  customer?: { name?: string | null; phone?: string | null } | null;
  cashier?: { id: string; name?: string | null } | null;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  vat: number;
  deliveryFee: number;
  total: number;
  lines: InvoiceSnapshotLine[];
  qrCodeData?: string | null;
  etaUuid?: string | null;
}

export function makeInvoiceSnapshot(input: InvoiceSnapshotInput): Prisma.InputJsonValue {
  return {
    invoiceNumber: input.invoiceNumber,
    source: input.source,
    sourceId: input.sourceId,
    createdAt: input.createdAt.toISOString(),
    branch: input.branch,
    customer: input.customer || null,
    cashier: input.cashier || null,
    paymentMethod: input.paymentMethod,
    subtotal: input.subtotal,
    discount: input.discount,
    vat: input.vat,
    deliveryFee: input.deliveryFee,
    total: input.total,
    lines: input.lines,
    qrCodeData: input.qrCodeData || null,
    etaUuid: input.etaUuid || null,
  } as unknown as Prisma.InputJsonValue;
}
