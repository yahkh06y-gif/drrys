// Connect each item on the left to its partner on the right: drag from a left card to a right card
// (or tap one, then the other).
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptic, tap } from '@/lib/feedback';
import { C, F } from '@/theme';

const RH = 52; // row height
const GAP = 12;
const P = RH + GAP;

type Pair = { left: string; right: string };

/** A line from (x0,y0) to (x1,y1), drawn as a thin rotated bar. */
function Line({ x0, y0, x1, y1, color }: { x0: number; y0: number; x1: number; y1: number; color: string }) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x0,
        top: y0 - 1.5,
        width: Math.sqrt(dx * dx + dy * dy),
        height: 3,
        borderRadius: 2,
        backgroundColor: color,
        transformOrigin: '0% 50%',
        transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
      }}
    />
  );
}

export function MatchQ({ pairs, locked, marks, onChange }: { pairs: Pair[]; locked: boolean; marks?: Record<string, boolean>; onChange: (matched: Record<string, string>, complete: boolean) => void }) {
  const lefts = pairs.map((p) => p.left);
  const rights = useMemo(() => {
    const r = pairs.map((p) => p.right);
    for (let tries = 0; tries < 8; tries++) {
      for (let i = r.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [r[i], r[j]] = [r[j], r[i]];
      }
      if (r.some((x, i) => x !== pairs[i].right)) break;
    }
    return r;
  }, [pairs]);
  const [w, setW] = useState(0);
  const [link, setLink] = useState<Record<number, number>>({}); // left index → right index
  const [sel, setSel] = useState<number>();

  useEffect(() => {
    const m: Record<string, string> = {};
    Object.entries(link).forEach(([l, r]) => (m[lefts[+l]] = rights[r]));
    onChange(m, Object.keys(link).length === pairs.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link]);

  const colW = w * 0.4;
  const xL = colW; // where the left cards end
  const xR = w - colW; // where the right cards begin
  const connect = (l: number, r: number) => {
    haptic('light');
    setLink((cur) => {
      const next: Record<number, number> = {};
      Object.entries(cur).forEach(([k, v]) => v !== r && +k !== l && (next[+k] = v)); // one partner each
      next[l] = r;
      return next;
    });
    setSel(undefined);
  };
  const drop = (l: number, y: number) => {
    const r = Math.round((y - RH / 2) / P);
    if (r >= 0 && r < rights.length && Math.abs(y - (r * P + RH / 2)) < RH / 2 + 6) connect(l, r);
  };

  return (
    <View style={{ height: pairs.length * P - GAP }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 &&
        Object.entries(link).map(([l, r]) => {
          const m = locked ? marks?.[lefts[+l]] : undefined;
          return <Line key={l} x0={xL} y0={+l * P + RH / 2} x1={xR} y1={r * P + RH / 2} color={m === undefined ? C.teal : m ? C.leaf : '#E56B6B'} />;
        })}
      {lefts.map((t, i) => (
        <LeftCard key={t} label={t} y={i * P} w={colW} x1={xL} locked={locked} selected={sel === i} linked={i in link} onTap={() => (tap('select'), setSel(sel === i ? undefined : i))} onDrop={(y) => drop(i, y)} />
      ))}
      {rights.map((t, i) => (
        <Pressable
          key={t}
          disabled={locked}
          onPress={() => sel !== undefined && connect(sel, i)}
          style={{ position: 'absolute', right: 0, top: i * P, width: colW, height: RH, justifyContent: 'center', paddingHorizontal: 10, backgroundColor: Object.values(link).includes(i) ? '#EAF3F1' : C.white, borderRadius: 14, borderWidth: 1.5, borderColor: sel !== undefined ? C.mintBorder : C.lineStrong, borderBottomWidth: 3 }}>
          <Text numberOfLines={3} style={{ fontFamily: F.bold, fontSize: 12, lineHeight: 15, color: C.ink }}>
            {t}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function LeftCard({ label, y, w, x1, locked, selected, linked, onTap, onDrop }: { label: string; y: number; w: number; x1: number; locked: boolean; selected: boolean; linked: boolean; onTap: () => void; onDrop: (y: number) => void }) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const on = useSharedValue(0);
  const pan = Gesture.Pan()
    .enabled(!locked)
    .minDistance(6)
    .onStart(() => {
      on.value = 1;
    })
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      on.value = 0;
      const endY = y + RH / 2 + e.translationY;
      runOnJS(onDrop)(endY);
      tx.value = withTiming(0, { duration: 120 });
      ty.value = withTiming(0, { duration: 120 });
    });
  // the rubber-band line that follows the finger
  const band = useAnimatedStyle(() => {
    const dx = tx.value + 0;
    const dy = ty.value;
    return { opacity: on.value, width: Math.sqrt(dx * dx + dy * dy), transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }] };
  });
  return (
    <>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x1, top: y + RH / 2 - 1.5, height: 3, borderRadius: 2, backgroundColor: C.amber, transformOrigin: '0% 50%' }, band]} />
      <GestureDetector gesture={pan}>
        <Pressable
          onPress={onTap}
          disabled={locked}
          style={{ position: 'absolute', left: 0, top: y, width: w, height: RH, justifyContent: 'center', paddingHorizontal: 10, backgroundColor: selected ? C.teal : linked ? '#EAF3F1' : C.white, borderRadius: 14, borderWidth: 1.5, borderColor: selected ? C.teal : C.lineStrong, borderBottomWidth: 3 }}>
          <Text numberOfLines={3} style={{ fontFamily: F.bold, fontSize: 12, lineHeight: 15, color: selected ? C.white : C.ink }}>
            {label}
          </Text>
          <View style={{ position: 'absolute', right: -7, top: RH / 2 - 7, width: 14, height: 14, borderRadius: 7, backgroundColor: linked || selected ? C.teal : C.amber, borderWidth: 2, borderColor: C.white }} />
        </Pressable>
      </GestureDetector>
    </>
  );
}
