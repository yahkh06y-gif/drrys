// Drag the steps into the right order. The handle on the left starts the drag; the others make room.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { C, F } from '@/theme';

const H = 58; // one slot: item height 50 + gap 8

function shuffled(steps: string[]) {
  const a = steps.map((label, id) => ({ id, label }));
  for (let tries = 0; tries < 8; tries++) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (a.some((x, i) => x.label !== steps[i])) break; // never start already solved
  }
  return a;
}

export function OrderQ({ steps, locked, marks, onChange }: { steps: string[]; locked: boolean; marks?: boolean[]; onChange: (order: string[]) => void }) {
  const items = useMemo(() => shuffled(steps), [steps]);
  const start0 = items.map((_, id) => items.findIndex((it) => it.id === id)); // pos[id] = the slot item `id` starts in (the shuffled order)
  const pos = useSharedValue(start0); // pos[id] = the slot the item is in now (read on the UI thread only)
  const [slots, setSlots] = useState(start0); // the same, for drawing the marks (React must not read the shared value while rendering)
  const labelsBySlot = (p: number[]) => {
    const out: string[] = [];
    items.forEach((it) => (out[p[it.id]] = it.label));
    return out;
  };
  const report = (p: number[]) => (setSlots(p), onChange(labelsBySlot(p)));
  useEffect(() => {
    setSlots(start0);
    onChange(labelsBySlot(start0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  return (
    <View style={{ height: items.length * H }}>
      {items.map((it) => (
        <Row key={it.id} id={it.id} label={it.label} pos={pos} slot0={start0[it.id]} n={items.length} locked={locked} mark={locked ? marks?.[slots[it.id]] : undefined} onEnd={report} />
      ))}
    </View>
  );
}

function Row({ id, label, pos, slot0, n, locked, mark, onEnd }: { id: number; label: string; pos: SharedValue<number[]>; slot0: number; n: number; locked: boolean; mark?: boolean; onEnd: (p: number[]) => void }) {
  const top = useSharedValue(slot0 * H);
  const start = useSharedValue(0);
  const dragging = useSharedValue(false);
  useAnimatedReaction(
    () => pos.value[id],
    (slot) => {
      if (!dragging.value) top.value = withTiming(slot * H, { duration: 180 });
    },
  );
  const pan = Gesture.Pan()
    .enabled(!locked)
    .onStart(() => {
      dragging.value = true;
      start.value = top.value;
    })
    .onUpdate((e) => {
      top.value = Math.max(0, Math.min((n - 1) * H, start.value + e.translationY));
      const slot = Math.max(0, Math.min(n - 1, Math.round(top.value / H)));
      const cur = pos.value[id];
      if (slot !== cur) {
        const next = pos.value.slice();
        next[next.indexOf(slot)] = cur; // whoever sat there takes my old slot
        next[id] = slot;
        pos.value = next;
      }
    })
    .onEnd(() => {
      dragging.value = false;
      top.value = withTiming(pos.value[id] * H, { duration: 150 });
      runOnJS(onEnd)(pos.value.slice());
    });
  const st = useAnimatedStyle(() => ({
    top: top.value,
    zIndex: dragging.value ? 10 : 1,
    transform: [{ scale: dragging.value ? 1.03 : 1 }],
    shadowOpacity: dragging.value ? 0.25 : 0,
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          height: 50,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: mark === undefined ? C.white : mark ? '#F0F8E6' : '#FFF1EC',
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: mark === undefined ? C.lineStrong : mark ? C.mintBorder : '#F2A58A',
          borderBottomWidth: 3,
          shadowColor: '#000',
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        },
        st,
      ]}>
      <GestureDetector gesture={pan}>
        <View style={{ width: 48, height: 50, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={locked ? (mark ? 'checkmark-circle' : 'close-circle') : 'reorder-three'} size={26} color={locked ? (mark ? C.leaf : C.orange) : C.muted} />
        </View>
      </GestureDetector>
      <Text numberOfLines={2} style={{ flex: 1, fontFamily: F.bold, fontSize: 14, lineHeight: 18, color: C.ink, paddingRight: 12 }}>
        {label}
      </Text>
    </Animated.View>
  );
}
