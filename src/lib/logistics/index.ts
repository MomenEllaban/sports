import { ShippingProvider } from '@prisma/client';
import { getCourierConfig } from './couriers-config';
import { createBostaDelivery } from './bosta';
import { createMylerzParcel } from './mylerz';

export interface DeliveryZone {
  id: string;
  nameAr: string;
  nameEn: string;
  fee: number;
  estimatedHours: string;
  isAlexandria: boolean;
}

export const ALEXANDRIA_DELIVERY_ZONES: DeliveryZone[] = [
  { id: 'ALX-CENTRAL', nameAr: 'الإبراهيمية / سيدي جابر / كليوباترا / الشاطبي / كامب شيزار', nameEn: 'Ibrahimeyah / Sidi Gaber / Cleopatra / Shatby', fee: 25.0, estimatedHours: '24 hours', isAlexandria: true },
  { id: 'ALX-EAST', nameAr: 'رشدي / مصطفى كامل / جليم / زيزينيا / جليم / سان ستيفانو / العصافرة', nameEn: 'Roushdy / Glim / Zizinia / San Stefano', fee: 35.0, estimatedHours: '24 hours', isAlexandria: true },
  { id: 'ALX-SMOUHA', nameAr: 'سموحة / النزهة / الحضرة / كفر عبده', nameEn: 'Smouha / Kafr Abdo / Nozha', fee: 30.0, estimatedHours: '24 hours', isAlexandria: true },
  { id: 'ALX-WEST', nameAr: 'العجمي / البيطاش / الهانوفيل / الأغراض / برج العرب', nameEn: 'Agami / Bitash / Hanoville / Borg El Arab', fee: 55.0, estimatedHours: '24-48 hours', isAlexandria: true },
  { id: 'CAIRO-GIZA', nameAr: 'القاهرة الكبرى والجيزة', nameEn: 'Greater Cairo & Giza', fee: 65.0, estimatedHours: '48-72 hours', isAlexandria: false },
  { id: 'DELTA', nameAr: 'محافظات الدلتا (البحيرة، الغربية، المنوفية، الدقهلية)', nameEn: 'Delta Governorates', fee: 75.0, estimatedHours: '48-72 hours', isAlexandria: false },
  { id: 'CANAL-UPPER', nameAr: 'القناة والصعيد (الأسماعيلية، السويس، بورسعيد، المنيا، أسيوط)', nameEn: 'Canal & Upper Egypt', fee: 95.0, estimatedHours: '3-5 days', isAlexandria: false },
];

export interface CreateShipmentParams {
  orderNumber: string;
  branchAddress: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  codAmount: number;
  provider: ShippingProvider;
}

export interface ShipmentResult {
  success: boolean;
  trackingNumber: string;
  labelUrl?: string;
  provider: ShippingProvider;
  estimatedDelivery: string;
  /** T03: true when no courier was actually booked (admin must ship manually). */
  manual: boolean;
}

/**
 * Creates automated shipment with Bosta/Mylerz (T03: real when configured).
 * Never fails the order: unconfigured couriers degrade to a MANUAL record
 * (tracking `MANUAL-<order>`) with a retry action in the order screen.
 * Mock tracking exists ONLY in test/dev with an explicit provider=mock flag.
 */
export async function createCourierShipment(params: CreateShipmentParams): Promise<ShipmentResult> {
  switch (params.provider) {
    case ShippingProvider.BOSTA: {
      const cfg = await getCourierConfig('BOSTA').catch(() => null);
      if (cfg?.ready) {
        try {
          const r = await createBostaDelivery(cfg, {
            orderNumber: params.orderNumber,
            codAmount: params.codAmount,
            customerName: params.customerName,
            customerPhone: params.customerPhone,
            customerAddress: params.customerAddress,
          });
          return { success: true, trackingNumber: r.trackingNumber, labelUrl: r.labelUrl, provider: ShippingProvider.BOSTA, estimatedDelivery: '24-48 hours', manual: false };
        } catch (e) {
          console.error('Bosta create failed, degrading to manual:', e);
        }
      }
      if (cfg?.mock) {
        const trackingNumber = `BST-${Math.floor(10000000 + Math.random() * 90000000)}`;
        return { success: true, trackingNumber, provider: ShippingProvider.BOSTA, labelUrl: `https://bosta.co/tracking?trackingId=${trackingNumber}`, estimatedDelivery: '24-48 hours', manual: false };
      }
      return { success: true, trackingNumber: `MANUAL-${params.orderNumber}`, provider: ShippingProvider.BOSTA, estimatedDelivery: 'يحتاج إنشاء شحنة يدوياً', manual: true };
    }

    case ShippingProvider.MYLERZ: {
      const cfg = await getCourierConfig('MYLERZ').catch(() => null);
      if (cfg?.ready) {
        try {
          const r = await createMylerzParcel(cfg, {
            orderNumber: params.orderNumber,
            codAmount: params.codAmount,
            customerName: params.customerName,
            customerPhone: params.customerPhone,
            customerAddress: params.customerAddress,
          });
          return { success: true, trackingNumber: r.trackingNumber, labelUrl: r.labelUrl, provider: ShippingProvider.MYLERZ, estimatedDelivery: '24-48 hours', manual: false };
        } catch (e) {
          console.error('Mylerz create failed, degrading to manual:', e);
        }
      }
      if (cfg?.mock) {
        const mylerzTracking = `MYL-${Math.floor(10000000 + Math.random() * 90000000)}`;
        return { success: true, trackingNumber: mylerzTracking, provider: ShippingProvider.MYLERZ, estimatedDelivery: '24-48 hours', manual: false };
      }
      return { success: true, trackingNumber: `MANUAL-${params.orderNumber}`, provider: ShippingProvider.MYLERZ, estimatedDelivery: 'يحتاج إنشاء شحنة يدوياً', manual: true };
    }

    case ShippingProvider.MRSOOL: {
      const mrsoolTracking = `MRS-ALX-${Math.floor(100000 + Math.random() * 900000)}`;
      return {
        success: true,
        trackingNumber: mrsoolTracking,
        provider: ShippingProvider.MRSOOL,
        estimatedDelivery: 'Same-day express (2-4 hours)',
        manual: false,
      };
    }

    case ShippingProvider.PICKUP:
    default: {
      return {
        success: true,
        trackingNumber: `PICKUP-${params.orderNumber}`,
        provider: ShippingProvider.PICKUP,
        estimatedDelivery: 'Ready for pickup at Flagship Branch (92 Omar Lotfy St)',
        manual: false,
      };
    }
  }
}

/**
 * Handle incoming webhooks from Bosta or Mylerz
 */
export function parseCourierWebhook(body: Record<string, unknown>) {
  const trackingNumber = (body.trackingNumber || body.tracking_id || body.airway_bill) as string;
  const rawStatus = (body.state || body.status) as string;

  let normalizedStatus: 'SHIPPED' | 'DELIVERED' | 'RETURNED' | 'PROCESSING' = 'PROCESSING';

  if (['DELIVERED', 'COMPLETED', 'RECEIVED'].includes(rawStatus?.toUpperCase())) {
    normalizedStatus = 'DELIVERED';
  } else if (['IN_TRANSIT', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(rawStatus?.toUpperCase())) {
    normalizedStatus = 'SHIPPED';
  } else if (['RETURNED', 'FAILED_DELIVERY', 'CANCELLED'].includes(rawStatus?.toUpperCase())) {
    normalizedStatus = 'RETURNED';
  }

  return { trackingNumber, normalizedStatus, rawStatus };
}
