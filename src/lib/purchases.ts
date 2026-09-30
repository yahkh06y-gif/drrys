/**
 * RevenueCat integration — powers the "Drrys Pro" subscription.
 * Entitlement id: "drrys_pro" (as created in the RevenueCat dashboard). Offering: default ("current") with $rc_monthly and $rc_annual packages.
 *
 * Keys come from .env:
 *   EXPO_PUBLIC_RC_TEST_KEY    (RevenueCat Test Store key — works everywhere, no store account needed)
 *   EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY  (real store keys, optional)
 * In Expo Go the SDK runs in "Preview API mode" (mocked); use a development build for real purchases.
 */
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesOffering, type PurchasesPackage } from 'react-native-purchases';

import { friendBranches, MAX_OFF, squadReady, SQUAD_OFF } from '@/lib/rewards';
import { streak, useApp } from '@/store';

export const ENTITLEMENT = 'drrys_pro';

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

let ready: Promise<void> | undefined;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ask RevenueCat for the latest status; a request that's still busy (429 "in flight") is retried once. */
async function fetchInfo() {
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    await wait(1500);
    return Purchases.getCustomerInfo();
  }
}

export function initPurchases(appUserId?: string) {
  if (!rcEnabled) return Promise.resolve();
  if (ready) return ready;
  ready = (async () => {
    try {
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
      Purchases.configure({ apiKey: key, appUserID: appUserId });
      configured = true;
      Purchases.addCustomerInfoUpdateListener(syncPro);
      syncPro(await fetchInfo());
    } catch (e) {
      if (!configured) console.warn('[RevenueCat] init failed', e);
      // configured but the first status check failed: the listener and the next logIn catch up
    }
  })();
  return ready;
}

/** Tie the subscription to the Drrys account, so Pro follows the student to a new phone. */
export async function linkPurchases(uid?: string) {
  await ready; // one request at a time: logging in while the first status check runs makes RevenueCat answer 429
  if (!configured) return;
  try {
    if (uid) syncPro((await Purchases.logIn(uid)).customerInfo);
    else if (!(await Purchases.isAnonymous())) syncPro(await Purchases.logOut());
  } catch {
    // keep the current state; the listener catches up later
  }
}

export type Plan = {
  id: 'monthly' | 'yearly';
  price: string;
  perMonth: string;
  amount: number;
  pkg?: PurchasesPackage;
  fullPrice?: string; // the regular price, when a streak reward makes this one cheaper
};

/**
 * Streak rewards: Drrys gets cheaper the more consistently you study.
 *   30-day study streak → 25% off Pro (RevenueCat offering "streak25")
 *   60-day study streak → 30% off Pro (RevenueCat offering "streak30")
 * Each offering has its own discounted monthly + annual products; RevenueCat decides what's sold, the
 * app only picks which offering to show. Miss a day and the paywall goes back to the regular offering.
 */
export const STREAK_REWARDS = [
  { days: 60, off: 30, offering: 'streak30' },
  { days: 30, off: 25, offering: 'streak25' },
] as const;

export type StreakReward = { days: number; off: number; offering: string };
/** The study streak that counts for rewards: consecutive days with any study (all trees together). */
export const studyStreak = () => streak(useApp.getState().stats.studyDays);
export const rewardFor = (days: number): StreakReward | undefined => STREAK_REWARDS.find((r) => days >= r.days);
/** The next reward to aim for (for the "keep going" hint on the paywall). */
export const nextReward = (days: number): StreakReward | undefined => [...STREAK_REWARDS].reverse().find((r) => days < r.days);

const FALLBACK: Plan[] = [
  // shown only until RevenueCat answers (and in demo mode); keep in sync with the store products
  { id: 'monthly', price: '$9.99', perMonth: '$9.99', amount: 9.99 },
  { id: 'yearly', price: '$79.99', perMonth: '$6.67', amount: 79.99 },
];

/**
 * The discount the student has earned: streak reward + a full Study Squad, capped at 50%.
 * Each total maps to a RevenueCat offering with its own products (the app only picks which one to show).
 */
