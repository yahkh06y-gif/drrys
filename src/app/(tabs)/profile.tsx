// Profile: who you are, how you're doing, and the few settings a student needs.
// Layout: large title → identity card → three stats → plan → grouped lists (one job per group) → reset.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { autoDir, dirIcon } from '@/design/rtl';
import { color, radius, shadow } from '@/design/tokens';
import { COCO, STAT_ICONS } from '@/art';
import { Btn, Confirm, Progress, XpStars } from '@/components/ui';
import { aiLabel } from '@/lib/ai';
import { play, tap } from '@/lib/feedback';
import { DEFAULT_HOUR, disableReminders, enableReminders, hourLabel, REMINDER_HOURS, remindersSupported } from '@/lib/notify';
import { LIMITS, linkPurchases, restore } from '@/lib/purchases';
import { friendBranches, SQUAD_OFF, SQUAD_SIZE } from '@/lib/together';
import { forgetLogin } from '@/lib/cloud';
import { streak, useApp } from '@/store';
import { C, F } from '@/theme';

const STYLE_LABEL = { friendly: 'Friendly coach', calm: 'Calm tutor', direct: 'Direct & focused', playful: 'Playful buddy' } as const;

export default function Profile() {
  const profile = useApp((s) => s.profile);
  const isPro = useApp((s) => s.isPro);
  const subjects = useApp((s) => s.subjects);
  const stats = useApp((s) => s.stats);
  const sound = useApp((s) => s.sound);
  const coco = useApp((s) => s.coco);
  const together = useApp((s) => s.together);
  const set = useApp((s) => s.set);
  const setProfile = useApp((s) => s.setProfile);
  const reset = useApp((s) => s.reset);
  const [picking, setPicking] = useState(false); // reminder time sheet
  const [resetting, setResetting] = useState(false);

  const limit = isPro ? LIMITS.proTrees : LIMITS.freeTrees;
  const used = Math.min(subjects.length, limit);
  const resting = Math.max(0, subjects.length - limit); // kept from Pro days (see isResting)
  const days = streak(stats.studyDays);
  const name = profile.name || 'Student';
  const initials = name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const hour = profile.reminderHour ?? DEFAULT_HOUR;
  const studying = [profile.field, profile.subfield].filter(Boolean).join(' · ');

  const squadText = together?.squad
    ? `Your squad: ${together.squad.members.length} of ${SQUAD_SIZE}`
    : isPro
      ? `Friends get ${SQUAD_OFF}% off Pro`
      : `Study with ${SQUAD_SIZE - 1} friends, get ${SQUAD_OFF}% off`;

  const toggleReminders = async (v: boolean) => {
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
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.paper }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48, gap: 28 }} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={{ fontFamily: F.semi, fontSize: 28, lineHeight: 34, color: C.ink, letterSpacing: -0.5 }}>
          Profile
        </Text>

        {/* who you are: one tap opens the account */}
        <View style={{ gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={profile.uid ? `${name}, open account` : `${name}, sign in to back up`}
            onPress={() => (tap(), router.push('/account'))}
            style={({ pressed }) => [card, { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }, pressed && pressedStyle]}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: F.semi, fontSize: 20, color: C.moss }}>{initials}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={[{ fontFamily: F.semi, fontSize: 18, color: C.ink }, autoDir(name)]}>
                {name}
              </Text>
              {profile.uid ? (
                <Text numberOfLines={1} style={{ fontFamily: F.regular, fontSize: 14, color: C.muted }}>
                  {profile.email}
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.orange }} />
                  <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.orange }}>Sign in to back up your forest</Text>
                </View>
              )}
            </View>
            <Ionicons name={dirIcon('chevron-forward')} size={18} color={C.mutedLight} />
          </Pressable>

          {/* how you're doing, at a glance */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat icon={<Image source={STAT_ICONS.fire} style={{ width: 26, height: 26 }} contentFit="contain" />} value={days} label="day streak" />
            <Stat icon={<XpStars size={18} />} value={stats.xp} label="XP" />
            <Stat icon={<Image source={STAT_ICONS.clock} style={{ width: 26, height: 26 }} contentFit="contain" />} value={stats.minutes} label="minutes" />
          </View>
        </View>

        {/* plan */}
        <View style={[card, { padding: 16, gap: 12 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: F.semi, fontSize: 17, color: C.ink }}>{isPro ? 'Drrys Pro' : 'Free plan'}</Text>
              <Text style={{ fontFamily: F.regular, fontSize: 14, color: C.muted }}>
                {used} of {limit} subject {limit === 1 ? 'tree' : 'trees'}
              </Text>
            </View>
            {isPro ? (
              <View style={{ backgroundColor: C.mint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.moss }}>Active</Text>
              </View>
            ) : (
              <Btn title="Upgrade" kind="green" height={38} onPress={() => router.push('/paywall')} style={{ width: 104 }} />
            )}
          </View>
          <Progress value={subjects.length / limit} height={6} track={C.track} />
          {resting > 0 && (
            <Text style={{ fontFamily: F.medium, fontSize: 13, lineHeight: 18, color: C.orange }}>
              {resting} {resting === 1 ? 'tree is' : 'trees are'} resting. Renew Pro to study {resting === 1 ? 'it' : 'them'} again.
            </Text>
          )}
        </View>

        <Group title="Your studies">
          <Row icon="school-outline" label="Studying" value={studying || 'Add'} onPress={() => router.push({ pathname: '/about/[step]', params: { step: 'study' } })} />
          <Row icon="heart-outline" label="Interests" value={short(profile.interests)} onPress={() => router.push({ pathname: '/about/[step]', params: { step: 'world' } })} />
          <Row icon="people-outline" label="Study together" sub={!isPro && friendBranches(together) < 1 ? 'Invite a friend, get a free 2nd branch' : squadText} onPress={() => router.push('/together')} last />
        </Group>

        <Group title="Coco">
          <Row
            leading={<Image source={COCO[coco.outfit]} style={{ width: 30, height: 36 }} contentFit="contain" />}
            label="Look & style"
            value={STYLE_LABEL[coco.style] ?? coco.style}
            onPress={() => router.push('/customize')}
            last
          />
        </Group>

        <Group title="Preferences">
          <Row icon="notifications-outline" label="Daily reminder" last={!profile.reminders}>
            <Switch value={profile.reminders} onValueChange={toggleReminders} trackColor={{ true: C.leaf, false: C.track }} thumbColor={C.white} />
          </Row>
          {profile.reminders && <Row icon="time-outline" label="Reminder time" value={hourLabel(hour)} onPress={() => setPicking(true)} />}
          <Row icon="volume-high-outline" label="Sounds & haptics" last>
            <Switch
              value={sound}
              onValueChange={(v) => {
                set({ sound: v });
                if (v) play('select');
              }}
              trackColor={{ true: C.leaf, false: C.track }}
              thumbColor={C.white}
            />
          </Row>
        </Group>

        <Group title="Support">
          <Row
            icon="refresh-outline"
            label="Restore purchases"
            onPress={async () => {
              const ok = await restore();
              Alert.alert(ok ? 'Welcome back to Pro' : 'No active subscription found');
            }}
          />
          <Row icon="trash-outline" label="Reset app" danger onPress={() => setResetting(true)} last />
        </Group>

        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.mutedLight }}>{profile.uid ? 'Backed up to your account' : 'Saved on this phone only'}</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.mutedLight }}>
            Drrys 1.0.0 · Coco runs on {aiLabel}
          </Text>
        </View>
      </ScrollView>

      <Sheet visible={picking} title="Reminder time" onClose={() => setPicking(false)}>
        {REMINDER_HOURS.map((h, i) => (
          <Row
            key={h}
            label={hourLabel(h)}
            selected={hour === h}
            onPress={() => {
              setProfile({ reminderHour: h });
              setPicking(false);
            }}
            last={i === REMINDER_HOURS.length - 1}
          />
        ))}
      </Sheet>

      <Confirm
        visible={resetting}
        title="Reset Drrys?"
        body="This deletes your forest, cards and progress on this phone. If you're signed in, signing in again brings them back."
        no="Cancel"
        yes="Reset"
        onNo={() => setResetting(false)}
        onYes={async () => {
          setResetting(false);
          await forgetLogin(); // the cloud copy stays; signing in again brings the forest back
          await disableReminders().catch(() => {});
          linkPurchases(undefined);
          reset();
          router.replace('/onboarding');
        }}
      />
    </SafeAreaView>
  );
}

