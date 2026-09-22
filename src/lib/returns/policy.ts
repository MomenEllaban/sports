import { getSetting } from '../settings';

/** Returns policy bundle (T-RMA §4) — every value admin-confirmable. */
export interface ReturnsPolicy {
  enabled: boolean;
  windowDays: number;
  exchangeWindowDays: number;
  nonReturnableCategories: string[];
  requireReceipt: boolean;
  reasons: string[];
  requirePhotoForReasons: string[];
  refundDeliveryFee: 'ALWAYS' | 'FULL_RETURN_OR_OUR_FAULT' | 'NEVER';
  restockingFeePct: number;
  whoPaysReturnShipping: string;
  cashRefundManagerThreshold: number;
  autoApproveMaxValue: number;
  maxReturnsPerCustomerPerMonth: number;
  allowedRefundMethods: string[];
  slaHours: number;
  receiveBranchDefault: string;
  reverseCourierEnabled: boolean;
  allowNegativeOnReturn: boolean;
  restoreOnFullReturn: boolean;
  notifyWhatsapp: boolean;
}

export async function getReturnsPolicy(): Promise<ReturnsPolicy> {
  const [enabled, windowDays, exchangeWindowDays, nonReturnableCategories, requireReceipt,
    reasons, requirePhotoForReasons, refundDeliveryFee, restockingFeePct, whoPaysReturnShipping,
    cashRefundManagerThreshold, autoApproveMaxValue, maxReturnsPerCustomerPerMonth,
    allowedRefundMethods, slaHours, receiveBranchDefault, reverseCourierEnabled,
    allowNegativeOnReturn, restoreOnFullReturn, notifyWhatsapp] = await Promise.all([
    getSetting<boolean>('returns.enabled', true),
    getSetting<number>('returns.windowDays', 14),
    getSetting<number>('returns.exchangeWindowDays', 14),
    getSetting<string[]>('returns.nonReturnableCategories', []),
    getSetting<boolean>('returns.requireReceipt', true),
    getSetting<string[]>('returns.reasons', ['SIZE_ISSUE', 'DEFECTIVE', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'CHANGED_MIND', 'OTHER']),
    getSetting<string[]>('returns.requirePhotoForReasons', ['DEFECTIVE']),
    getSetting<string>('returns.refundDeliveryFee', 'FULL_RETURN_OR_OUR_FAULT'),
    getSetting<number>('returns.restockingFeePct', 0),
    getSetting<string>('returns.whoPaysReturnShipping', 'STORE_IF_OUR_FAULT'),
    getSetting<number>('returns.cashRefundManagerThreshold', 500),
    getSetting<number>('returns.autoApproveMaxValue', 1000),
    getSetting<number>('returns.maxReturnsPerCustomerPerMonth', 5),
    getSetting<string[]>('returns.allowedRefundMethods', ['CASH', 'ORIGINAL_GATEWAY']),
    getSetting<number>('returns.slaHours', 72),
    getSetting<string>('returns.receiveBranchDefault', 'SALE_BRANCH'),
    getSetting<boolean>('returns.reverseCourierEnabled', false),
    getSetting<boolean>('loyalty.allowNegativeOnReturn', true),
    getSetting<boolean>('coupons.restoreOnFullReturn', false),
    getSetting<boolean>('returns.notifyWhatsapp', true),
  ]);
  const fee = ['ALWAYS', 'FULL_RETURN_OR_OUR_FAULT', 'NEVER'].includes(refundDeliveryFee)
    ? (refundDeliveryFee as ReturnsPolicy['refundDeliveryFee']) : 'FULL_RETURN_OR_OUR_FAULT';
  return {
    enabled, windowDays: Math.max(0, windowDays), exchangeWindowDays: Math.max(0, exchangeWindowDays || windowDays),
    nonReturnableCategories: Array.isArray(nonReturnableCategories) ? nonReturnableCategories : [],
    requireReceipt, reasons: Array.isArray(reasons) && reasons.length > 0 ? reasons : ['OTHER'],
    requirePhotoForReasons: Array.isArray(requirePhotoForReasons) ? requirePhotoForReasons : [],
    refundDeliveryFee: fee, restockingFeePct: Math.max(0, restockingFeePct), whoPaysReturnShipping,
    cashRefundManagerThreshold: Math.max(0, cashRefundManagerThreshold),
    autoApproveMaxValue: Math.max(0, autoApproveMaxValue),
    maxReturnsPerCustomerPerMonth: Math.max(0, maxReturnsPerCustomerPerMonth),
    allowedRefundMethods: Array.isArray(allowedRefundMethods) ? allowedRefundMethods : [],
    slaHours: Math.max(0, slaHours), receiveBranchDefault, reverseCourierEnabled,
    allowNegativeOnReturn, restoreOnFullReturn, notifyWhatsapp,
  };
}
