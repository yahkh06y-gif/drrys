// Plans & Pricing — Drrys Pro via RevenueCat.
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Image } from 'expo-image';

import { COCO, STAT_ICONS } from '@/art';
import { Btn, Coco, Enter, IconBtn, Progress, T } from '@/components/ui';
import { haptic, play, tap } from '@/lib/feedback';
import { buy, getPricing, nextReward, rcEnabled, restore, studyStreak, type Discount, type Plan } from '@/lib/purchases';
import { friendBranches, MAX_OFF, refreshTogether, SQUAD_OFF, SQUAD_SIZE } from '@/lib/together';
import { cloudEnabled } from '@/lib/cloud';
import { PDF_LIMITS } from '@/lib/session';
import { useApp } from '@/store';
import { C, F } from '@/theme';

// What Pro really changes (keep this list honest: judges and students test it).
const PRO = [
  { icon: 'git-network-outline', t: '5 Knowledge Trees in parallel', d: 'A tree for every subject this semester' },
  { icon: 'layers-outline', t: 'Up to 5 chapters per tree', d: `A branch for every chapter, files up to ${PDF_LIMITS.proPages} pages` },
  { icon: 'flame-outline', t: 'Rewards that stack', d: `Study streak (25–30% off) + a full Study Squad (${SQUAD_OFF}% off), up to ${MAX_OFF}% off` },
  { icon: 'leaf-outline', t: 'Everything in Free', d: 'Voice recall, Coco’s feedback, spaced-repetition cards' },
] as const;

const FREE = ['1 Knowledge Tree (1 subject at a time)', `1 chapter per tree (files up to ${PDF_LIMITS.freePages} pages), 2 when you invite a friend`, 'Full study sessions with Coco: voice recall, feedback, flashcards', 'Cloud backup with a free account'];

