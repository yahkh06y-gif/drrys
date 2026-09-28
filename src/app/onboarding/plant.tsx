// "Great. Now let's plant our first subject" — Coco with the shovel catches the seed (video).
import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Motion } from '@/components/Motion';
import { Btn, Enter, Progress, T } from '@/components/ui';
import { C } from '@/theme';

export default function Plant() {
  return (
    <View style={{ flex: 1 }}>
      <Motion video="plant" style={{ position: 'absolute', inset: 0 }} />
      <SafeAreaView style={{ flex: 1, padding: 20 }}>
        <View style={{ paddingHorizontal: 10, marginBottom: 20 }}>
          <Progress value={1} />
        </View>
        <Enter>
          <T v="h1" style={{ color: C.tealSoft, fontSize: 34 }}>
            Great. Now let’s plant our first subject
          </T>
        </Enter>
        <View style={{ flex: 1 }} />
        <View style={{ gap: 10 }}>
          <Btn title="Plant Now" kind="leaf" mono sfx="grow" onPress={() => router.push('/onboarding/seed')} />
          <Btn title="Not now" kind="green" height={46} mono onPress={() => router.push('/onboarding/signin')} />
        </View>
      </SafeAreaView>
    </View>
  );
}
