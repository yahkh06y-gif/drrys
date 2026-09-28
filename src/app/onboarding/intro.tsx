// Three intro slides. Each slide is a looping Blender video (the illustration sits in the top half),
// with copy + buttons layered on the plain lower half. A short zoom-in video plays once on entry.
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { VideoKey } from '@/art-videos';
import { Motion } from '@/components/Motion';
import { Btn } from '@/components/ui';
import { play } from '@/lib/feedback';
import { useApp } from '@/store';
import { C, F } from '@/theme';

const SLIDES: { video: VideoKey; fg: string; title: string; body: string; btn: 'light' | 'teal' | 'leaf' }[] = [
  {
    video: 'intro1',
    fg: '#0E6E6A',
    title: 'Grow Your Knowledge, One Day at a Time.',
    body: 'We turn complex study goals into small daily sessions, so you always know what to focus on next.',
    btn: 'light',
  },
  {
    video: 'intro2',
    fg: C.white,
    title: 'Coco is your personal learning companion',
    body: 'Drrys personalizes your learning; Coco understands your style and explains tough concepts using things you love.',
    btn: 'teal',
  },
  {
    video: 'intro3',
    fg: C.white,
    title: 'Learn Smarter, Not Harder.',
    body: 'Drrys uses proven learning methods to help you understand, remember, and apply what you learn.',
    btn: 'leaf',
  },
];

export default function Intro() {
  const { width, height } = useWindowDimensions();
  const ref = useRef<ScrollView>(null);
  const [i, setI] = useState(0);
  const [entering, setEntering] = useState(true);
  const setProfile = useApp((s) => s.setProfile);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const n = Math.round(e.nativeEvent.contentOffset.x / width);
    if (n !== i) {
      setI(n);
      play('flip');
    }
  };

  const next = () => {
    if (i < SLIDES.length - 1) ref.current?.scrollTo({ x: (i + 1) * width, animated: true });
    else router.push('/onboarding/hello');
  };

  const s = SLIDES[i];
  return (
    <View style={{ flex: 1, backgroundColor: '#BCE1F0' }}>
      <ScrollView ref={ref} horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
        {SLIDES.map((sl, k) => (
          <View key={k} style={{ width, height }}>
            <Motion video={sl.video} playing={Math.abs(k - i) <= 1} style={{ position: 'absolute', inset: 0 }} />
            <SafeAreaView edges={['top']} style={{ flex: 1, paddingHorizontal: 28 }}>
              <View style={{ height: height * 0.5 }} />
              <Text style={{ fontFamily: F.bold, fontSize: 32, lineHeight: 38, color: sl.fg }}>{sl.title}</Text>
              <Text style={{ fontFamily: F.medium, fontSize: 15, lineHeight: 22, color: sl.fg, opacity: 0.9, marginTop: 12 }}>{sl.body}</Text>
            </SafeAreaView>
          </View>
        ))}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 40, paddingBottom: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
          {SLIDES.map((_, k) => (
            <View key={k} style={{ height: 8, width: k === i ? 28 : 12, borderRadius: 4, backgroundColor: k === i ? C.white : 'rgba(0,0,0,0.18)' }} />
          ))}
        </View>
        <Btn title={i === 2 ? 'Get started' : 'continue'} kind={s.btn} onPress={next} mono={i < 2} />
        {i === 2 && (
          <Btn
            title="I already have an account"
            kind="green"
            height={46}
            onPress={() => {
              setProfile({ signedIn: true });
              router.push('/onboarding/signin');
            }}
          />
        )}
      </SafeAreaView>

      {entering && (
        <Animated.View exiting={FadeOut.duration(250)} style={{ position: 'absolute', inset: 0 }}>
          <Motion video="introEnter" loop={false} onEnd={() => setEntering(false)} style={{ flex: 1 }} />
        </Animated.View>
      )}
    </View>
  );
}