export default function Paywall() {
  const isPro = useApp((s) => s.isPro);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [discount, setDiscount] = useState<Discount>();
  const together = useApp((s) => s.together);
  const squadCount = together?.squad?.members.length ?? 0;
  const canInvite = friendBranches(together) < 1;
  const days = studyStreak();
  const goal = nextReward(days);
  const [sel, setSel] = useState<'monthly' | 'yearly'>('yearly');
  const [busy, setBusy] = useState(false);

  // fresh squad / invite state first: it decides the price. Runs again when the paywall comes back
  // into view (e.g. after "Sign in to upgrade").
  useFocusEffect(
    useCallback(() => {
      refreshTogether().finally(() =>
        getPricing().then((p) => {
          setPlans(p.plans);
          setDiscount(p.discount);
        }),
      );
    }, []),
  );

  const plan = plans.find((p) => p.id === sel) ?? plans[0];
  // yearly saving vs paying monthly for 12 months, from the real store prices
  const mo = plans.find((p) => p.id === 'monthly')?.amount;
  const yr = plans.find((p) => p.id === 'yearly')?.amount;
  const save = mo && yr ? Math.round((1 - yr / (mo * 12)) * 100) : 0;

  // Pro belongs to an account (so it follows the student to any phone): sign in first
  const signedIn = useApp((s) => !!s.profile.uid);
  const needsAccount = cloudEnabled && !signedIn;

  const purchase = async () => {
    if (needsAccount) {
      tap();
      return router.push('/account'); // comes back here after signing in
    }
    if (!plan) return;
    setBusy(true);
    try {
      const ok = await buy(plan);
      if (ok) {
        play('celebrate');
        haptic('success');
        Alert.alert('Welcome to Drrys Pro 🌳', 'Your forest can now grow up to 5 trees.', [{ text: 'Let’s grow', onPress: () => router.back() }]);
      }
    } catch (e) {
      haptic('error');
      Alert.alert('Purchase failed', String((e as Error).message ?? e));
    }
    setBusy(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
        <IconBtn name="close" onPress={() => router.back()} />
        <T v="h3" style={{ color: C.teal }}>
          Plans & Pricing
        </T>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 30 }}>
        <Enter style={{ alignItems: 'center' }}>
          <Coco src={COCO.shovel} size={110} />
          <T v="h2" style={{ textAlign: 'center' }}>
            Grow your knowledge
          </T>
          <T style={{ textAlign: 'center' }}>Nurture your curiosity with deep, calm focus and mindful study habits.</T>
        </Enter>

        {isPro ? (
          <View style={{ backgroundColor: C.mint, borderRadius: 20, padding: 20, alignItems: 'center', gap: 6, borderWidth: 2, borderColor: C.mintBorder }}>
            <Text style={{ fontSize: 30 }}>🌳</Text>
            <Text style={{ fontFamily: F.bold, fontSize: 18, color: C.moss }}>You’re a Pro gardener</Text>
            <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.body, textAlign: 'center' }}>All features unlocked. Thank you for supporting Drrys!</Text>
          </View>
        ) : (
          <>
            {/* rewards: a study streak and a full Study Squad make Pro cheaper (stacked, up to 50% off) */}
            {discount ? (
              <Enter>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#FFF1DC', borderRadius: 18, borderWidth: 2, borderColor: C.orange, padding: 14 }}>
                  <Image source={STAT_ICONS.fire} style={{ width: 44, height: 44 }} contentFit="contain" />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.ink }}>Your reward: {discount.off}% off</Text>
                    {discount.streak && (
                      <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.body }}>
                        🔥 {discount.streak.off}% for studying {days} days in a row (while your streak lives)
                      </Text>
                    )}
                    {discount.squad && <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.body }}>🌳 {SQUAD_OFF}% for your full Study Squad</Text>}
                    {discount.streak && discount.squad && <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>Rewards stack up to {MAX_OFF}% off.</Text>}
                  </View>
                </View>
              </Enter>
            ) : goal ? (
              <View style={{ gap: 6, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Image source={STAT_ICONS.fire} style={{ width: 22, height: 22 }} contentFit="contain" />
                  <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 13, color: C.ink }}>
                    Study {goal.days} days in a row → {goal.off}% off Pro
                  </Text>
                  <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.orange }}>
                    {days}/{goal.days}
                  </Text>
                </View>
                <Progress value={days / goal.days} height={6} track={C.track} fill={C.orange} />
                {goal.days < 60 && <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>Keep it for 60 days and it’s 30% off.</Text>}
              </View>
            ) : null}

            {/* studying together: squad discount + a free branch for inviting a friend */}
            {!discount?.squad && (
              <Pressable
                accessibilityRole="button"
                onPress={() => (tap(), router.push('/together'))}
                style={{ gap: 8, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 18 }}>👥</Text>
                  <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 13, color: C.ink }}>
                    Study Squad: {SQUAD_SIZE} friends → {SQUAD_OFF}% off each
                  </Text>
                  <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.teal }}>{together?.squad ? `${squadCount}/${SQUAD_SIZE}` : 'Start'}</Text>
                </View>
                {together?.squad && <Progress value={squadCount / SQUAD_SIZE} height={6} track={C.track} fill={C.teal} />}
                {canInvite && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>🌿</Text>
                    <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 13, color: C.ink }}>Invite 1 friend → a free 2nd branch</Text>
                    <Ionicons name="chevron-forward" size={16} color={C.muted} />
                  </View>
                )}
              </Pressable>
            )}

            <View style={{ flexDirection: 'row', backgroundColor: C.sand, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: C.line }}>
              {(['monthly', 'yearly'] as const).map((p) => (
                <Pressable key={p} onPress={() => (tap('select'), setSel(p))} style={{ flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', paddingVertical: 10, borderRadius: 11, backgroundColor: sel === p ? C.teal : 'transparent' }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 13, color: sel === p ? C.white : C.body, textTransform: 'capitalize' }}>{p}</Text>
                  {p === 'yearly' && save > 0 && (
                    <Text style={{ fontFamily: F.bold, fontSize: 9, color: C.mossDark, backgroundColor: '#BEF37F', borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 }}>save {save}%</Text>
                  )}
                </Pressable>
              ))}
            </View>

            <View style={{ backgroundColor: C.white, borderRadius: 22, borderWidth: 2, borderColor: C.teal, borderBottomWidth: 6, padding: 18, gap: 12 }}>
              <View>
                <Text style={{ fontFamily: F.bold, fontSize: 22, color: C.teal }}>Drrys Pro</Text>
                <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>For students with a full semester: every subject and every chapter in one forest.</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, backgroundColor: C.paper, borderRadius: 12, padding: 10 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 30, color: C.teal }}>{plan?.perMonth ?? '—'}</Text>
                <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 12, color: C.muted }}>
                  / month{sel === 'yearly' ? `, billed ${plan?.price ?? ''} yearly` : ''}
                  {plan?.fullPrice ? (
                    <>
                      {'\n'}
                      <Text style={{ textDecorationLine: 'line-through' }}>{plan.fullPrice}</Text>
                      <Text style={{ color: C.orange, fontFamily: F.bold }}>{`  ${discount?.off ?? ''}% off`}</Text>
                    </>
                  ) : null}
                </Text>
              </View>
              {PRO.map((f) => (
                <View key={f.t} style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={f.icon} size={13} color={C.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.ink }}>{f.t}</Text>
                    <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>{f.d}</Text>
                  </View>
                </View>
              ))}
              <Btn title={needsAccount ? 'Sign in to upgrade' : 'Upgrade to Drrys Pro'} iconLeft={needsAccount ? 'person' : 'leaf'} kind="teal" loading={busy} onPress={purchase} />
              {needsAccount && (
                <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted, textAlign: 'center' }}>A free account keeps your Pro and your forest safe on any phone.</Text>
              )}
            </View>

            <View style={{ backgroundColor: '#F1EEE6', borderRadius: 20, padding: 16, gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.leaf }}>Free Plan</Text>
                <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.muted, backgroundColor: C.white, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>Current plan</Text>
              </View>
              <Text style={{ fontFamily: F.bold, fontSize: 22, color: C.ink }}>
                $0 <Text style={{ fontSize: 12, color: C.muted }}>/ forever free</Text>
              </Text>
              {FREE.map((f) => (
                <View key={f} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={C.leaf} />
                  <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.body }}>{f}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14 }}>
          {['instant access', 'secure checkout', 'no lock-in'].map((x) => (
            <Text key={x} style={{ fontFamily: F.medium, fontSize: 10, color: C.leaf }}>
              ✓ {x}
            </Text>
          ))}
        </View>
        <Pressable
          onPress={async () => {
            tap();
            const ok = await restore();
            Alert.alert(ok ? 'Pro restored 🌳' : 'No active subscription found');
          }}
          style={{ alignSelf: 'center' }}>
          <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.teal, textDecorationLine: 'underline' }}>Restore purchases</Text>
        </Pressable>
        <Text style={{ fontFamily: F.medium, fontSize: 10, color: C.muted, textAlign: 'center' }}>
          {rcEnabled ? 'Payments processed securely via the App Store / Google Play, powered by RevenueCat.' : 'Demo mode — add a RevenueCat key to enable real purchases.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
