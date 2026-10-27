// Pick pages (or slides) from..to of a lecture file: drag either end of the bar, tap a quick choice
// (all / first half / second half), or nudge an end by one with − and +. If the file's length is unknown,
// only the − / + steppers show.
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { T } from '@/components/ui';
import { haptic, tap } from '@/lib/feedback';

import { color, motion, radius, S, shadow } from './tokens';

const THUMB = 30;

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
  const units = (k: number) => `${k} ${k === 1 ? unit : `${unit}s`}`;
  const Unit = unit === 'slide' ? 'Slides' : 'Pages';
  const half = total ? Math.ceil(total / 2) : 0;
  const quick =
    total && total >= 4
      ? [
          { label: 'All', f: 1, t: total },
          { label: 'First half', f: 1, t: half },
          { label: 'Second half', f: half + 1, t: total },
        ]
      : total
        ? [{ label: 'All', f: 1, t: total }]
        : [];

  const set = (f: number, t: number) => {
    const max = total ?? Infinity;
    const a = Math.max(1, Math.min(f, max));
    const b = Math.max(a, Math.min(t, max));
    if (a !== from || b !== to) onChange(a, b);
  };

  return (
    <View style={{ backgroundColor: color.surface.card, borderWidth: 1, borderColor: color.border.default, borderRadius: radius.xl, padding: S[4], gap: S[4] }}>
      {/* what's picked, big and plain */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <T v="title" style={{ fontVariant: ['tabular-nums'] }}>
          {Unit} {from === to ? from : `${from}–${to}`}
        </T>
        <T v="caption" style={{ fontVariant: ['tabular-nums'] }}>
          {total ? `${units(n)} of ${total}` : units(n)}
        </T>
      </View>

      {!!total && total > 1 && <Bar total={total} from={from} to={to} onChange={set} />}

      {quick.length > 0 && (
        <View style={{ flexDirection: 'row', gap: S[2], flexWrap: 'wrap' }}>
          {quick.map((q) => {
            const on = q.f === from && q.t === to;
            return (
              <Pressable
                key={q.label}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => (tap('select'), set(q.f, q.t))}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: S[3],
                  height: 34,
                  borderRadius: radius.pill,
                  borderWidth: 1.5,
                  borderColor: on ? color.selected.border : color.border.strong,
                  backgroundColor: on ? color.selected.bg : color.surface.card,
                }}>
                {on && <Ionicons name="checkmark" size={14} color={color.selected.text} />}
                <T v="subhead" style={{ color: on ? color.selected.text : color.text.body }}>
                  {q.label}
                </T>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* fine tuning, one page at a time */}
      <View style={{ flexDirection: 'row', gap: S[3] }}>
        <Stepper label="From" value={from} canDown={from > 1} canUp={from < to} onStep={(d) => set(from + d, to)} />
        <Stepper label="To" value={to} canDown={to > from} canUp={!total || to < total} onStep={(d) => set(from, to + d)} />
      </View>
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
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: color.bg.sunken, borderRadius: radius.lg, paddingVertical: S[2], paddingHorizontal: S[2] }}>
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

/** The bar: two round handles, the picked stretch filled green between them. */
function Bar({ total, from, to, onChange }: { total: number; from: number; to: number; onChange: (f: number, t: number) => void }) {
  const [w, setW] = useState(0);
  const span = Math.max(1, total - 1);
  const xOf = (v: number) => ((v - 1) / span) * w;
  const a = useSharedValue(0); // left handle x
  const b = useSharedValue(0); // right handle x
  const start = useSharedValue(0);
  const dragging = useSharedValue(0); // 0 none · 1 from · 2 to
  const last = useRef({ from, to });
  useEffect(() => {
    last.current = { from, to };
  }, [from, to]);

  // follow the values when they change from outside (quick choices, steppers)
  useEffect(() => {
    if (!w || dragging.value) return;
    a.value = withSpring(xOf(from), motion.spring.slide);
    b.value = withSpring(xOf(to), motion.spring.slide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, w]);

  const emit = (which: number, x: number) => {
    const v = Math.round((x / Math.max(1, w)) * span) + 1;
    const cur = last.current;
    if (which === 1 && v !== cur.from) {
      haptic();
      onChange(v, cur.to);
    } else if (which === 2 && v !== cur.to) {
      haptic();
      onChange(cur.from, v);
    }
  };
  const settle = () => {
    a.value = withSpring(xOf(last.current.from), motion.spring.slide);
    b.value = withSpring(xOf(last.current.to), motion.spring.slide);
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      // grab whichever handle is nearer the finger (x on the track, which is inset by half a handle)
      const x = e.x - THUMB / 2;
      const da = Math.abs(x - a.value);
      const db = Math.abs(x - b.value);
      const which = da < db || (da === db && x < a.value) ? 1 : 2;
      dragging.value = which;
      start.value = which === 1 ? a.value : b.value;
    })
    .onUpdate((e) => {
      const which = dragging.value;
      const step = w / span;
      if (which === 1) {
        const x = Math.max(0, Math.min(start.value + e.translationX, b.value));
        a.value = x;
        runOnJS(emit)(1, Math.round(x / step) * step);
      } else if (which === 2) {
        const x = Math.min(w, Math.max(start.value + e.translationX, a.value));
        b.value = x;
        runOnJS(emit)(2, Math.round(x / step) * step);
      }
    })
    .onFinalize(() => {
      dragging.value = 0;
      runOnJS(settle)();
    });

  const fill = useAnimatedStyle(() => ({ left: a.value, width: Math.max(0, b.value - a.value) }));
  const ta = useAnimatedStyle(() => ({ transform: [{ translateX: a.value - THUMB / 2 }] }));
  const tb = useAnimatedStyle(() => ({ transform: [{ translateX: b.value - THUMB / 2 }] }));
  const thumb = { position: 'absolute' as const, top: 0, left: 0, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: color.surface.card, borderWidth: 3, borderColor: color.action.primary, ...shadow.lift };

  return (
    <View style={{ gap: S[1] }}>
      <GestureDetector gesture={pan}>
        <View style={{ height: THUMB + 8, justifyContent: 'center', paddingHorizontal: THUMB / 2 }} accessibilityRole="adjustable" accessibilityLabel={`From ${from} to ${to}`}>
          <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: 8, borderRadius: 4, backgroundColor: color.surface.track }}>
            {w > 0 && <Animated.View style={[{ position: 'absolute', top: 0, height: 8, borderRadius: 4, backgroundColor: color.action.primary }, fill]} />}
            {w > 0 && (
              <>
                <Animated.View pointerEvents="none" style={[thumb, { top: -(THUMB - 8) / 2 }, ta]} />
                <Animated.View pointerEvents="none" style={[thumb, { top: -(THUMB - 8) / 2 }, tb]} />
              </>
            )}
          </View>
        </View>
      </GestureDetector>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 }}>
        <T v="caption">1</T>
        <T v="caption">{total}</T>
      </View>
    </View>
  );
}
