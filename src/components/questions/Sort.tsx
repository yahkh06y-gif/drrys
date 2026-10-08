// Drag each item into the group it belongs to. Dropped items can be tapped to send them back.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptic, tap } from '@/lib/feedback';
import { C, F } from '@/theme';

type Bucket = { name: string; items: string[] };

export function SortQ({ buckets, locked, marks, onChange }: { buckets: Bucket[]; locked: boolean; marks?: Record<string, boolean>; onChange: (assigned: Record<string, string>, complete: boolean) => void }) {
  const items = useMemo(() => {
    const all = buckets.flatMap((b) => b.items);
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
  }, [buckets]);
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const refs = useRef<(View | null)[]>([]);

  useEffect(() => {
    onChange(assigned, items.every((x) => assigned[x]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assigned]);

  // which group is under the finger? measured when the drop happens, so scrolling never throws it off
  const drop = (item: string, x: number, y: number) => {
    buckets.forEach((b, i) => {
      refs.current[i]?.measureInWindow((bx, by, bw, bh) => {
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
          haptic('light');
          setAssigned((a) => ({ ...a, [item]: b.name }));
        }
      });
    });
  };

  const loose = items.filter((x) => !assigned[x]);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ zIndex: 5, flexDirection: 'row', flexWrap: 'wrap', gap: 8, minHeight: 44 }}>
        {loose.map((x) => (
          <Chip key={x} label={x} locked={locked} onDrop={drop} />
        ))}
        {!loose.length && !locked && <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.leaf }}>All sorted ✓</Text>}
      </View>
      <View style={{ zIndex: 1, gap: 10 }}>
        {buckets.map((b, i) => (
          <View
            key={b.name}
            ref={(r) => {
              refs.current[i] = r;
            }}
            style={{ backgroundColor: '#F6F3EB', borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.lineStrong, padding: 12, gap: 8, minHeight: 84 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.teal }}>{b.name}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {items
                .filter((x) => assigned[x] === b.name)
                .map((x) => {
                  const m = locked ? marks?.[x] : undefined;
                  return (
                    <Pressable
                      key={x}
                      disabled={locked}
                      onPress={() => (tap('select'), setAssigned((a) => ({ ...a, [x]: '' })))}
                      style={{ backgroundColor: m === undefined ? C.white : m ? '#F0F8E6' : '#FFF1EC', borderWidth: 1.5, borderColor: m === undefined ? C.lineStrong : m ? C.mintBorder : '#F2A58A', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.ink }}>
                        {m === undefined ? '' : m ? '✓ ' : '✗ '}
                        {x}
                      </Text>
                    </Pressable>
                  );
                })}
              {!items.some((x) => assigned[x] === b.name) && <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>Drop here</Text>}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function Chip({ label, locked, onDrop }: { label: string; locked: boolean; onDrop: (item: string, x: number, y: number) => void }) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const lift = useSharedValue(0);
  const pan = Gesture.Pan()
    .enabled(!locked)
    .onStart(() => {
      lift.value = 1;
    })
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      lift.value = 0;
      runOnJS(onDrop)(label, e.absoluteX, e.absoluteY);
      tx.value = withSpring(0);
      ty.value = withSpring(0);
    });
  const st = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: 1 + lift.value * 0.06 }],
    zIndex: lift.value ? 20 : 1,
    shadowOpacity: lift.value * 0.25,
  }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.lineStrong, borderBottomWidth: 3, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, shadowColor: '#000', shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
          st,
        ]}>
        <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.ink }}>{label}</Text>
      </Animated.View>
    </GestureDetector>
  );
}
