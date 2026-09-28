// "Hi, I am Coco" → "Just 6 questions before we start planting" (Coco waving video).
import { router } from 'expo-router';
import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Motion } from '@/components/Motion';
import { Btn, Bubble, Enter } from '@/components/ui';
import { play } from '@/lib/feedback';

export default function Hello() {
  const { height } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const lines = ['Hi, I am Coco! 👋', 'Just 6 questions before we start planting 🌱'];
  return (
    <View style={{ flex: 1 }}>
      <Motion video="hello" style={{ position: 'absolute', inset: 0 }} />
      <SafeAreaView style={{ flex: 1, padding: 20 }}>
        <View style={{ height: height * 0.2 }} />
        <Enter key={step}>
          <Bubble text={lines[step]} />
        </Enter>
        <View style={{ flex: 1 }} />
        <Btn
          title="continue"
          mono
          onPress={() => {
            if (step === 0) {
              setStep(1);
              play('select');
            } else router.push('/onboarding/q/0');
          }}
        />
      </SafeAreaView>
    </View>
  );
}
