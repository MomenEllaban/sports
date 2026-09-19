import { create } from 'zustand';
import { computeTotals } from '@/lib/pricing';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  price: number;
  image: string;
  quantity: number;
  availableStock: number;
}

interface CartState {
  items: CartItem[];
  selectedZone: string;
  deliveryFee: number;
  guestPhone: string;
  guestName: string;
  deliveryAddress: string;
  addItem: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  setZone: (zoneId: string, fee: number) => void;
  setGuestDetails: (details: { phone: string; name: string; address: string }) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getVatAmount: () => number;
  getTotalAmount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      selectedZone: 'ALX-CENTRAL',
      deliveryFee: 25.0,
      guestPhone: '',
      guestName: '',
      deliveryAddress: '',

      addItem: (item, qty = 1) => {
        const currentItems = get().items;
        const existing = currentItems.find((i) => i.id === item.id);

        if (existing) {
          const newQty = Math.min(existing.quantity + qty, item.availableStock);
          set({
            items: currentItems.map((i) => (i.id === item.id ? { ...i, quantity: newQty } : i)),
          });
        } else {
          set({
            items: [...currentItems, { ...item, quantity: Math.min(qty, item.availableStock) }],
          });
        }
      },

      removeItem: (id) => {
        set({ items: get().items.filter((i) => i.id !== id) });
      },

      updateQuantity: (id, qty) => {
        if (qty <= 0) {
          get().removeItem(id);
        } else {
          set({
            items: get().items.map((i) => (i.id === id ? { ...i, quantity: Math.min(qty, i.availableStock) } : i)),
          });
        }
      },

      setZone: (zoneId, fee) => {
        set({ selectedZone: zoneId, deliveryFee: fee });
      },

      setGuestDetails: ({ phone, name, address }) => {
        set({ guestPhone: phone, guestName: name, deliveryAddress: address });
      },

      clearCart: () => {
        set({ items: [] });
      },

      getSubtotal: () => {
        return computeTotals({ lines: get().items.map((i) => ({ unitPrice: i.price, quantity: i.quantity })) }).subtotal;
      },

      getVatAmount: () => {
        return computeTotals({ lines: get().items.map((i) => ({ unitPrice: i.price, quantity: i.quantity })) }).vat;
      },

      getTotalAmount: () => {
        const s = get();
        return computeTotals({
          lines: s.items.map((i) => ({ unitPrice: i.price, quantity: i.quantity })),
          deliveryFee: s.deliveryFee,
        }).total;
      },
    }),
    {
      name: 'sports-champions-cart',
    }
  )
);
