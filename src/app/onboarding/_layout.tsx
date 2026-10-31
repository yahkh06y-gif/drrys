import { Stack } from 'expo-router';

import { color, palette } from '@/design/tokens';
import { C } from '@/theme';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.cream }, animation: 'slide_from_right' }}>
      {/* the video screens cut or fade into each other — never slide */}
      <Stack.Screen name="index" options={{ animation: 'none', contentStyle: { backgroundColor: color.bg.onboarding } }} />
      <Stack.Screen name="intro" options={{ animation: 'fade', contentStyle: { backgroundColor: palette.sky200 } }} />
      <Stack.Screen name="hello" options={{ animation: 'fade' }} />
      <Stack.Screen name="plant" options={{ animation: 'fade' }} />
    </Stack>
  );
}
