// "Your plan and your promise" — three quick steps (the Duolingo idea, kept honest):
//   1. minutes per subject a day (10 / 15 / 20 → Coco's depth: quick / balanced / deep)
//   2. streak goal (7 / 14 / 30 / 50 days)
//   3. reminder time, then the promise written from those choices: hold to promise (it fills with water),
//      and only then the system's notification prompt.
// One promise for the whole forest: the streak and the reminder are shared; the minutes are each tree's default.
// It comes right after "Show Coco your world": while the student answers, Coco's first explanation is made in
// the background (lib/first), so "Let me show you how we'll study" is ready when they get there.
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, runOnJS, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { color, ease, motion, radius } from '@/design/tokens';
import { COCO } from '@/art';
import { Btn, Enter, OnbBar } from '@/components/ui';
import { useBack } from '@/lib/back';
import { haptic, tap } from '@/lib/feedback';
import { enableReminders, hourLabel } from '@/lib/notify';
import { progressOf } from '@/lib/onboarding';
import { useApp, type Depth, type Plan as PlanT } from '@/store';
import { C, F } from '@/theme';

const MINUTES: { v: PlanT['minutes']; label: string; depth: Depth }[] = [
  { v: 10, label: 'Light', depth: 'quick' },
  { v: 15, label: 'Steady', depth: 'balanced' },
  { v: 20, label: 'Deep', depth: 'deep' },
];
const GOALS = [
  { v: 7, label: 'Good' },
  { v: 14, label: 'Great' },
  { v: 30, label: 'Amazing' },
  { v: 50, label: 'Unstoppable' },
];
const TIMES = [
  { h: 17, label: 'Afternoon' },
  { h: 20, label: 'Evening' },
  { h: 22, label: 'Night' },
];
const HOLD_MS = 2000;

