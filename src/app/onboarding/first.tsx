// "Let me show you how we'll study" — the peak of onboarding: a famously hard idea from the student's own
// field, explained through something from their world (themes from Qloo, analogy by the AI).
// The explanation was started in the background when the student finished "Show Coco your world" (lib/first),
// so it's usually ready on arrival. "Usual way" flips the card to the dry textbook version, so the difference is felt.
// One thing to read at a time: Coco's line on top, one switch, the card, one button.
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, type DimensionValue } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, shadow } from '@/design/tokens';
import { COCO } from '@/art';
import { SafePicture } from '@/components/SafePicture';
import { Btn, Enter, OnbBar } from '@/components/ui';
import { tap } from '@/lib/feedback';
import { bestPick, prepareFirst } from '@/lib/first';
import { conceptFor, progressOf, subfieldName } from '@/lib/onboarding';
import { TYPE_EMOJI, TYPE_ICON } from '@/lib/qloo';
import { useApp } from '@/store';
import { C, F } from '@/theme';

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
    // already started on "Show Coco your world"; this only waits for it (or starts it, if the app was reopened here)
    prepareFirst().then((a) => live && setAnalogy(a));
    return () => {
      live = false;
    };
  }, []);

  const ready = analogy !== undefined;
  const personal = !!analogy && !!pick;
  const title = personal ? `${concept.name}, the ${pick!.name} way` : `${concept.name}, made simple`;

  const show = (u: boolean) => {
    if (u === usual || !ready) return;
    tap('flip');
    setUsual(u);
    flip.value = withTiming(u ? 1 : 0, { duration: 450 });
  };
  const front = useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }] }));
  const back = useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }] }));

  const face = { backfaceVisibility: 'hidden' as const, borderRadius: 24, padding: 20, borderWidth: 2, borderBottomWidth: 6, minHeight: 300, gap: 12 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        <OnbBar value={progressOf('first')} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
        {/* Coco speaks first: the line is the page's title */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <Image source={COCO.classic} style={{ width: 72, height: 90 }} contentFit="contain" />
          <Enter key={usual ? 'u' : 'w'} style={{ flex: 1, marginBottom: 18 }}>
            <View style={{ backgroundColor: C.white, borderRadius: 18, borderBottomLeftRadius: 4, borderWidth: 1.5, borderColor: C.lineStrong, paddingHorizontal: 14, paddingVertical: 12 }}>
              <Text style={{ fontFamily: F.medium, fontSize: 18, lineHeight: 25, color: C.teal }}>{usual ? 'See the difference? 😏' : 'Let me show you how we’ll study.'}</Text>
            </View>
          </Enter>
        </View>

        {/* my way / the usual way */}
        <View style={{ flexDirection: 'row', backgroundColor: C.sand, borderRadius: radius.lg, padding: 4 }}>
          {[
            { u: false, label: 'My way' },
            { u: true, label: 'Usual way' },
          ].map((o) => {
            const on = usual === o.u;
            return (
              <Pressable key={o.label} onPress={() => show(o.u)} disabled={!ready} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', ...(on ? shadow.lift : null), backgroundColor: on ? C.white : 'transparent' }}>
                <Text style={{ fontFamily: F.medium, fontSize: 14, color: on ? C.ink : C.muted }}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View>
          {/* my way */}
          <Animated.View style={[face, { backgroundColor: C.white, borderColor: C.bark }, front]}>
            <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.muted }}>{fieldName}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {pick && personal && <SafePicture uri={pick.image} emoji={TYPE_EMOJI[pick.type]} icon={TYPE_ICON[pick.type]} style={{ width: 46, height: 69, borderRadius: 8 }} />}
              <Text style={{ flex: 1, fontFamily: F.semi, fontSize: 22, lineHeight: 28, letterSpacing: -0.3, color: C.ink }}>{ready ? title : concept.name}</Text>
            </View>
            {ready ? (
              <Enter>
                <Text style={{ fontFamily: F.regular, fontSize: 17, lineHeight: 27, color: C.ink }}>{analogy ?? concept.simple}</Text>
              </Enter>
            ) : (
              <View style={{ gap: 10, paddingTop: 4 }}>
                {(['100%', '94%', '97%', '60%'] as const).map((w, i) => (
                  <Line key={i} width={w} />
                ))}
              </View>
            )}
          </Animated.View>

          {/* the usual way */}
          <Animated.View style={[face, { position: 'absolute', inset: 0, backgroundColor: palette.neutral100, borderColor: palette.neutral300 }, back]}>
            <Text style={{ fontFamily: F.medium, fontSize: 13, color: palette.neutral500 }}>{fieldName}</Text>
            <Text style={{ fontFamily: F.semi, fontSize: 22, lineHeight: 28, letterSpacing: -0.3, color: palette.neutral600 }}>{concept.name}</Text>
            <Text style={{ fontFamily: F.regular, fontSize: 17, lineHeight: 27, color: palette.neutral600 }}>{concept.usual}</Text>
          </Animated.View>
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Btn title="Teach me like this" mono sfx="select" disabled={!ready} onPress={() => router.push('/onboarding/plant')} />
      </View>
    </SafeAreaView>
  );
}

/** A line of text still being written: it breathes while Coco thinks. */
function Line({ width }: { width: DimensionValue }) {
  const o = useSharedValue(0.45);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.9, { duration: 700 }), -1, true);
  }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height: 14, borderRadius: 7, backgroundColor: C.track, width }, a]} />;
}
