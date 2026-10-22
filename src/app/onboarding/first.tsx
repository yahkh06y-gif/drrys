// "Your first Coco explanation" — the peak of onboarding: a famously hard idea from the student's own
// field, explained through something from their world (themes from Qloo, analogy by the AI).
// "See it the usual way" flips the card to the dry textbook version, so the difference is felt.
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { Btn, Enter, OnbBar } from '@/components/ui';
import { explainWithWorld } from '@/lib/ai';
import { tap } from '@/lib/feedback';
import { conceptFor, LEARN_YOUR_WAY, progressOf, subfieldName } from '@/lib/onboarding';
import { TYPE_EMOJI, TYPE_LABEL } from '@/lib/qloo';
import { useApp, type WorldItem } from '@/store';
import { C, F } from '@/theme';

/** The thing to explain with: a show or movie with themes first (their tags are the richest), then anything picked. */
function bestPick(picks: WorldItem[]): WorldItem | undefined {
  const rich = (x: WorldItem) => (x.type === 'tv_show' || x.type === 'movie' ? 2 : 0) + Math.min(1, (x.tags?.length ?? 0) / 5);
  return [...picks].sort((a, b) => rich(b) - rich(a))[0];
}

export default function First() {
  const profile = useApp((s) => s.profile);
  const world = useApp((s) => s.world);
  const concept = conceptFor(profile.field, profile.subfield);
  const fieldName = subfieldName(profile.field, profile.subfield);
  const pick = bestPick(world.picks);
  const [analogy, setAnalogy] = useState<string | null | undefined>(undefined); // undefined = still thinking
  const [usual, setUsual] = useState(false);
  const flip = useSharedValue(0);

  useEffect(() => {
    let live = true;
    if (!pick) return setAnalogy(null);
    explainWithWorld(
      { name: concept.name, usual: concept.usual, field: fieldName },
      { name: pick.name, kind: TYPE_LABEL[pick.type], themes: pick.tags?.length ? pick.tags : world.tags },
    )
      .then((a) => live && setAnalogy(a))
      .catch(() => live && setAnalogy(null));
    return () => {
      live = false;
    };
    // the explanation is made once, when the screen opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const personal = !!analogy && !!pick;
  const title = personal ? `${concept.name}, the ${pick!.name} way` : `${concept.name}, made simple`;

  const turn = () => {
    tap('flip');
    setUsual((u) => !u);
    flip.value = withTiming(usual ? 0 : 1, { duration: 450 });
  };
  const front = useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }] }));
  const back = useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }] }));

  const face = { backfaceVisibility: 'hidden' as const, borderRadius: 24, padding: 18, borderWidth: 2, borderBottomWidth: 6, minHeight: 280 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        <OnbBar value={progressOf('first')} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={COCO.classic} style={{ width: 48, height: 60 }} contentFit="contain" />
          <Enter key={usual ? 'u' : 'w'} style={{ flex: 1 }}>
            <View style={{ backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 9 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.teal }}>{usual ? 'See the difference? 😏' : 'Let me show you how we’ll study.'}</Text>
            </View>
          </Enter>
        </View>

        <View>
          {/* your way */}
          <Animated.View style={[face, { backgroundColor: C.white, borderColor: C.bark, gap: 12 }, front]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {pick && personal && (
                <View style={{ width: 46, height: 46, borderRadius: 23, overflow: 'hidden', backgroundColor: C.sand, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 24 }}>{TYPE_EMOJI[pick.type]}</Text>
                </View>
              )}
              <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 22, lineHeight: 27, color: C.teal }}>{analogy === undefined ? concept.name : title}</Text>
            </View>
            {analogy === undefined ? (
              <Text style={{ fontFamily: F.medium, fontSize: 15, color: C.muted }}>Coco is connecting it to your world…</Text>
            ) : (
              <Enter>
                <Text style={{ fontFamily: F.medium, fontSize: 16, lineHeight: 24, color: C.ink }}>{analogy ?? concept.simple}</Text>
              </Enter>
            )}
            <View style={{ flex: 1 }} />
            <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>Concept from your field: {fieldName}</Text>
          </Animated.View>

          {/* the usual way */}
          <Animated.View style={[face, { position: 'absolute', inset: 0, backgroundColor: '#EEEDEA', borderColor: '#B9B4AC', gap: 12 }, back]}>
            <Text style={{ fontFamily: F.bold, fontSize: 22, lineHeight: 27, color: '#6B6760' }}>{concept.name}, the usual way</Text>
            <Text style={{ fontFamily: F.medium, fontSize: 16, lineHeight: 24, color: '#6B6760' }}>{concept.usual}</Text>
          </Animated.View>
        </View>

        <Pressable onPress={turn} disabled={analogy === undefined} style={{ alignSelf: 'center', padding: 6 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.teal, textDecorationLine: 'underline' }}>{usual ? 'Back to my way' : 'See it the usual way'}</Text>
        </Pressable>

        {/* the one number, with its source (it's about personalised lessons as a whole, not analogies alone) */}
        <Text style={{ fontFamily: F.medium, fontSize: 12, lineHeight: 17, color: C.muted, textAlign: 'center' }}>
          In a Google study, students learning with lessons personalized to them, including examples from their interests, scored 78% vs 67% on a test 3–5 days later.{' '}
          <Text onPress={() => WebBrowser.openBrowserAsync(LEARN_YOUR_WAY)} style={{ color: C.teal, textDecorationLine: 'underline' }}>
            Source
          </Text>
        </Text>
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Btn title="Teach me like this" mono sfx="select" disabled={analogy === undefined} onPress={() => router.push('/onboarding/plant')} />
      </View>
    </SafeAreaView>
  );
}
