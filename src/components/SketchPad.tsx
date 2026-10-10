// A drawing pad: finger or pencil strokes, many colours, an eraser, undo, clear. `capture()` returns the
// drawing as a base64 PNG so Coco can look at it (working on a problem, or a sketch for a memory hook).
// `onColors` tells the page which colours are on the board (in the order they were first used), so the page can
// ask what each colour means: that list lives OUTSIDE the board, never on top of the drawing.
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
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

/** The colours of the board. `name` is what the picture maker is told ("red = a fat man"). */
export const PALETTE = [
  { hex: '#212121', name: 'black' },
  { hex: '#E53935', name: 'red' },
  { hex: '#FB8C00', name: 'orange' },
  { hex: '#FDD835', name: 'yellow' },
  { hex: '#43A047', name: 'green' },
  { hex: '#1E88E5', name: 'blue' },
  { hex: '#8E24AA', name: 'purple' },
  { hex: '#EC407A', name: 'pink' },
  { hex: '#6D4C41', name: 'brown' },
  { hex: '#9E9E9E', name: 'grey' },
];
export const colorName = (hex: string) => PALETTE.find((p) => p.hex === hex)?.name ?? 'dark';

type Stroke = { pts: number[][]; color: string };
const pathOf = (pts: number[][]) => (pts.length === 1 ? `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} L${(pts[0][0] + 0.1).toFixed(1)} ${pts[0][1].toFixed(1)}` : pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '));
const ERASE_R = 16; // how close the eraser must get to a line to take it away

export const SketchPad = forwardRef<SketchHandle, { height?: number; onInk?: (has: boolean) => void; onDrawing?: (active: boolean) => void; onColors?: (used: string[]) => void }>(function SketchPad({ height = 240, onInk, onDrawing, onColors }, ref) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(PALETTE[0].hex);
  const [erasing, setErasing] = useState(false);
  const live = useRef<number[][]>([]);
  const [liveD, setLiveD] = useState('');
  const view = useRef<View>(null);
  const mode = useRef({ color, erasing });
  mode.current = { color, erasing };

  const eraseAt = (x: number, y: number) =>
    setStrokes((a) => {
      const keep = a.filter((s) => !s.pts.some((p) => Math.hypot(p[0] - x, p[1] - y) < ERASE_R));
      return keep.length === a.length ? a : keep;
    });
  const begin = (x: number, y: number) => {
    onDrawing?.(true); // the page behind must not scroll while the finger draws
    if (mode.current.erasing) return eraseAt(x, y);
    live.current = [[x, y]];
    setLiveD(pathOf(live.current));
  };
  const move = (x: number, y: number) => {
    if (mode.current.erasing) return eraseAt(x, y);
    live.current.push([x, y]);
    setLiveD(pathOf(live.current));
  };
  const end = () => {
    onDrawing?.(false);
    if (!live.current.length) return;
    const s = { pts: live.current, color: mode.current.color };
    live.current = [];
    setLiveD('');
    setStrokes((a) => [...a, s]);
  };
  // tell the page whether anything is drawn and which colours are on the board (never inside a state updater:
  // that would update the parent while rendering)
  const used = strokes.reduce<string[]>((u, s) => (u.includes(s.color) ? u : [...u, s.color]), []);
  const usedKey = used.join(',');
  useEffect(() => {
    onInk?.(strokes.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes.length]);
  useEffect(() => {
    onColors?.(used);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usedKey]);

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => runOnJS(begin)(e.x, e.y))
    .onUpdate((e) => runOnJS(move)(e.x, e.y))
    .onFinalize(() => runOnJS(end)());

  useImperativeHandle(ref, () => ({
    clear: () => setStrokes([]),
    capture: async () => {
      if (!strokes.length) return undefined;
      try {
        return await captureRef(view, { format: 'png', result: 'base64', quality: 0.8, width: 800 });
      } catch {
        return undefined;
      }
    },
  }));

  const tool = (active: boolean) => ({ padding: 6, borderRadius: 10, backgroundColor: active ? C.sand : 'transparent', borderWidth: active ? 1.5 : 0, borderColor: C.amber });
  return (
    <View style={{ gap: 8 }}>
      <GestureDetector gesture={pan}>
        <View ref={view} collapsable={false} style={{ height, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1.5, borderColor: erasing ? C.amber : C.lineStrong, overflow: 'hidden' }}>
          <Svg width="100%" height="100%">
            {strokes.map((s, i) => (
              <Path key={i} d={pathOf(s.pts)} stroke={s.color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            ))}
            {!!liveD && <Path d={liveD} stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
          </Svg>
        </View>
      </GestureDetector>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {PALETTE.map((p) => (
          <Pressable
            key={p.hex}
            onPress={() => (tap('select'), setColor(p.hex), setErasing(false))}
            hitSlop={4}
            style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: p.hex, borderWidth: !erasing && color === p.hex ? 3 : 1, borderColor: !erasing && color === p.hex ? C.amber : 'rgba(0,0,0,0.15)' }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Pressable hitSlop={8} onPress={() => (tap('select'), setErasing((v) => !v))} style={tool(erasing)} accessibilityLabel="Eraser">
          <MaterialCommunityIcons name="eraser" size={22} color={erasing ? C.goldInk : C.body} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={8} onPress={() => (tap('select'), setStrokes((a) => a.slice(0, -1)))} style={{ padding: 6 }} accessibilityLabel="Undo">
          <Ionicons name="arrow-undo" size={22} color={C.body} />
        </Pressable>
        <Pressable hitSlop={8} onPress={() => (tap('select'), setStrokes([]))} style={{ padding: 6 }} accessibilityLabel="Clear everything">
          <Ionicons name="trash-outline" size={22} color={C.body} />
        </Pressable>
      </View>
    </View>
  );
});
