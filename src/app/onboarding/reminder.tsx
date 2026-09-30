// "Get a daily reminder" — Coco rings the bell.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { COCO } from '@/art';
import { Btn, Bubble, Coco, Enter, OnbBar, Screen, T } from '@/components/ui';
import { play } from '@/lib/feedback';
import { enableReminders } from '@/lib/notify';
import { progressOf } from '@/lib/onboarding';
import { useApp } from '@/store';
import { C, F } from '@/theme';

export default function Reminder() {
  const set = useApp((s) => s.set);
  const setProfile = useApp((s) => s.setProfile);
  const [busy, setBusy] = useState(false);

  const finish = () => {
    set({ onboarded: true });
    play('celebrate');
    router.replace('/(tabs)/tree');
  };

  return (
    <Screen
      footer={
        <View style={{ gap: 10 }}>
          <Btn
            title="Enable Notifications"
            iconLeft="notifications"
            kind="teal"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              const ok = await enableReminders();
              setProfile({ reminders: ok });
              setBusy(false);
              finish();
            }}
          />
          <Pressable onPress={finish} style={{ alignSelf: 'center', padding: 6 }}>
            <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted, textAlign: 'center' }}>
              Maybe later — you can fine-tune this in your profile settings.
            </Text>
          </Pressable>
        </View>
      }>
      <OnbBar value={progressOf('reminder')} style={{ marginBottom: 28 }} />
      <Enter>
        <T v="h1" style={{ fontSize: 38 }}>
          Get daily reminder
        </T>
      </Enter>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Bubble text="Just in case you forget 🔔" />
        <Coco src={COCO.bell} size={230} />
      </View>
    </Screen>
  );
}
