// The Knowledge Tree: Blender layers stacked on one fixed-camera canvas.
// sky-ground → drifting clouds → trunk → branch-1..5 (one per chapter, grown by mastery) → chapter labels.
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { BRANCH_ANCHORS, TREE, TREE_ASPECT } from '@/art';
import type { Chapter } from '@/store';
import { C, F } from '@/theme';

const layer = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' } as const;

export function KnowledgeTree({
  width,
  chapters,
  selected,
  onSelect,
  children,
}: {
  width: number;
  chapters: Chapter[];
  selected?: string;
  onSelect: (id: string) => void;
  children?: React.ReactNode;
}) {
  const height = width / TREE_ASPECT;
  const sway = useSharedValue(0);
  const cloud = useSharedValue(0);
  useEffect(() => {
    sway.value = withRepeat(withSequence(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), withTiming(-1, { duration: 3200, easing: Easing.inOut(Easing.sin) })), -1, true);
    cloud.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [sway, cloud]);

  const treeA = useAnimatedStyle(() => ({ transform: [{ rotate: `${sway.value * 0.6}deg` }], transformOrigin: '50% 72%' }));
  const c1 = useAnimatedStyle(() => ({ transform: [{ translateX: -40 + cloud.value * 60 }] }));
  const c2 = useAnimatedStyle(() => ({ transform: [{ translateX: 30 - cloud.value * 50 }] }));
  const c3 = useAnimatedStyle(() => ({ transform: [{ translateX: -20 + cloud.value * 35 }] }));

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <Image source={TREE.sky} style={layer} contentFit="cover" />
      <Animated.View style={[{ position: 'absolute', top: height * 0.04, right: -10 }, c1]}>
        <Image source={TREE.clouds[1]} style={{ width: width * 0.45, height: width * 0.2 }} contentFit="contain" />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', top: height * 0.12, left: -6 }, c2]}>
        <Image source={TREE.clouds[0]} style={{ width: width * 0.34, height: width * 0.23 }} contentFit="contain" />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', top: height * 0.2, right: -8 }, c3]}>
        <Image source={TREE.clouds[2]} style={{ width: width * 0.25, height: width * 0.18 }} contentFit="contain" />
      </Animated.View>

      <Animated.View style={[layer, treeA]}>
        <Image source={TREE.trunk} style={layer} contentFit="cover" />
        {TREE.branches.map((src, i) => (
          <Branch key={i} src={src} index={i} chapter={chapters[i]} />
        ))}
      </Animated.View>

      {chapters.slice(0, 5).map((ch, i) => {
        const a = BRANCH_ANCHORS[i];
        const on = ch.id === selected;
        return (
          <Pressable
            key={ch.id}
            onPress={() => onSelect(ch.id)}
            hitSlop={14}
            style={{
              position: 'absolute',
              ...(a.side === 'top'
                ? { left: a.x * width, top: a.top * height - 30, transform: [{ translateX: '-50%' }] }
                : a.side === 'left'
                  ? { right: width - a.l * width + 2, top: a.cy * height - 13 }
                  : { left: a.r * width + 2, top: a.cy * height - 13 }),
              zIndex: on ? 2 : 1,
              backgroundColor: on ? C.teal : '#FDFCF7',
              borderWidth: 2,
              borderColor: on ? C.teal : C.barkSoft,
              borderBottomWidth: 4,
              borderRadius: 16,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}>
            <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 12, color: on ? C.white : C.ink }}>
              Ch {i + 1}
              {ch.mastery >= 1 ? ' ✓' : ''}
            </Text>
          </Pressable>
        );
      })}
      {children}
    </View>
  );
}

function Branch({ src, index, chapter }: { src: number; index: number; chapter?: Chapter }) {
  const a = BRANCH_ANCHORS[index];
  // no chapter → bare arm; new chapter → small bud at the arm tip; mastery grows it to full size
  const target = chapter ? 0.35 + 0.65 * Math.min(1, chapter.mastery) : 0;
  const s = useSharedValue(0);
  const pulse = useSharedValue(1);
  useEffect(() => {
    s.value = withDelay(index * 120, withSpring(target, { damping: 9, stiffness: 80 }));
    if (chapter && chapter.mastery > 0) {
      pulse.value = withDelay(600 + index * 120, withSequence(withTiming(1.06, { duration: 180 }), withSpring(1)));
    }
  }, [target, index, s, pulse, chapter]);
  const st = useAnimatedStyle(() => ({
    opacity: s.value > 0.02 ? 1 : 0,
    transform: [{ scale: s.value * pulse.value }],
    transformOrigin: `${a.jx * 100}% ${a.jy * 100}%`,
  }));
  return (
    <Animated.View style={[layer, st]}>
      <Image source={src} style={layer} contentFit="cover" />
    </Animated.View>
  );
}
