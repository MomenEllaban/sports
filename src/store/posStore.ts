import { create } from 'zustand';
import { PaymentMethod } from '@prisma/client';

export interface PosCartItem {
  id: string;
  sku: string;
  barcode?: string | null;
  nameAr: string;
  nameEn: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  stockQuantity: number;
}

export interface OfflineSaleQueue {
  id: string;
  saleNumber: string;
  branchId: string;
  cashierId: string;
  customerPhone?: string;
  items: PosCartItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  timestamp: string;
}

interface PosState {
  activeBranchId: string;
  cashierId: string;
  cashierName: string;
  ticketItems: PosCartItem[];
  customerPhone: string;
  customerName: string;
  discountAmount: number;
  managerPinApproved: boolean;
  offlineQueue: OfflineSaleQueue[];
  
  setActiveBranch: (branchId: string) => void;
  setCashier: (id: string, name: string) => void;
  addItemToTicket: (product: { id: string; sku: string; barcode?: string | null; nameAr: string; nameEn: string; price: number; stockQuantity: number }) => void;
  updateItemQuantity: (id: string, qty: number) => void;
  removeItemFromTicket: (id: string) => void;
  applyDiscount: (amount: number, pin: string) => boolean;
  setCustomer: (phone: string, name: string) => void;
  clearTicket: () => void;
  queueOfflineSale: (sale: OfflineSaleQueue) => void;
  clearOfflineQueue: () => void;
  
  getSubtotal: () => number;
  getVatAmount: () => number;
  getTotalAmount: () => number;
}

export const usePosStore = create<PosState>((set, get) => ({
  activeBranchId: '',
  cashierId: '',
  cashierName: '',
  ticketItems: [],
  customerPhone: '',
  customerName: '',
  discountAmount: 0,
  managerPinApproved: false,
  offlineQueue: [],

  setActiveBranch: (branchId) => set({ activeBranchId: branchId }),
  
  setCashier: (id, name) => set({ cashierId: id, cashierName: name }),

  addItemToTicket: (product) => {
    const items = get().ticketItems;
    const existing = items.find((i) => i.id === product.id);
    const cap = Math.max(0, product.stockQuantity);

    if (existing) {
      const nextQty = Math.min(existing.quantity + 1, cap);
      if (nextQty === existing.quantity) return; // stock cap reached
      set({
        ticketItems: items.map((i) =>
          i.id === product.id ? { ...i, quantity: nextQty } : i
        ),
      });
    } else {
      if (cap <= 0) return; // out of stock: do not add
      set({
        ticketItems: [
          ...items,
          {
            id: product.id,
            sku: product.sku,
            barcode: product.barcode,
            nameAr: product.nameAr,
            nameEn: product.nameEn,
            unitPrice: product.price,
            quantity: 1,
            discount: 0,
            stockQuantity: product.stockQuantity,
          },
        ],
      });
    }
  },

  updateItemQuantity: (id, qty) => {
    if (qty <= 0) {
      get().removeItemFromTicket(id);
    } else {
      set({
        ticketItems: get().ticketItems.map((i) =>
          i.id === id ? { ...i, quantity: Math.min(qty, Math.max(1, i.stockQuantity)) } : i
        ),
      });
    }
  },

  removeItemFromTicket: (id) => {
    set({ ticketItems: get().ticketItems.filter((i) => i.id !== id) });
  },

  applyDiscount: (amount, pin) => {
    // Valid Manager PINs for high discounts: "1234" or "9999"
    if (amount > 100 && pin !== '1234' && pin !== '9999') {
      return false;
    }
    set({ discountAmount: amount, managerPinApproved: true });
    return true;
  },

  setCustomer: (phone, name) => set({ customerPhone: phone, customerName: name }),

  clearTicket: () =>
    set({
      ticketItems: [],
      customerPhone: '',
      customerName: '',
      discountAmount: 0,
      managerPinApproved: false,
    }),

  queueOfflineSale: (sale) =>
    set({ offlineQueue: [...get().offlineQueue, sale] }),

  clearOfflineQueue: () => set({ offlineQueue: [] }),

  getSubtotal: () => {
    return get().ticketItems.reduce(
      (sum, i) => sum + i.unitPrice * i.quantity - i.discount,
      0
    );
  },

  getVatAmount: () => {
    const afterDiscount = get().getSubtotal() - get().discountAmount;
    return Math.max(0, Math.round(afterDiscount * 0.14 * 100) / 100);
  },

  getTotalAmount: () => {
    const net = get().getSubtotal() - get().discountAmount;
    return Math.max(0, net + get().getVatAmount());
  },
}));
