// Pick today's pages (or slides): every page of the file is a slim tile in one row, like a stack of pages seen
// from the side. Swipe across the tiles you want; tap a tile to move the nearer end there. While you drag, a small
// bubble over your finger shows the page. If the file's length is unknown, two − / + steppers show instead.
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { T } from '@/components/ui';
import { haptic, tap } from '@/lib/feedback';

import { color, ease, motion, palette, radius, S } from './tokens';

const STRIP_H = 44; // the row of pages
const LOW = 24; // a page that isn't picked
const BUBBLE = 30;

export function RangePicker({
  total,
  from,
  to,
  unit,
  onChange,
}: {
  /** pages in the file; undefined while counting or if it can't be counted */
  total?: number;
  from: number;
  to: number;
  unit: 'page' | 'slide';
  onChange: (from: number, to: number) => void;
}) {
  const n = to - from + 1;
  const Unit = unit === 'slide' ? 'Slides' : 'Pages';
  const all = !!total && from === 1 && to === total;
  const minutes = Math.max(10, n * 3);

  const set = (f: number, t: number) => {
    const max = total ?? Infinity;
    const a = Math.max(1, Math.min(f, t, max));
    const b = Math.max(a, Math.min(Math.max(f, t), max));
    if (a !== from || b !== to) onChange(a, b);
  };

  return (
    <View style={{ backgroundColor: color.surface.card, borderWidth: 1, borderColor: color.border.default, borderRadius: radius.xl, padding: S[4], gap: S[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: S[3] }}>
        <View style={{ flex: 1 }}>
          <T v="h3" style={{ fontVariant: ['tabular-nums'] }}>
            {Unit} {from === to ? from : `${from}–${to}`}
          </T>
          <T v="caption" style={{ fontVariant: ['tabular-nums'] }}>
            About {minutes} min
          </T>
        </View>
        {!!total && total > 1 && !all && (
          <Pressable
            hitSlop={10}
            accessibilityRole="button"
            onPress={() => (tap('select'), set(1, total))}
            style={{ height: 32, paddingHorizontal: S[3], borderRadius: radius.pill, backgroundColor: color.surface.muted, justifyContent: 'center' }}>
            <T v="subhead" style={{ color: color.text.brand }}>
              All {total}
            </T>
          </Pressable>
        )}
      </View>

      {total && total > 1 ? <Pages total={total} from={from} to={to} unit={unit} onChange={set} /> : <Steppers from={from} to={to} total={total} onChange={set} />}
    </View>
  );
}

/** The row of pages. Picked pages stand tall in pine (the "selected" color); the rest sit low and quiet. */
function Pages({ total, from, to, unit, onChange }: { total: number; from: number; to: number; unit: 'page' | 'slide'; onChange: (f: number, t: number) => void }) {
  const [w, setW] = useState(0);
  const [drag, setDrag] = useState<number>(); // the page under the finger while dragging
  const gap = total <= 40 ? 3 : total <= 80 ? 2 : 1;
  const tile = w ? (w - gap * (total - 1)) / total : 0;
  // a drag that starts on an end moves that end; one that starts anywhere else picks from there to the finger
  const mode = useSharedValue(0); // 0 pick from the anchor · 1 move "from" · 2 move "to"
  const anchor = useSharedValue(1);
  const last = useSharedValue(0);
  const pageAt = (x: number) => {
    'worklet';
    return Math.max(1, Math.min(total, Math.floor((x / Math.max(1, w)) * total) + 1));
  };
  const pick = (m: number, a: number, p: number) => {
    haptic();
    setDrag(p);
    if (m === 1) onChange(Math.min(p, to), to);
    else if (m === 2) onChange(from, Math.max(p, from));
    else onChange(Math.min(a, p), Math.max(a, p));
  };
  const end = () => setDrag(undefined);
  // a tap moves whichever end is nearer to that page
  const tapAt = (p: number) => {
    tap('select');
    if (Math.abs(p - from) <= Math.abs(p - to)) onChange(p, to);
    else onChange(from, p);
  };

  const near = Math.max(1, Math.round(total / 25));
  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-14, 14])
    .onBegin((e) => {
      anchor.value = pageAt(e.x); // where the finger first touched
    })
    .onStart(() => {
      const p = anchor.value;
      mode.value = Math.abs(p - from) <= near && p <= to ? 1 : Math.abs(p - to) <= near && p >= from ? 2 : 0;
      last.value = 0;
    })
    .onUpdate((e) => {
      const p = pageAt(e.x);
      if (p === last.value) return;
      last.value = p;
      runOnJS(pick)(mode.value, anchor.value, p);
    })
    .onFinalize(() => runOnJS(end)());
  const tapG = Gesture.Tap().onEnd((e, ok) => {
    if (ok) runOnJS(tapAt)(pageAt(e.x));
  });

  const bubbleX = drag && tile ? (drag - 0.5) * (tile + gap) - BUBBLE / 2 : 0;

  return (
    <View style={{ gap: S[1] }}>
      <GestureDetector gesture={Gesture.Race(pan, tapG)}>
        <View
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${unit === 'slide' ? 'Slides' : 'Pages'} ${from} to ${to} of ${total}`}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? onChange(from, Math.min(total, to + 1)) : onChange(from, Math.max(from, to - 1)))}
          style={{ height: STRIP_H + 8, justifyContent: 'flex-end' }}>
          <View style={{ height: STRIP_H, flexDirection: 'row', alignItems: 'flex-end', gap }}>
            {tile > 0 && Array.from({ length: total }, (_, i) => <Tile key={i} on={i + 1 >= from && i + 1 <= to} edge={i + 1 === from || i + 1 === to} width={tile} />)}
          </View>
          {drag !== undefined && (
            <View pointerEvents="none" style={{ position: 'absolute', top: -BUBBLE + 2, left: Math.max(-4, Math.min(w - BUBBLE + 4, bubbleX)), width: BUBBLE, height: BUBBLE - 4, borderRadius: radius.md, backgroundColor: palette.pine600, alignItems: 'center', justifyContent: 'center' }}>
              <T v="micro" style={{ color: palette.neutral50, fontVariant: ['tabular-nums'] }}>
                {drag}
              </T>
            </View>
          )}
        </View>
      </GestureDetector>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T v="caption" style={{ fontVariant: ['tabular-nums'] }}>
          1
        </T>
        <T v="caption" style={{ fontVariant: ['tabular-nums'] }}>
          {total}
        </T>
      </View>
    </View>
  );
}

function Tile({ on, edge, width }: { on: boolean; edge: boolean; width: number }) {
  const reduce = useReducedMotion();
  const h = useSharedValue(on ? STRIP_H : LOW);
  const target = on ? (edge ? STRIP_H : STRIP_H - 6) : LOW;
  useEffect(() => {
    h.value = reduce ? target : withTiming(target, { duration: motion.fast, easing: ease.out });
  }, [target, reduce, h]);
  const a = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[{ width, borderRadius: Math.min(4, width / 2), backgroundColor: on ? (edge ? palette.pine600 : palette.pine400) : color.surface.track }, a]} />;
}

/** When the file's length is unknown: just the two ends, one page at a time. */
function Steppers({ from, to, total, onChange }: { from: number; to: number; total?: number; onChange: (f: number, t: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: S[3] }}>
      <Stepper label="From" value={from} canDown={from > 1} canUp={from < to} onStep={(d) => onChange(from + d, to)} />
      <Stepper label="To" value={to} canDown={to > from} canUp={!total || to < total} onStep={(d) => onChange(from, to + d)} />
    </View>
  );
}

function Stepper({ label, value, canDown, canUp, onStep }: { label: string; value: number; canDown: boolean; canUp: boolean; onStep: (d: number) => void }) {
  const btn = (d: number, ok: boolean) => (
    <Pressable
      hitSlop={8}
      disabled={!ok}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${d > 0 ? 'plus' : 'minus'} one`}
      onPress={() => (tap(), onStep(d))}
      style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface.muted, opacity: ok ? 1 : 0.35 }}>
      <Ionicons name={d > 0 ? 'add' : 'remove'} size={18} color={color.text.brand} />
    </Pressable>
  );
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: color.bg.sunken, borderRadius: radius.lg, padding: S[2] }}>
      {btn(-1, canDown)}
      <View style={{ alignItems: 'center' }}>
        <T v="caption">{label}</T>
        <T v="subhead" style={{ color: color.text.primary, fontVariant: ['tabular-nums'] }}>
          {value}
        </T>
      </View>
      {btn(1, canUp)}
    </View>
  );
}
