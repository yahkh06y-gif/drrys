// "Hi, I am Coco" → "What should I call you?" → "Nice to meet you, <name>! Let's build your world…" (Coco waving video).
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VIDEO_BG } from '@/art-videos';
import { Motion } from '@/components/Motion';
import { Btn, Bubble, Enter, IconBtn } from '@/components/ui';
import { useBack } from '@/lib/back';
import { play } from '@/lib/feedback';
import { useApp } from '@/store';
import { C, F } from '@/theme';

export default function Hello() {
  const { width, height } = useWindowDimensions();
  // Coco is shown smaller than full-screen so the render stays crisp; the page takes the video's own
  // background colour so the edges of the smaller video disappear.
  const vw = width * 0.7;
  const vh = (vw * 16) / 9;
  const setProfile = useApp((s) => s.setProfile);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(useApp.getState().profile.name);
  const first = name.trim().split(' ')[0];
  const lines = ['Hi, I am Coco! 👋', 'What should I call you?', `Nice to meet you, ${first}! Let’s build your world. It takes one minute. 🌍`];
  const next = () => {
    if (step === 1) {
      if (!name.trim()) return;
      setProfile({ name: name.trim() });
    }
    if (step < 2) {
      setStep(step + 1);
      play('select');
    } else router.push('/onboarding/study');
  };
  const back = useCallback(() => {
    if (step > 0) return setStep(step - 1), true;
    return false; // first line: back to the intro slides
  }, [step]);
  useBack(back);

  return (
    <View style={{ flex: 1, backgroundColor: VIDEO_BG.hello }}>
      <View pointerEvents="none" style={{ position: 'absolute', width: vw, height: vh, left: (width - vw) / 2, top: height * 0.53 - vh / 2 }}>
        <Motion video="hello" fit="contain" style={{ flex: 1 }} />
        {/* feather the video's edges into the page, in case the phone renders its colour a shade off */}
        {(['top', 'bottom', 'left', 'right'] as const).map((side) => {
          const vertical = side === 'top' || side === 'bottom';
          const toEdge = side === 'top' || side === 'left';
          return (
            <LinearGradient
              key={side}
              colors={toEdge ? [VIDEO_BG.hello, `${VIDEO_BG.hello}00`] : [`${VIDEO_BG.hello}00`, VIDEO_BG.hello]}
              start={vertical ? { x: 0, y: 0 } : { x: 0, y: 0 }}
              end={vertical ? { x: 0, y: 1 } : { x: 1, y: 0 }}
              style={{ position: 'absolute', [side]: 0, ...(vertical ? { left: 0, right: 0, height: 40 } : { top: 0, bottom: 0, width: 40 }) }}
            />
          );
        })}
      </View>
      <SafeAreaView style={{ flex: 1, padding: 20 }}>
        <IconBtn name="arrow-back" size={36} onPress={() => back() || (router.canGoBack() && router.back())} />
        <View style={{ height: height * 0.2 - 36 }} />
        <Enter key={step}>
          <Bubble text={lines[step]} />
        </Enter>
        {step === 1 && (
          <Enter delay={150} style={{ marginTop: 14, alignItems: 'center' }}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={C.mutedLight}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={next}
              style={{ width: 240, textAlign: 'center', fontFamily: F.medium, fontSize: 18, color: C.ink, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.teal, borderRadius: 16, paddingVertical: 12 }}
            />
          </Enter>
        )}
        <View style={{ flex: 1 }} />
        <Btn title="Continue" mono disabled={step === 1 && !name.trim()} onPress={next} />
      </SafeAreaView>
    </View>
  );
}