export default function Plan() {
  const set = useApp((s) => s.set);
  const setProfile = useApp((s) => s.setProfile);
  const [step, setStep] = useState(0);
  const [minutes, setMinutes] = useState<PlanT['minutes']>(15);
  const [goal, setGoal] = useState(14);
  const [hour, setHour] = useState(20);
  const [promised, setPromised] = useState(false);

  const back = useCallback(() => {
    if (step > 0 && !promised) return setStep(step - 1), true;
    return false;
  }, [step, promised]);
  useBack(back);

  const save = (didPromise: boolean) => {
    const st = useApp.getState();
    set({
      plan: { minutes, streakGoal: goal, promised: didPromise },
      coco: { ...st.coco, depth: MINUTES.find((m) => m.v === minutes)!.depth },
    });
    setProfile({ reminderHour: hour });
  };

  // on to Coco's first explanation (made in the background while the student was here)
  const finish = () => router.push('/onboarding/first');

  const onPromise = async () => {
    setPromised(true);
    haptic('success');
    save(true);
    // the system prompt comes only now, after the student has said why they want it
    setTimeout(async () => {
      await enableReminders();
      finish();
    }, 1400);
  };

  const notNow = () => {
    save(false);
    finish();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream, padding: 20 }}>
      <OnbBar value={progressOf('plan')} onBack={() => back() || (router.canGoBack() && router.back())} style={{ marginBottom: 18 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <Image source={promised ? COCO.bell : COCO.classic} style={{ width: 56, height: 70 }} contentFit="contain" />
        <Enter key={`${step}${promised}`} style={{ flex: 1 }}>
          <View style={{ backgroundColor: C.white, borderRadius: radius.lg, borderWidth: 1.5, borderColor: C.lineStrong, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Text style={{ fontFamily: F.medium, fontSize: 16, lineHeight: 22, color: C.teal }}>
              {promised
                ? `I’ll remind you at ${hourLabel(hour)}.`
                : step === 0
                  ? 'How long can you study each subject a day?'
                  : step === 1
                    ? 'How many days in a row can you keep your tree green?'
                    : 'When should I remind you?'}
            </Text>
          </View>
        </Enter>
      </View>

      {step === 0 && (
        <Enter key="m" style={{ gap: 12 }}>
          {MINUTES.map((m) => (
            <Option key={m.v} big={`${m.v} min`} small={m.label} on={minutes === m.v} onPress={() => setMinutes(m.v)} />
          ))}
        </Enter>
      )}

      {step === 1 && (
        <Enter key="g" style={{ gap: 12 }}>
          {GOALS.map((g) => (
            <Option key={g.v} big={`${g.v} days`} small={g.label} on={goal === g.v} onPress={() => setGoal(g.v)} />
          ))}
          <Text style={{ fontFamily: F.regular, fontSize: 14, color: C.muted, textAlign: 'center', marginTop: 4 }}>Short daily sessions beat long cramming sessions.</Text>
        </Enter>
      )}

      {step === 2 && (
        <Enter key="p" style={{ flex: 1, gap: 18 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {TIMES.map((t) => {
              const on = hour === t.h;
              return (
                <Pressable
                  key={t.h}
                  disabled={promised}
                  onPress={() => (tap('select'), setHour(t.h))}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.lg, borderWidth: 1.5, borderBottomWidth: 4, borderColor: on ? color.selected.border : C.lineStrong, backgroundColor: on ? C.cardSelected : C.card }}>
                  <Text style={{ fontFamily: F.semi, fontSize: 15, color: on ? color.selected.text : C.ink }}>{t.label}</Text>
                  <Text style={{ fontFamily: F.regular, fontSize: 13, color: on ? color.selected.text : C.muted, fontVariant: ['tabular-nums'] }}>{hourLabel(t.h)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ fontFamily: F.medium, fontSize: 22, lineHeight: 31, color: C.ink, textAlign: 'center', letterSpacing: -0.3 }}>
            “I’ll water my trees every day at <Text style={{ color: C.teal }}>{hourLabel(hour)}</Text>, <Text style={{ color: C.teal }}>{minutes} minutes</Text> per subject, for{' '}
            <Text style={{ color: C.teal }}>{goal} days</Text> in a row.”
          </Text>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <HoldToPromise done={promised} onDone={onPromise} />
          </View>
        </Enter>
      )}

      <View style={{ flex: step === 2 ? 0 : 1 }} />
      {step < 2 ? (
        <Btn title="Continue" mono onPress={() => setStep(step + 1)} />
      ) : (
        // promised already (back from the next screen): straight on
        promised ? (
          <Btn title="Continue" mono onPress={finish} />
        ) : (
          <Pressable onPress={notNow} style={{ alignSelf: 'center', padding: 8 }}>
            <Text style={{ fontFamily: F.medium, fontSize: 15, color: C.muted }}>Not now</Text>
          </Pressable>
        )
      )}
    </SafeAreaView>
  );
}

function Option({ big, small, on, onPress }: { big: string; small: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => (tap('select'), onPress())}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 16, borderRadius: radius.lg, borderWidth: 1.5, borderBottomWidth: 4, borderColor: on ? color.selected.border : C.lineStrong, backgroundColor: on ? C.cardSelected : C.card }}>
      <Text style={{ fontFamily: F.semi, fontSize: 22, color: on ? color.selected.text : C.ink, fontVariant: ['tabular-nums'] }}>{big}</Text>
      <Text style={{ fontFamily: F.medium, fontSize: 15, color: on ? color.selected.text : C.muted }}>{small}</Text>
    </Pressable>
  );
}

// A big round button that fills with water while held; let go early and it drains.
function HoldToPromise({ done, onDone }: { done: boolean; onDone: () => void }) {
  const fill = useSharedValue(done ? 1 : 0);
  // held: the circle slowly presses in (deliberate); done: it pops back with one small bounce
  const squeeze = useSharedValue(1);
  const size = 170;
  const start = () => {
    if (done) return;
    haptic('light');
    squeeze.value = withTiming(0.95, { duration: 600, easing: ease.out });
    fill.value = withTiming(1, { duration: HOLD_MS * (1 - fill.value), easing: Easing.linear }, (ok) => {
      if (ok) {
        squeeze.value = withSequence(withTiming(1.06, { duration: 140, easing: ease.out }), withSpring(1, motion.spring.bouncy));
        runOnJS(onDone)();
      }
    });
  };
  const stop = () => {
    if (done || fill.value >= 1) return;
    cancelAnimation(fill);
    fill.value = withTiming(0, { duration: 350, easing: ease.out });
    squeeze.value = withSpring(1, motion.spring.press);
  };
  const water = useAnimatedStyle(() => ({ height: `${fill.value * 100}%` }));
  const body = useAnimatedStyle(() => ({ transform: [{ scale: squeeze.value }] }));
  return (
    <Pressable onPressIn={start} onPressOut={stop} accessibilityRole="button" accessibilityLabel="Hold to promise">
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: done ? color.selected.bg : C.white, borderWidth: 4, borderColor: color.action.primary, alignItems: 'center', justifyContent: 'center' }, body]}>
        <Animated.View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: color.game.water }, water]} />
        <Text style={{ fontFamily: F.semi, fontSize: 18, lineHeight: 24, color: done ? color.selected.text : color.text.primary, textAlign: 'center' }}>{done ? 'Promised!' : 'Hold to\npromise'}</Text>
      </Animated.View>
    </Pressable>
  );
}