export type Discount = { off: number; offering: string; streak?: StreakReward; squad: boolean };
const OFFERING_FOR: Record<number, string> = { 25: 'streak25', 30: 'streak30', 50: 'bonus50' };
export function currentDiscount(): Discount | undefined {
  const streak = rewardFor(studyStreak());
  const squad = squadReady();
  const off = Math.min(MAX_OFF, (streak?.off ?? 0) + (squad ? SQUAD_OFF : 0));
  return off ? { off, offering: OFFERING_FOR[off], streak, squad } : undefined;
}

export type Pricing = { plans: Plan[]; discount?: Discount };

const plansOf = (o: PurchasesOffering | null | undefined): Plan[] => {
  const plans: Plan[] = [];
  if (!o) return plans;
  if (o.monthly) plans.push({ id: 'monthly', price: o.monthly.product.priceString, perMonth: o.monthly.product.priceString, amount: o.monthly.product.price, pkg: o.monthly });
  if (o.annual) {
    const p = o.annual.product;
    const perMonth = p.pricePerMonthString ?? `${p.currencyCode} ${(p.price / 12).toFixed(2)}`;
    plans.push({ id: 'yearly', price: p.priceString, perMonth, amount: p.price, pkg: o.annual });
  }
  return plans;
};

/** The plans to show: the discounted offering when the student has earned one, else the regular one. */
export async function getPricing(): Promise<Pricing> {
  const discount = currentDiscount();
  if (!configured) {
    if (!discount) return { plans: FALLBACK };
    // demo mode: show what the discount would look like
    const k = 1 - discount.off / 100;
    return {
      discount,
      plans: FALLBACK.map((p) => ({ ...p, fullPrice: p.price, amount: +(p.amount * k).toFixed(2), price: `$${(p.amount * k).toFixed(2)}`, perMonth: `$${((p.id === 'yearly' ? p.amount / 12 : p.amount) * k).toFixed(2)}` })),
    };
  }
  try {
    const off = await Purchases.getOfferings();
    const regular = plansOf(off.current);
    const special = discount ? plansOf(off.all[discount.offering]) : [];
    if (discount && special.length) {
      return { discount, plans: special.map((p) => ({ ...p, fullPrice: regular.find((r) => r.id === p.id)?.price })) };
    }
    return { plans: regular.length ? regular : FALLBACK };
  } catch {
    return { plans: FALLBACK };
  }
}

export async function getPlans(): Promise<Plan[]> {
  return (await getPricing()).plans;
}

/** Returns true when the user now has Pro. */
export async function buy(plan: Plan): Promise<boolean> {
  if (!rcEnabled) {
    // Demo mode (no RevenueCat key at all): unlock locally so the flow can be shown end-to-end.
    useApp.getState().set({ isPro: true });
    return true;
  }
  if (!configured || !plan.pkg) throw new Error('The store isn’t reachable right now. Check your connection and try again.');
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
  try {
    return syncPro(await Purchases.restorePurchases());
  } catch {
    return useApp.getState().isPro; // offline: keep what we know
  }
}

/** Free-tier limits (mirrors the Figma paywall copy). */
// Chapters = branches on the tree, and the Blender tree has 1–5 arms: free gets 1, Pro gets all 5.
export const LIMITS = { freeTrees: 1, freeChapters: 1, proTrees: 5, proChapters: 5 };

/**
 * When Pro ends (cancelled, expired, or a phone without the subscription), nothing is deleted:
 * trees and chapters beyond the free plan "rest". Their flashcards still come back, but a new full
 * session on them asks to renew Pro. The first tree's first chapter always stays open.
 */
export function isResting(subjectIdx: number, chapterIdx: number, isPro: boolean, t = useApp.getState().together) {
  return !isPro && (subjectIdx >= LIMITS.freeTrees || chapterIdx >= freeChapters(t));
}

/** Branches a free student can have: 1, or 2 after inviting a friend who studied (see together.ts). */
export const freeChapters = (t = useApp.getState().together) => LIMITS.freeChapters + friendBranches(t);
export const chapterLimit = (isPro: boolean, t = useApp.getState().together) => (isPro ? LIMITS.proChapters : freeChapters(t));
