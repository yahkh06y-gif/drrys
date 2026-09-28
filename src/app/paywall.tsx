// Plans & Pricing — Drrys Pro via RevenueCat.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { Btn, Coco, Enter, IconBtn, T } from '@/components/ui';
import { haptic, play, tap } from '@/lib/feedback';
import { buy, getPlans, rcEnabled, restore, type Plan } from '@/lib/purchases';
import { useApp } from '@/store';
import { C, F } from '@/theme';

const PRO = [
  { icon: 'git-network-outline', t: '5 Knowledge Trees in parallel', d: 'Manage multiple subjects simultaneously' },
  { icon: 'layers-outline', t: 'Up to 7 chapters per tree', d: 'Complete end-to-end semester breakdown' },
  { icon: 'infinite-outline', t: 'Unlimited daily study actions', d: 'Learn at your highest natural momentum' },
  { icon: 'albums-outline', t: 'Unlimited flashcards & active recall', d: 'Adaptive spaced-repetition memory engine' },
  { icon: 'sparkles-outline', t: 'High-speed AI companion memory', d: 'Coco remembers your past mistakes & queries' },
  { icon: 'shirt-outline', t: 'Exclusive Coco outfits', d: 'Seasonal closet drops for Pro gardeners' },
] as const;

const FREE = ['1 Knowledge Tree (1 subject at a time)', 'Up to 5 chapters per tree', 'Limited daily study actions', 'Standard AI answers with Coco'];

export default function Paywall() {
  const isPro = useApp((s) => s.isPro);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sel, setSel] = useState<'monthly' | 'yearly'>('yearly');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPlans().then(setPlans);
  }, []);

  const plan = plans.find((p) => p.id === sel) ?? plans[0];

  const purchase = async () => {
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
      play('wrong');
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
            <View style={{ flexDirection: 'row', backgroundColor: C.sand, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: C.line }}>
              {(['monthly', 'yearly'] as const).map((p) => (
                <Pressable key={p} onPress={() => (tap('select'), setSel(p))} style={{ flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', paddingVertical: 10, borderRadius: 11, backgroundColor: sel === p ? C.teal : 'transparent' }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 13, color: sel === p ? C.white : C.body, textTransform: 'capitalize' }}>{p}</Text>
                  {p === 'yearly' && (
                    <Text style={{ fontFamily: F.bold, fontSize: 9, color: C.mossDark, backgroundColor: '#BEF37F', borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 }}>save 20%</Text>
                  )}
                </Pressable>
              ))}
            </View>

            <View style={{ backgroundColor: C.white, borderRadius: 22, borderWidth: 2, borderColor: C.teal, borderBottomWidth: 6, padding: 18, gap: 12 }}>
              <View>
                <Text style={{ fontFamily: F.bold, fontSize: 22, color: C.teal }}>Drrys Pro</Text>
                <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>For dedicated learners looking to master their curriculum without boundaries.</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, backgroundColor: C.paper, borderRadius: 12, padding: 10 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 30, color: C.teal }}>{plan?.perMonth ?? '—'}</Text>
                <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>/ month{sel === 'yearly' ? `, billed ${plan?.price ?? ''} yearly` : ''}</Text>
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
              <Btn title="Upgrade to Forest Pro" iconLeft="leaf" kind="teal" loading={busy} onPress={purchase} />
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
