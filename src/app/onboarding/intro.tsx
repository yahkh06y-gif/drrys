// Three intro slides. Each slide is a looping Blender video (the illustration sits in the top of the frame)
// on a background of the video's own colour, with copy + buttons below.
//
// Android note: views that contain video must never be faded with opacity (the video surface can flash
// black). So all three slides stay mounted and playing, the active one is simply stacked on top, and the
// change is covered by a quick wash of the next slide's colour (a plain View, safe to fade).
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VIDEO_BG, type VideoKey } from '@/art-videos';
import { Motion } from '@/components/Motion';
import { Btn } from '@/components/ui';
import { play } from '@/lib/feedback';
import { color } from '@/design/tokens';
import { C, F } from '@/theme';

const SLIDES: { video: VideoKey; startAt?: number; fg: string; title: string; body: string; btn: 'light' | 'teal' | 'leaf' }[] = [
  {
    video: 'intro1',
    startAt: 6, // the clip opens on its zoom-in; skip straight to the settled tree
    fg: color.text.brand,
    title: 'Grow your knowledge, one day at a time.',
    body: 'Every subject is a tree. Your mission: water it daily.',
    btn: 'light',
  },
  {
    video: 'intro2',
    fg: C.white,
    title: 'Coco learns your world.',
    body: 'Tell him what you love. He explains every hard idea through it.',
    btn: 'teal',
  },
  {
    video: 'intro3',
    fg: C.white,
    title: 'Study the way science says works.',
    body: 'No highlighting. No re-reading. Just methods that stick.',
    btn: 'leaf',
  },
];

const WASH_IN = 170;
const WASH_OUT = 260;

export default function Intro() {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [i, setI] = useState(0);
  const [wash, setWash] = useState(VIDEO_BG.intro1);
  const busy = useRef(false);
  const washO = useSharedValue(0);

  const go = (n: number) => {
    if (busy.current || n < 0 || n >= SLIDES.length || n === i) return;
    busy.current = true;
    play('flip');
    setWash(VIDEO_BG[SLIDES[n].video]);
    washO.value = withSequence(
      withTiming(1, { duration: WASH_IN }, (ok) => {
        if (ok) runOnJS(setI)(n); // swap slides while fully covered
      }),
      withTiming(0, { duration: WASH_OUT }),
    );
    setTimeout(() => (busy.current = false), WASH_IN + WASH_OUT);
  };
  const next = () => (i < SLIDES.length - 1 ? go(i + 1) : router.push('/onboarding/hello'));

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .onEnd((e) => {
      if (e.translationX < -50) go(i + 1);
      else if (e.translationX > 50) go(i - 1);
    });

  const washA = useAnimatedStyle(() => ({ opacity: washO.value }));

  const s = SLIDES[i];
  return (
    <GestureDetector gesture={swipe}>
      <View
        style={{ flex: 1, backgroundColor: VIDEO_BG[s.video] }}
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {size && SLIDES.map((sl, k) => <Slide key={k} slide={sl} active={k === i} w={size.w} h={size.h} />)}

        {/* colour wash that covers the swap */}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', inset: 0, zIndex: 5, backgroundColor: wash }, washA]} />

        <SafeAreaView edges={['bottom']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 6, paddingHorizontal: 40, paddingBottom: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
            {SLIDES.map((_, k) => (
              <View key={k} style={{ height: 8, width: k === i ? 28 : 12, borderRadius: 4, backgroundColor: k === i ? C.white : color.overlay.shade }} />
            ))}
          </View>
          <Btn title={i === 2 ? 'Get started' : 'Continue'} kind={s.btn} onPress={next} mono={i < 2} />
          {i === 2 && (
            <Btn
              title="I already have an account"
              kind="light"
              height={46}
              onPress={() => router.push({ pathname: '/onboarding/signin', params: { mode: 'signin' } })}
            />
          )}
        </SafeAreaView>

      </View>
    </GestureDetector>
  );
}

function Slide({ slide, active, w, h }: { slide: (typeof SLIDES)[number]; active: boolean; w: number; h: number }) {
  const bg = VIDEO_BG[slide.video];
  // The video keeps its true 9:16 shape at full width; the rest of the screen is the video's own colour.
  const vh = Math.min(w * (16 / 9), h);
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, backgroundColor: bg, zIndex: active ? 2 : 1, elevation: active ? 2 : 1 }}>
      <Motion video={slide.video} startAt={slide.startAt} style={{ position: 'absolute', left: 0, top: 0, width: w, height: vh }} />
      <LinearGradient colors={['transparent', bg]} style={{ position: 'absolute', left: 0, right: 0, top: vh - 60, height: 60 }} />
      <SafeAreaView edges={['top']} style={{ flex: 1, paddingHorizontal: 28 }}>
        <View style={{ height: Math.min(vh * 0.5, h * 0.5) }} />
        <Text accessibilityRole="header" style={{ fontFamily: F.semi, fontSize: 32, lineHeight: 38, letterSpacing: -0.6, color: slide.fg }}>{slide.title}</Text>
        <Text style={{ fontFamily: F.regular, fontSize: 16, lineHeight: 24, color: slide.fg, opacity: 0.92, marginTop: 12 }}>{slide.body}</Text>
      </SafeAreaView>
    </View>
  );
}
