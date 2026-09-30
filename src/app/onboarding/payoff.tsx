// After the questions: Coco tells the student he'll explain tricky ideas through what they're into.
import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { Btn, Bubble, Coco, Enter, OnbBar } from '@/components/ui';
import { DEFAULT_EXAMPLE, INTEREST_EXAMPLES, progressOf } from '@/lib/onboarding';
import { useApp } from '@/store';
import { C } from '@/theme';

export default function Payoff() {
  const profile = useApp((s) => s.profile);
  const name = profile.name.trim().split(' ')[0];
  // everything they picked or typed; the worked example comes from the first one we have an analogy for
  const likes = profile.interests ?? [];
  const first = likes[0];
  const known = likes.find((i) => INTEREST_EXAMPLES[i]);
  const ex = known ? INTEREST_EXAMPLES[known] : DEFAULT_EXAMPLE; // only its emoji is used now
  const topic = first ? (likes.length > 1 ? `${likes.slice(0, -1).join(', ')} and ${likes[likes.length - 1]}` : first) : '';
  const hello = first
    ? `${topic} fan${name ? `, ${name}` : ''}? Then I’ll explain tricky ideas with ${likes.length > 1 ? 'them' : first} ${ex.emoji}`
    : `I’ll explain tricky ideas with things you already know${name ? `, ${name}` : ''} ${ex.emoji}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream, padding: 20 }}>
      <OnbBar value={progressOf('payoff')} style={{ marginBottom: 18 }} />
      <Enter>
        <Bubble text={hello} style={{ marginTop: 6 }} />
      </Enter>
      <View style={{ flex: 1 }} />
      <Coco src={COCO.reading} size={230} />
      <View style={{ flex: 1 }} />
      <Btn title="Love it, let’s plant" mono sfx="select" onPress={() => router.push('/onboarding/plant')} />
    </SafeAreaView>
  );
}
