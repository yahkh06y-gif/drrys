/**
 * Accounts + cloud backup (Supabase).
 *  - Sign in / sign up with email and password (Supabase Auth). The session survives app restarts.
 *  - The student's forest (profile, trees, cards, stats, Coco) is backed up to the `forests` table
 *    (one row per user, a JSON column) a few seconds after every change, and restored on a new phone.
 * Config comes from EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env. The
 * publishable key is meant to ship in apps — row level security makes each user see only their own row.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { LIMITS, linkPurchases } from '@/lib/purchases';
import { EMPTY_STATS, useApp, type Card, type Subject } from '@/store';

// Drrys' own Supabase project. The publishable key is public by design (RLS guards the data), so it can
// live in the code; .env can point the app at a different project.
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://jvoqecqeldykhysaqkkd.supabase.co';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable__y4DT3FHtXGy3SG-66Rp4g_X1czO-Le';
export const cloudEnabled = /^https:\/\//.test(URL) && KEY.length > 10;

/** Call one of Drrys' server functions (supabase/functions). The publishable key only says "this is the
 *  Drrys app"; secret keys (like Qloo's) stay on the server. */
export async function callFunction<T>(name: string, body: unknown, timeoutMs = 15000): Promise<T> {
  if (!cloudEnabled) throw new Error('No server configured');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: KEY },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`${name} ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

let sb: SupabaseClient | undefined;
function client() {
  if (!cloudEnabled) return undefined;
  if (!sb) {
    sb = createClient(URL, KEY, {
      auth: {
        ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    // keep the login fresh only while the app is open
    AppState.addEventListener('change', (st) => (st === 'active' ? sb!.auth.startAutoRefresh() : sb!.auth.stopAutoRefresh()));
  }
  return sb;
}

/** Everything worth keeping across phones (not the running session, sounds or the Pro flag — RevenueCat owns that). */
function snapshot() {
  const s = useApp.getState();
  return JSON.parse(
    JSON.stringify({
      onboarded: s.onboarded,
      profile: s.profile,
      subjects: s.subjects,
      activeSubjectId: s.activeSubjectId ?? null,
      cards: s.cards,
      stats: s.stats,
      coco: s.coco,
      coachSeen: s.coachSeen,
      world: s.world,
      plan: s.plan,
      updatedAt: Date.now(),
    }),
  );
}

let timer: ReturnType<typeof setTimeout> | undefined;
let unsubStore: (() => void) | undefined;
let restoring = false;

async function upload(uid: string) {
  const c = client();
  if (!c) return;
  try {
    await c.from('forests').upsert({ user_id: uid, data: snapshot(), updated_at: new Date().toISOString() });
  } catch {
    // offline — the next change tries again
  }
}

/** Back up a few seconds after each change while signed in. */
function startBackup(uid: string) {
  unsubStore?.();
  let last = '';
  unsubStore = useApp.subscribe((s) => {
    if (restoring || !s.hydrated) return;
    const key = JSON.stringify([s.profile, s.subjects, s.cards, s.stats, s.coco, s.onboarded, s.coachSeen, s.world, s.plan]);
    if (key === last) return;
    last = key;
    clearTimeout(timer);
    timer = setTimeout(() => upload(uid), 3000);
  });
}

type Remote = ReturnType<typeof snapshot> | undefined;

/** Put the account's forest on this phone. */
function applyRemote(remote: NonNullable<Remote>, extra: { subjects: Subject[]; cards: Card[] }, keepSession: boolean) {
  const local = useApp.getState();
  const subjects = [...(remote.subjects ?? []), ...extra.subjects];
  restoring = true;
  local.set({
    onboarded: remote.onboarded || local.onboarded,
    profile: { ...local.profile, ...remote.profile, signedIn: true },
    subjects,
    activeSubjectId: remote.activeSubjectId ?? subjects[0]?.id,
    cards: [...(remote.cards ?? []), ...extra.cards],
    stats: remote.stats ?? local.stats,
    coco: remote.coco ?? local.coco,
    coachSeen: remote.coachSeen ?? local.coachSeen,
    world: remote.world ?? local.world,
    plan: remote.plan ?? local.plan,
    ...(keepSession ? {} : { session: undefined }),
  });
  restoring = false;
}

/**
 * Sync this phone with the account.
 *  - on app launch: the phone is the newest copy — it's uploaded; the cloud is only brought back when
 *    the phone has no trees at all (a reinstall or "Reset app").
 *  - on sign-in: the account's forest comes back. Trees on the phone are kept only if they belong to
 *    the same person (signed out and back in); a different account never gets someone else's trees.
 */
async function restoreOrUpload(uid: string, onLaunch = false): Promise<{ restored: boolean; known: boolean }> {
  const c = client();
  if (!c) return { restored: false, known: false };
  try {
    const { data: row, error } = await c.from('forests').select('data').eq('user_id', uid).maybeSingle();
    if (error) throw error;
    const remote = (row?.data ?? undefined) as Remote;
    const local = useApp.getState();
    const known = !!remote?.onboarded; // this account already went through onboarding once
    const hasRemote = !!remote?.subjects?.length;

    if (onLaunch) {
      if (!local.subjects.length && hasRemote) {
        applyRemote(remote!, { subjects: [], cards: [] }, true);
        return { restored: true, known };
      }
      await upload(uid);
      return { restored: false, known };
    }

    const prev = local.profile.lastUid;
    const samePerson = !prev || prev === uid;
    if (prev === uid && local.subjects.length) {
      // the same student signing back in on this phone: their last backup was made at sign-out, so what
      // they did since (signed out) is the newest copy. Keep it and back it up.
      if (known && !local.onboarded) local.set({ onboarded: true });
      await upload(uid);
      return { restored: false, known };
    }
    if (hasRemote) {
      // same person: keep trees made on this phone meanwhile. Otherwise (a new phone, the onboarding tree,
      // or someone else's leftovers) the account's own forest wins.
      const ids = new Set(remote!.subjects.map((x: Subject) => x.id));
      const cardIds = new Set((remote!.cards ?? []).map((x: Card) => x.id));
      // trees planted on this phone are kept (same person), as long as the plan has room for them
      const room = Math.max(0, (local.isPro ? LIMITS.proTrees : LIMITS.freeTrees) - remote!.subjects.length);
      const newTrees = samePerson ? local.subjects.filter((x) => !ids.has(x.id)).slice(0, room) : [];
      const kept = new Set(newTrees.map((x) => x.id));
      const extra = { subjects: newTrees, cards: local.cards.filter((x) => kept.has(x.subjectId) && !cardIds.has(x.id)) };
      applyRemote(remote!, extra, false);
      if (extra.subjects.length) await upload(uid);
      return { restored: true, known };
    }
    if (!samePerson) {
      // an empty account signing in where someone else's forest is: start this account fresh
      local.set({ subjects: [], cards: [], activeSubjectId: undefined, stats: { ...EMPTY_STATS }, session: undefined });
    }
    // nothing to bring back, but keep what the account already told us (e.g. how they heard of Drrys)
    if (remote?.profile) local.setProfile({ ...remote.profile, ...local.profile, source: local.profile.source ?? remote.profile.source });
    if (known && !local.onboarded) local.set({ onboarded: true });
    await upload(uid);
    return { restored: false, known };
  } catch {
    restoring = false;
  }
  return { restored: false, known: false };
}

export type AuthResult = { ok: true; restored: boolean; known: boolean } | { ok: false; error: string };

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Wrong email or password.',
  user_already_exists: 'There’s already an account with this email — sign in instead.',
  email_exists: 'There’s already an account with this email — sign in instead.',
  weak_password: 'Use at least 6 characters for the password.',
  email_address_invalid: 'That email doesn’t look right.',
  validation_failed: 'That email doesn’t look right.',
  email_not_confirmed: 'Confirm your email first (check your inbox), then sign in.',
  over_email_send_rate_limit: 'Too many tries. Wait a minute and try again.',
  over_request_rate_limit: 'Too many tries. Wait a minute and try again.',
};
const explain = (e: unknown) => {
  const err = e as { code?: string; message?: string; name?: string };
  if (err.code && MESSAGES[err.code]) return MESSAGES[err.code];
  if (/fetch|network/i.test(err.message ?? '')) return 'No connection. Check your internet and try again.';
  return err.message || 'Something went wrong. Try again.';
};

async function afterAuth(user: User, name?: string): Promise<AuthResult> {
  const s = useApp.getState();
  s.setProfile({ email: user.email ?? '', signedIn: true, uid: user.id, ...(name ? { name } : {}) });
  const { restored, known } = await restoreOrUpload(user.id);
  startBackup(user.id);
  linkPurchases(user.id);
  return { ok: true, restored, known };
}

export async function signUp(email: string, password: string, name: string): Promise<AuthResult> {
  const c = client();
  if (!c) return { ok: false, error: 'Accounts aren’t set up in this build.' };
  try {
    const { data, error } = await c.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } });
    if (error) throw error;
    if (!data.session || !data.user) return { ok: false, error: 'Almost there: confirm your email (check your inbox), then sign in.' };
    return afterAuth(data.user, name.trim() || undefined);
  } catch (e) {
    return { ok: false, error: explain(e) };
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const c = client();
  if (!c) return { ok: false, error: 'Accounts aren’t set up in this build.' };
  try {
    const { data, error } = await c.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    return afterAuth(data.user);
  } catch (e) {
    return { ok: false, error: explain(e) };
  }
}

/** Call a database function as the signed-in student (see together.ts). */
export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const c = client();
  if (!c) throw new Error('Accounts aren’t set up in this build.');
  const { data, error } = await c.rpc(fn, args);
  if (error) throw new Error(explain(error));
  return data as T;
}

/** "Reset app": forget the login on this phone without touching the cloud copy. */
export async function forgetLogin() {
  unsubStore?.();
  unsubStore = undefined;
  clearTimeout(timer);
  await client()?.auth.signOut({ scope: 'local' }).catch(() => {});
}

/** Sign out: the forest stays on this phone, it just stops backing up. */
export async function signOut() {
  unsubStore?.();
  unsubStore = undefined;
  clearTimeout(timer);
  const s = useApp.getState();
  const uid = s.profile.uid;
  if (uid) await upload(uid); // last backup first
  await client()?.auth.signOut().catch(() => {});
  s.set({ together: undefined });
  s.setProfile({ signedIn: false, uid: undefined, lastUid: uid }); // remembered so a different account never inherits this forest
  linkPurchases(undefined);
}

/** On app start: if Supabase still has the user signed in, resume backups. */
export function initCloud() {
  const c = client();
  if (!c) return;
  let resumed = false;
  const resume = (user: User) => {
    if (resumed) return;
    resumed = true;
    useApp.getState().setProfile({ uid: user.id, email: user.email ?? useApp.getState().profile.email, signedIn: true });
    // bring back anything this phone is missing before backups start
    restoreOrUpload(user.id, true).finally(() => startBackup(user.id));
    linkPurchases(user.id);
  };
  c.auth
    .getSession()
    .then(({ data }) => {
      const user = data.session?.user;
      if (user) return resume(user);
      // opened offline: the saved login comes back once the token refreshes
      if (useApp.getState().profile.uid) {
        const { data: sub } = c.auth.onAuthStateChange((event, session) => {
          if (session?.user && event === 'TOKEN_REFRESHED' && session.user.id === useApp.getState().profile.uid) {
            sub.subscription.unsubscribe();
            resume(session.user);
          }
        });
      }
    })
    .catch(() => {});
}
