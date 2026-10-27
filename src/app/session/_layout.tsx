import { router, Stack, type ErrorBoundaryProps } from 'expo-router';
import { Text, View } from 'react-native';

import { Btn } from '@/components/ui';
import { C, F } from '@/theme';

export default function SessionLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.paper }, animation: 'slide_from_right', gestureEnabled: false }} />;
}

// If anything in a session breaks, show a way out instead of closing the app. The session draft is
// kept, so the answers and cards made so far aren't lost.
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }}>
      <Text style={{ fontFamily: F.semi, fontSize: 22, lineHeight: 28, color: C.ink, textAlign: 'center' }}>Coco tripped over a root</Text>
      <Text style={{ fontFamily: F.regular, fontSize: 15, lineHeight: 22, color: C.body, textAlign: 'center' }}>Something went wrong in this step. Your progress is saved.</Text>
      <Btn title="Try again" kind="green" onPress={retry} style={{ alignSelf: 'stretch' }} />
      <Btn
        title="Back to my forest"
        kind="light"
        height={46}
        onPress={() => router.dismissTo('/(tabs)/tree')}
        style={{ alignSelf: 'stretch' }}
      />
    </View>
  );
}