/* ---------- pieces ---------- */

// one card style for the whole screen: a card you read is flat (one hairline, no edge)
const card: ViewStyle = { backgroundColor: C.white, borderRadius: radius.xl, borderWidth: 1, borderColor: C.line };
const pressedStyle: ViewStyle = { backgroundColor: C.sand };

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={[card, { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 6 }]}>
      <View style={{ height: 26, justifyContent: 'center' }}>{icon}</View>
      <Text style={{ fontFamily: F.semi, fontSize: 20, lineHeight: 24, color: C.ink, fontVariant: ['tabular-nums'] }}>{compact(value)}</Text>
      <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>{label}</Text>
    </View>
  );
}

function Group({ title, children, style }: { title: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 8 }, style]}>
      <Text accessibilityRole="header" style={{ fontFamily: F.medium, fontSize: 14, color: C.muted, paddingHorizontal: 4 }}>
        {title}
      </Text>
      <View style={[card, { overflow: 'hidden' }]}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  leading,
  label,
  value,
  sub,
  onPress,
  children,
  last,
  danger,
  selected,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  leading?: React.ReactNode;
  label: string;
  value?: string;
  sub?: string;
  onPress?: () => void;
  children?: React.ReactNode;
  last?: boolean;
  danger?: boolean;
  selected?: boolean;
}) {
  const tint = danger ? C.orange : C.teal;
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={selected !== undefined ? { selected } : undefined}
      onPress={() => (tap(), onPress?.())}
      style={({ pressed }) => [{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 }, pressed && pressedStyle]}>
      {leading ?? (icon && (
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: danger ? color.feedback.wrong.bg : color.selected.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
      ))}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontFamily: F.medium, fontSize: 16, color: danger ? C.orange : C.ink }}>{label}</Text>
          {value ? (
            <Text numberOfLines={1} style={{ flex: 1, textAlign: 'right', fontFamily: F.regular, fontSize: 15, color: C.muted }}>
              {value}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
        </View>
        {sub && <Text style={{ fontFamily: F.regular, fontSize: 13, lineHeight: 18, color: C.muted }}>{sub}</Text>}
      </View>
      {children ?? (selected !== undefined ? (selected ? <Ionicons name="checkmark" size={20} color={C.teal} /> : <View style={{ width: 20 }} />) : onPress && !danger && <Ionicons name={dirIcon('chevron-forward')} size={18} color={C.mutedLight} />)}
      {!last && <View style={{ position: 'absolute', bottom: 0, right: 0, left: leading || icon ? 64 : 16, height: 1, backgroundColor: color.border.subtle }} />}
    </Pressable>
  );
}

/** A bottom sheet with a short list (tap outside or a choice to close). */
function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: color.overlay.scrim, justifyContent: 'flex-end' }}>
        <Pressable style={{ ...shadow.sheet, backgroundColor: C.paper, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 36, gap: 14 }}>
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: radius.xs, backgroundColor: C.track }} />
          <Text style={{ fontFamily: F.semi, fontSize: 19, color: C.ink, textAlign: 'center' }}>{title}</Text>
          <View style={[card, { overflow: 'hidden' }]}>{children}</View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** 1250 → "1.3k" so the stat tiles never wrap. */
function compact(n: number) {
  return n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);
}

/** First two answers, then "+N". */
function short(list: string[]) {
  if (!list.length) return 'Add';
  return list.slice(0, 2).join(', ') + (list.length > 2 ? ` +${list.length - 2}` : '');
}
