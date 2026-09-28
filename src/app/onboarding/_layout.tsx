import { Stack } from 'expo-router';

import { C } from '@/theme';

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.cream }, animation: 'slide_from_right' }} />;
}
