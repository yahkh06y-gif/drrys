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

import { initAudio } from '@/lib/feedback';
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

  useEffect(() => {
    if (fonts && hydrated) SplashScreen.hideAsync();
  }, [fonts, hydrated]);

  if (!fonts || !hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.cream }, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="session" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="grow" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="paywall"options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
