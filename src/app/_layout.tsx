import { IosevkaCharon_400Regular, IosevkaCharon_700Bold } from '@expo-google-fonts/iosevka-charon';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Launch } from '@/components/Launch';
import { initCloud } from '@/lib/cloud';
import { initAudio } from '@/lib/feedback';
import { startReminderSync } from '@/lib/notify';
import { refreshTogether } from '@/lib/together';
import { initPurchases } from '@/lib/purchases';
import { useApp } from '@/store';
import { C } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fonts] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    IosevkaCharon_400Regular,
    IosevkaCharon_700Bold,
  });
  const hydrated = useApp((s) => s.hydrated);

  useEffect(() => {
    initAudio();
    initPurchases();
  }, []);
  // once the saved state is loaded: resume the account's cloud backup (if signed in)
  useEffect(() => {
    if (!hydrated) return;
    initCloud();
    startReminderSync();
    refreshTogether();
  }, [hydrated]);

  // The splash picture shows only while the app is loading (fonts + saved forest), then the app takes over.
  // Once the picture is on screen it replaces the small native splash (Android can't show a full-screen one).
  const onboarded = useApp((s) => s.onboarded);
  useEffect(() => {
    if (!fonts || !hydrated) return;
    SplashScreen.hideAsync().catch(() => {}); // loaded quickly, before the picture even appeared
  }, [fonts, hydrated]);

  if (!fonts || !hydrated) return <Launch />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.cream }, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        {/* once onboarded, the whole onboarding flow drops out of the history, so Back never returns to it */}
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" options={{ animation: 'none', contentStyle: { backgroundColor: '#2F8476' } }} />
        </Stack.Protected>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade', contentStyle: { backgroundColor: '#8FC9EC' } }} />
        <Stack.Screen name="session" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="grow" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
