// Drag each item into the group it belongs to. Dropped items can be tapped to send them back.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptic, tap } from '@/lib/feedback';
import { C, F } from '@/theme';

type Bucket = { name: string; items: string[] };

export function SortQ({
  buckets,
  locked,
  marks,
  onChange,
}: {
  buckets: Bucket[];
  locked: boolean;
  marks?: Record<string, boolean>;
  onChange: (assigned: Record<string, string>, complete: boolean) => void;
}) {
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
    onChange(
      assigned,
      items.every((x) => assigned[x]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assigned]);

  const [picked, setPicked] = useState<string>(); // tap a word, then tap a group: works when the group is far down the screen
  const [lifted, setLifted] = useState<string>(); // the word being dragged (its box is drawn above the others)
  const bank = useRef<View | null>(null);

  const place = (item: string, group: string) => {
    haptic('light');
    setPicked(undefined);
    setAssigned((a) => ({ ...a, [item]: group }));
  };
  const measure = (v: View | null | undefined) =>
    new Promise<{ x: number; y: number; w: number; h: number } | undefined>((res) => (v ? v.measureInWindow((x, y, w, h) => res({ x, y, w, h })) : res(undefined)));
  const PAD = 12; // a little forgiveness around each box
  const hit = (r: { x: number; y: number; w: number; h: number } | undefined, x: number, y: number) => !!r && x >= r.x - PAD && x <= r.x + r.w + PAD && y >= r.y - PAD && y <= r.y + r.h + PAD;

  // which group is under the finger? measured when the drop happens, so scrolling never throws it off
  const drop = async (item: string, x: number, y: number) => {
    setLifted(undefined);
    const boxes = await Promise.all(buckets.map((b, i) => measure(refs.current[i])));
    const best = boxes.findIndex((r) => hit(r, x, y));
    if (best >= 0) return place(item, buckets[best].name);
    // dropped back on the word bank: the word goes back to the others
    if (assigned[item] && hit(await measure(bank.current), x, y)) {
      haptic('light');
      setAssigned((a) => ({ ...a, [item]: '' }));
    }
  };

  const loose = items.filter((x) => !assigned[x]);
  return (
    <View style={{ gap: 12 }}>
      {!locked && <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>Drag each word into its group, or tap a word and then tap its group.</Text>}
      <View
        ref={bank}
        style={{
          zIndex: lifted && !assigned[lifted] ? 30 : 5,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          minHeight: 44,
        }}
      >
        {loose.map((x) => (
          <Chip key={x} label={x} locked={locked} selected={picked === x} onLift={setLifted} onDrop={drop} onTap={() => (tap('select'), setPicked((p) => (p === x ? undefined : x)))} />
        ))}
        {!loose.length && !locked && <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.leaf }}>All sorted ✓</Text>}
      </View>
      <View style={{ gap: 10 }}>
        {buckets.map((b, i) => (
          <Pressable
            key={b.name}
            disabled={locked || !picked}
            onPress={() => picked && place(picked, b.name)}
            ref={(r) => {
              refs.current[i] = r;
            }}
            style={{
              zIndex: lifted && assigned[lifted] === b.name ? 30 : 1,
              backgroundColor: picked ? '#EEF6E4' : '#F6F3EB',
              borderRadius: 16,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: picked ? C.leaf : C.lineStrong,
              padding: 12,
              gap: 8,
              minHeight: 84,
            }}
          >
            <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.teal }}>{b.name}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {items
                .filter((x) => assigned[x] === b.name)
                .map((x) => {
                  const m = locked ? marks?.[x] : undefined;
                  return <Chip key={x} label={x} locked={locked} small mark={m} onLift={setLifted} onDrop={drop} onTap={() => (tap('select'), setAssigned((a) => ({ ...a, [x]: '' })))} />;
                })}
              {!items.some((x) => assigned[x] === b.name) && <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>{picked ? 'Tap to put it here' : 'Drop here'}</Text>}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Chip({
  label,
  locked,
  selected,
  small,
  mark,
  onLift,
  onDrop,
  onTap,
}: {
  label: string;
  locked: boolean;
  selected?: boolean;
  small?: boolean;
  mark?: boolean;
  onLift: (item?: string) => void;
  onDrop: (item: string, x: number, y: number) => void;
  onTap: () => void;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const lift = useSharedValue(0);
  const pan = Gesture.Pan()
    .enabled(!locked)
    .minDistance(6)
    .onStart(() => {
      lift.value = 1;
      runOnJS(onLift)(label);
    })
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onFinalize((e, ok) => {
      lift.value = 0;
      if (ok) runOnJS(onDrop)(label, e.absoluteX, e.absoluteY);
      else runOnJS(onLift)(undefined);
      tx.value = withSpring(0);
      ty.value = withSpring(0);
    });
  const press = Gesture.Tap()
    .enabled(!locked)
    .maxDuration(400)
    .onEnd((_e, ok) => {
      if (ok) runOnJS(onTap)();
    });
  const st = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: 1 + lift.value * 0.06 }],
    zIndex: lift.value ? 20 : 1,
    shadowOpacity: lift.value * 0.25,
  }));
  const done = mark !== undefined;
  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, press)}>
      <Animated.View
        style={[
          {
            backgroundColor: done ? (mark ? '#F0F8E6' : '#FFF1EC') : selected ? '#E3F1D6' : C.white,
            borderWidth: 1.5,
            borderColor: done ? (mark ? C.mintBorder : '#F2A58A') : selected ? C.leaf : C.lineStrong,
            borderBottomWidth: small ? 1.5 : 3,
            borderRadius: small ? 12 : 14,
            paddingHorizontal: small ? 10 : 12,
            paddingVertical: small ? 6 : 9,
            shadowColor: '#000',
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
          },
          st,
        ]}
      >
        <Text
          style={{
            fontFamily: F.bold,
            fontSize: small ? 13 : 14,
            color: C.ink,
          }}
        >
          {done ? (mark ? '✓ ' : '✗ ') : ''}
          {label}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}
