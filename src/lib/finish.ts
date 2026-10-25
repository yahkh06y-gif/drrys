// The end of onboarding: onto the tree. If a subject was planted, Coco waters the new sapling, then the one
// guided step (add a lecture).
import { router } from 'expo-router';

import { play } from '@/lib/feedback';
import { useApp } from '@/store';

export function finishOnboarding() {
  const st = useApp.getState();
  const tree = st.subjects.at(-1);
  st.set({ onboarded: true, justWatered: tree?.id, guide: tree ? 'files' : undefined, coachSeen: !!tree || st.coachSeen });
  play('celebrate');
  router.replace('/(tabs)/tree');
}
