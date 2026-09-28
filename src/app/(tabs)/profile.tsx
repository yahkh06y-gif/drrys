// Account & settings.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn, Progress, T } from '@/components/ui';
import { aiEnabled } from '@/lib/ai';
import { play, tap } from '@/lib/feedback';
import { disableReminders, enableReminders } from '@/lib/notify';
import { LIMITS, restore } from '@/lib/purchases';
import { useApp } from '@/store';
import { C, F } from '@/theme';

export default function Profile() {
  const profile = useApp((s) => s.profile);
  const isPro = useApp((s) => s.isPro);
  const subjects = useApp((s) => s.subjects);
  const sound = useApp((s) => s.sound);
  const coco = useApp((s) => s.coco);
  const set = useApp((s) => s.set);
  const setProfile = useApp((s) => s.setProfile);
  const reset = useApp((s) => s.reset);
  const limit = isPro ? LIMITS.proTrees : LIMITS.freeTrees;
  const initials = (profile.name || 'S').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ alignItems: 'center', paddingVertical: 10 }}>
        <T v="h3" style={{ color: C.teal }}>
          Account & settings
        </T>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <Box>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: F.bold, fontSize: 18, color: C.teal }}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.ink }}>{profile.name || 'Student'}</Text>
              <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>{profile.email || 'Not signed in'}</Text>
            </View>
            <Pressable onPress={() => (tap(), router.push('/onboarding/signin'))} style={{ borderWidth: 1.5, borderColor: C.bark, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.bark }}>Edit profile</Text>
            </Pressable>
          </View>
        </Box>

        <Box>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.muted, letterSpacing: 0.5 }}>YOUR PLAN</Text>
              <Text style={{ fontFamily: F.bold, fontSize: 20, color: C.leaf }}>{isPro ? 'Drrys Pro 🌳' : 'Free'}</Text>
            </View>
            {!isPro && (
              <Pressable onPress={() => (tap(), router.push('/paywall'))} style={{ backgroundColor: C.teal, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.white }}>View plans</Text>
              </Pressable>
            )}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 6 }}>
            <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.body }}>
              {subjects.length} of {limit} subject trees used
            </Text>
            <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.teal }}>{Math.round((subjects.length / limit) * 100)}%</Text>
          </View>
          <Progress value={subjects.length / limit} height={8} track={C.track} fill={C.teal} />
          {!isPro && <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted, marginTop: 6 }}>Upgrade for more subjects and unlimited uploads.</Text>}
        </Box>

        <Section title="PREFERENCES">
          <Row icon="notifications-outline" label="Daily reminder">
            <Switch
              value={profile.reminders}
              onValueChange={async (v) => {
                tap();
                if (v) setProfile({ reminders: await enableReminders() });
                else {
                  await disableReminders();
                  setProfile({ reminders: false });
                }
              }}
              trackColor={{ true: C.leaf }}
            />
          </Row>
          <Row icon="volume-high-outline" label="Sounds & haptics">
            <Switch value={sound} onValueChange={(v) => {
                set({ sound: v });
                if (v) play('select');
              }} trackColor={{ true: C.leaf }} />
          </Row>
          <Row icon="language-outline" label="Language" value="English" last />
        </Section>

        <Section title="PERSONALIZATION & AI">
          <Row icon="happy-outline" label="Coco customization" value={coco.style} onPress={() => router.push('/customize')} />
          <Row icon="football-outline" label="Interests" value={profile.interests.slice(0, 2).join(' • ')} onPress={() => router.push('/customize')} />
          <Row icon="sparkles-outline" label="Coco’s brain" value={aiEnabled ? 'Claude AI · live' : 'Demo mode'} last />
        </Section>

        <Section title="PRIVACY & SUPPORT">
          <Row
            icon="refresh-outline"
            label="Restore purchases"
            onPress={async () => {
              const ok = await restore();
              Alert.alert(ok ? 'Welcome back to Pro 🌳' : 'No active subscription found');
            }}
          />
          <Row icon="shield-outline" label="Data & privacy" value="On-device" />
          <Row icon="information-circle-outline" label="About Drrys" value="v1.0.0" last />
        </Section>

        <Btn
          title="Reset app"
          kind="white"
          height={46}
          onPress={() =>
            Alert.alert('Reset Drrys?', 'This deletes your forest, cards and progress on this device.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reset', style: 'destructive', onPress: () => (reset(), router.replace('/onboarding')) },
            ])
          }
        />
        <Text style={{ fontFamily: F.medium, fontSize: 10, color: C.muted, textAlign: 'center' }}>Drrys v1.0.0 · made with 🌱 for Shipaton 2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: C.white, borderRadius: 18, borderWidth: 2, borderColor: C.bark, borderBottomWidth: 5, padding: 14 }}>{children}</View>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.muted, letterSpacing: 0.5 }}>{title}</Text>
      <View style={{ backgroundColor: C.white, borderRadius: 18, borderWidth: 2, borderColor: C.bark, borderBottomWidth: 5, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

function Row({ icon, label, value, onPress, children, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string; onPress?: () => void; children?: React.ReactNode; last?: boolean }) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => (tap(), onPress?.())}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderColor: C.line }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.sand, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={15} color={C.teal} />
      </View>
      <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 13, color: C.ink }}>{label}</Text>
      {children ?? (
        <>
          {value ? <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted, textTransform: 'capitalize' }}>{value}</Text> : null}
          {onPress && <Ionicons name="chevron-forward" size={14} color={C.muted} />}
        </>
      )}
    </Pressable>
  );
}
