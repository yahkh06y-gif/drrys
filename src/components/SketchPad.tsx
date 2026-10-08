// A small drawing pad: finger or pencil strokes, three colours, undo, clear. `capture()` returns the
// drawing as a base64 PNG so Coco can look at it (working on a problem, or a picture for a memory hook).
import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

import { tap } from '@/lib/feedback';
import { C } from '@/theme';

export type SketchHandle = {
  /** the drawing as a base64 PNG (no prefix), or undefined if nothing is drawn / it can't be captured */
  capture: () => Promise<string | undefined>;
  clear: () => void;
};

type Stroke = { d: string; color: string };
const COLORS = ['#2B1B10', '#0E5E53', '#E56B6B'];

export const SketchPad = forwardRef<SketchHandle, { height?: number; onInk?: (has: boolean) => void; onDrawing?: (active: boolean) => void }>(function SketchPad({ height = 240, onInk, onDrawing }, ref) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(COLORS[0]);
  const live = useRef<string>('');
  const [liveD, setLiveD] = useState('');
  const view = useRef<View>(null);

  const begin = (x: number, y: number) => {
    onDrawing?.(true); // the page behind must not scroll while the finger draws
    live.current = `M${x.toFixed(1)} ${y.toFixed(1)} L${(x + 0.1).toFixed(1)} ${y.toFixed(1)}`;
    setLiveD(live.current);
  };
  const move = (x: number, y: number) => {
    live.current += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    setLiveD(live.current);
  };
  const end = () => {
    onDrawing?.(false);
    if (!live.current) return;
    const s = { d: live.current, color };
    live.current = '';
    setLiveD('');
    setStrokes((a) => {
      const next = [...a, s];
      onInk?.(true);
      return next;
    });
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => runOnJS(begin)(e.x, e.y))
    .onUpdate((e) => runOnJS(move)(e.x, e.y))
    .onFinalize(() => runOnJS(end)());

  useImperativeHandle(ref, () => ({
    clear: () => {
      setStrokes([]);
      onInk?.(false);
    },
    capture: async () => {
      if (!strokes.length) return undefined;
      try {
        return await captureRef(view, { format: 'png', result: 'base64', quality: 0.8, width: 480 });
      } catch {
        return undefined;
      }
    },
  }));

  return (
    <View style={{ gap: 8 }}>
      <GestureDetector gesture={pan}>
        <View ref={view} collapsable={false} style={{ height, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1.5, borderColor: C.lineStrong, overflow: 'hidden' }}>
          <Svg width="100%" height="100%">
            {strokes.map((s, i) => (
              <Path key={i} d={s.d} stroke={s.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            ))}
            {!!liveD && <Path d={liveD} stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
          </Svg>
        </View>
      </GestureDetector>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {COLORS.map((c) => (
          <Pressable key={c} onPress={() => (tap('select'), setColor(c))} hitSlop={6} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c, borderWidth: color === c ? 3 : 0, borderColor: C.amber }} />
        ))}
        <View style={{ flex: 1 }} />
        <Pressable
          hitSlop={8}
          onPress={() => {
            tap('select');
            setStrokes((a) => {
              const next = a.slice(0, -1);
              onInk?.(next.length > 0);
              return next;
            });
          }}
          style={{ padding: 6 }}>
          <Ionicons name="arrow-undo" size={22} color={C.body} />
        </Pressable>
        <Pressable
          hitSlop={8}
          onPress={() => {
            tap('select');
            setStrokes([]);
            onInk?.(false);
          }}
          style={{ padding: 6 }}>
          <Ionicons name="trash-outline" size={22} color={C.body} />
        </Pressable>
      </View>
    </View>
  );
});
