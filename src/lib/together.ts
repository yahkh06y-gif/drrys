/**
 * Studying together (Supabase functions, see the `squads_and_referrals` migration):
 *  - Invite a friend: every account has a code. When a friend joins with it AND finishes their first
 *    session, a free student gets a 2nd branch (chapter) on their trees. One friend is enough; it stops there.
 *  - Study Squad: up to 4 friends share a squad code. When the squad is full, each of them gets 25% off
 *    Pro (RevenueCat offering), on top of a streak reward but never more than 50% off in total.
 * Anti-cheat lives in the database: not your own code, one referral per student, no swapping codes,
 * one squad per student, 4 per squad.
 */
import { rpc } from '@/lib/cloud';
import { useApp, type Together } from '@/store';

export { APP_LINK, FRIEND_BRANCHES, friendBranches, MAX_OFF, squadReady, SQUAD_OFF, SQUAD_SIZE } from '@/lib/rewards';

const signedIn = () => !!useApp.getState().profile.uid;
const myName = () => useApp.getState().profile.name?.trim() || 'Student';

/** Load the latest invite + squad state from the account. */
export async function refreshTogether(): Promise<Together | undefined> {
  if (!signedIn()) {
    if (useApp.getState().together) useApp.getState().set({ together: undefined });
    return undefined;
  }
  try {
    const t = await rpc<Together | null>('my_together');
    useApp.getState().set({ together: t ?? undefined });
    return t ?? undefined;
  } catch {
    return useApp.getState().together; // offline: keep what we know
  }
}

export async function myInviteCode(): Promise<string> {
  const code = await rpc<string>('my_code');
  await refreshTogether();
  return code;
}

export async function startSquad(): Promise<string> {
  const code = await rpc<string>('create_squad', { p_name: myName() });
  await refreshTogether();
  return code;
}

export async function leaveSquad() {
  await rpc('leave_squad');
  await refreshTogether();
}

const MESSAGES: Record<string, string> = {
  signin: 'Sign in first, so the code can be linked to your account.',
  unknown: 'That code doesn’t exist. Check the letters and try again.',
  own: 'That’s your own code. Send it to a friend instead!',
  already: 'You already joined with a friend’s invite.',
  in_squad: 'You’re already in a squad. Leave it first to join another one.',
  squad_full: 'That squad already has 4 friends.',
};

/** One box for any friend's code: a squad code joins the squad, an invite code links you to your friend. */
export async function redeemCode(code: string): Promise<{ ok: boolean; kind?: 'squad' | 'referral'; message: string }> {
  const r = await rpc<string>('use_code', { p_code: code.trim(), p_name: myName() });
  await refreshTogether();
  if (r === 'squad_joined') return { ok: true, kind: 'squad', message: 'You’re in the squad! 🌳' };
  if (r === 'referral_ok') return { ok: true, kind: 'referral', message: 'Linked! Finish your first session and your friend gets a new branch.' };
  return { ok: false, message: MESSAGES[r] ?? 'Something went wrong. Try again.' };
}

/** After a session: if this student was invited, their friend's reward unlocks (once). */
export async function completeReferral() {
  const t = useApp.getState().together;
  if (!signedIn() || !t?.invited) return;
  try {
    await rpc('complete_referral');
  } catch {
    // retried after the next session
  }
}

