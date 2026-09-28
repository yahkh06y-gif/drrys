/**
 * RevenueCat integration — powers the "Drrys Pro" subscription.
 * Entitlement id: "pro". Offering: default ("current") with $rc_monthly and $rc_annual packages.
 *
 * Keys come from .env:
 *   EXPO_PUBLIC_RC_TEST_KEY    (RevenueCat Test Store key — works everywhere, no store account needed)
 *   EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY  (real store keys, optional)
 * In Expo Go the SDK runs in "Preview API mode" (mocked); use a development build for real purchases.
 */
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

import { useApp } from '@/store';

export const ENTITLEMENT = 'pro';

const key =
  (Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_RC_IOS_KEY : process.env.EXPO_PUBLIC_RC_ANDROID_KEY) ||
  process.env.EXPO_PUBLIC_RC_TEST_KEY ||
  '';

export const rcEnabled = key.length > 5 && Platform.OS !== 'web';
let configured = false;

const syncPro = (info: CustomerInfo) => {
  const active = !!info.entitlements.active[ENTITLEMENT];
  useApp.getState().set({ isPro: active });
  return active;
};

export async function initPurchases(appUserId?: string) {
  if (!rcEnabled || configured) return;
  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: key, appUserID: appUserId });
    configured = true;
    Purchases.addCustomerInfoUpdateListener(syncPro);
    syncPro(await Purchases.getCustomerInfo());
  } catch (e) {
    console.warn('[RevenueCat] init failed', e);
  }
}

export type Plan = { id: 'monthly' | 'yearly'; price: string; perMonth: string; pkg?: PurchasesPackage };

const FALLBACK: Plan[] = [
  { id: 'monthly', price: '$12.99', perMonth: '$12.99' },
  { id: 'yearly', price: '$119.99', perMonth: '$10.00' },
];

export async function getPlans(): Promise<Plan[]> {
  if (!configured) return FALLBACK;
  try {
    const off = await Purchases.getOfferings();
    const cur = off.current;
    if (!cur) return FALLBACK;
    const plans: Plan[] = [];
    if (cur.monthly)
      plans.push({ id: 'monthly', price: cur.monthly.product.priceString, perMonth: cur.monthly.product.priceString, pkg: cur.monthly });
    if (cur.annual) {
      const p = cur.annual.product;
      const perMonth = p.pricePerMonthString ?? `${p.currencyCode} ${(p.price / 12).toFixed(2)}`;
      plans.push({ id: 'yearly', price: p.priceString, perMonth, pkg: cur.annual });
    }
    return plans.length ? plans : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

/** Returns true when the user now has Pro. */
export async function buy(plan: Plan): Promise<boolean> {
  if (!configured || !plan.pkg) {
    // Demo mode (no RevenueCat key yet): unlock locally so the flow can be shown end-to-end.
    useApp.getState().set({ isPro: true });
    return true;
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(plan.pkg);
    return syncPro(customerInfo);
  } catch (e: unknown) {
    if ((e as { userCancelled?: boolean }).userCancelled) return false;
    throw e;
  }
}

export async function restore(): Promise<boolean> {
  if (!configured) return useApp.getState().isPro;
  return syncPro(await Purchases.restorePurchases());
}

/** Free-tier limits (mirrors the Figma paywall copy). */
export const LIMITS = { freeTrees: 1, freeChapters: 5, proTrees: 5, proChapters: 7 };
