// Account & settings.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn, Progress, T } from '@/components/ui';
import { aiLabel } from '@/lib/ai';
import { play, tap } from '@/lib/feedback';
import { DEFAULT_HOUR, disableReminders, enableReminders, hourLabel, REMINDER_HOURS, remindersSupported } from '@/lib/notify';
import { LIMITS, linkPurchases, restore } from '@/lib/purchases';
import { friendBranches, SQUAD_OFF, SQUAD_SIZE } from '@/lib/together';
import { forgetLogin } from '@/lib/cloud';
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
  const together = useApp((s) => s.together);
  const resting = Math.max(0, subjects.length - limit); // kept from Pro days (see isResting)
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
              <Text style={{ fontFamily: F.medium, fontSize: 12, color: profile.uid ? C.muted : C.orange }}>{profile.uid ? `☁︎ ${profile.email}` : 'Not backed up — sign in'}</Text>
            </View>
            <Pressable onPress={() => (tap(), router.push('/account'))} style={{ borderWidth: 1.5, borderColor: C.bark, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.bark }}>{profile.uid ? 'Account' : 'Sign in'}</Text>
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
              {Math.min(subjects.length, limit)} of {limit} subject {limit === 1 ? 'tree' : 'trees'} used
            </Text>
            <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.teal }}>{Math.min(100, Math.round((subjects.length / limit) * 100))}%</Text>
          </View>
          <Progress value={Math.min(1, subjects.length / limit)} height={8} track={C.track} fill={C.teal} />
          {resting > 0 ? (
            <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.orange, marginTop: 6 }}>
              {resting} {resting === 1 ? 'tree is' : 'trees are'} resting from your Pro days. They’re safe and their flashcards still come back; renew Pro to study them again.
            </Text>
          ) : (
            !isPro && <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted, marginTop: 6 }}>Upgrade for up to 5 subjects and 5 chapters each.</Text>
          )}
        </Box>

        {/* studying together: squad discount + free branch for inviting (tells students these offers exist) */}
        <Pressable accessibilityRole="button" onPress={() => (tap(), router.push('/together'))}>
          <Box>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 26 }}>👥</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink }}>Study together</Text>
                <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.body }}>
                  {together?.squad
                    ? `Your squad: ${together.squad.members.length}/${SQUAD_SIZE}${together.squad.members.length >= SQUAD_SIZE ? (isPro ? ` · your friends get ${SQUAD_OFF}% off` : ` · ${SQUAD_OFF}% off unlocked`) : ''}`
                    : isPro
                      ? `Start a squad: your friends get ${SQUAD_OFF}% off Pro`
                      : `Squad of ${SQUAD_SIZE} → ${SQUAD_OFF}% off Pro each`}
                  {!isPro && friendBranches(together) < 1 ? ' · Invite 1 friend → a free 2nd branch' : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.muted} />
            </View>
          </Box>
        </Pressable>

        <Section title="PREFERENCES">
          <Row icon="notifications-outline" label="Daily reminder">
            <Switch
              value={profile.reminders}
              onValueChange={async (v) => {
                tap();
                if (v) {
                  const ok = await enableReminders();
                  setProfile({ reminders: ok });
                  if (!ok)
                    Alert.alert(
                      remindersSupported ? 'Notifications are off' : 'Not in Expo Go',
                      remindersSupported ? 'Allow notifications for Drrys in your phone settings, then try again.' : 'Reminders work in the installed app (APK), not in Expo Go.',
                    );
                } else {
                  await disableReminders();
                  setProfile({ reminders: false });
                }
              }}
              trackColor={{ true: C.leaf }}
            />
          </Row>
          {profile.reminders && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingBottom: 12 }}>
              {REMINDER_HOURS.map((h) => {
                const on = (profile.reminderHour ?? DEFAULT_HOUR) === h;
                return (
                  <Pressable
                    key={h}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => (tap(), setProfile({ reminderHour: h }))}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5, borderColor: on ? C.teal : C.line, backgroundColor: on ? C.teal : C.white }}>
                    <Text style={{ fontFamily: F.bold, fontSize: 12, color: on ? C.white : C.body }}>{hourLabel(h)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          <Row icon="volume-high-outline" label="Sounds & haptics">
            <Switch value={sound} onValueChange={(v) => {
                set({ sound: v });
                if (v) play('select');
              }} trackColor={{ true: C.leaf }} />
          </Row>
          <Row icon="language-outline" label="Language" value="English" last />
        </Section>

        <Section title="ABOUT YOU">
          <Row
            icon="school-outline"
            label="Studying"
            value={[profile.field, profile.subfield].filter(Boolean).join(' • ') || 'Add'}
            onPress={() => router.push({ pathname: '/about/[step]', params: { step: 'study' } })}
          />
          <Row icon="football-outline" label="Interests" value={short(profile.interests)} onPress={() => router.push({ pathname: '/about/[step]', params: { step: 'world' } })} last />
        </Section>

        <Section title="COCO">
          <Row icon="happy-outline" label="Coco’s look & style" value={coco.style[0].toUpperCase() + coco.style.slice(1)} onPress={() => router.push('/customize')} />
          <Row icon="sparkles-outline" label="Coco’s brain" value={aiLabel} last />
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
          <Row icon="shield-outline" label="Data & privacy" value={profile.uid ? 'Backed up to your account' : 'On this phone only'} />
          <Row icon="information-circle-outline" label="About Drrys" value="v1.0.0" last />
        </Section>

        <Btn
          title="Reset app"
          kind="white"
          height={46}
          onPress={() =>
            Alert.alert('Reset Drrys?', 'This deletes your forest, cards and progress on this device.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reset', style: 'destructive', onPress: async () => {
                  await forgetLogin(); // the cloud copy stays; signing in again brings the forest back
                  await disableReminders().catch(() => {});
                  linkPurchases(undefined);
                  reset();
                  router.replace('/onboarding');
                } },
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
          {value ? <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted,  }}>{value}</Text> : null}
          {onPress && <Ionicons name="chevron-forward" size={14} color={C.muted} />}
        </>
      )}
    </Pressable>
  );
}

/** First two answers, then "+N". */
function short(list: string[]) {
  if (!list.length) return 'Add';
  return list.slice(0, 2).join(' • ') + (list.length > 2 ? ` +${list.length - 2}` : '');
}
