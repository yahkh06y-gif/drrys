// The Knowledge Tree: Blender layers stacked on one fixed-camera canvas.
// sky-ground → drifting clouds → the tree for this many chapters (stage-N: a trunk with N arms)
// → one canopy per arm, grown from its joint → chapter labels.
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { COCO_ON_TREE, COCO_TREE, TREE, type CocoClip, TREE_ASPECT, TREE_MAX_BRANCHES, TREE_STAGES, type BranchAnchor } from '@/art';
import type { Chapter } from '@/store';
import { haptic, play } from '@/lib/feedback';
import { C, F } from '@/theme';

const layer = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' } as const;

// Canopies the user has already seen, and each chapter's last mastery. A canopy you've seen before is
// drawn at full size straight away (no bare arms when you come back to the tree); only a newly added
// chapter grows, and a canopy only pulses when its mastery actually went up.
const shown = new Set<string>();
const lastMastery = new Map<string, number>();

export function KnowledgeTree({
  width,
  chapters,
  selected,
  onSelect,
  onHold,
  wilt = 0,
  coco,
  children,
}: {
  width: number;
  chapters: Chapter[];
  selected?: string;
  onSelect: (id: string) => void;
  /** press and hold a branch label (its memory hooks) */
  onHold?: (id: string) => void;
  /** 0–1: how long the student has been away. The leaves turn yellow as it grows, and green again once watered. */
  wilt?: number;
  /** set on the tree you're looking at: Coco lands there */
  coco?: CocoLanding;
  children?: React.ReactNode;
}) {
  const height = width / TREE_ASPECT;
  // The tree always has exactly as many arms as the subject has chapters (1–5; extra chapters share
  // the 5-arm tree). With no chapters yet the one-arm tree stands bare.
  const stage = Math.max(1, Math.min(TREE_MAX_BRANCHES, chapters.length)) as 1 | 2 | 3 | 4 | 5;
  const T = TREE_STAGES[stage];
  // First time this tree is on screen → show it complete. Later, only unseen chapters grow in.
  const growNew = chapters.some((c) => shown.has(c.id));
  useEffect(() => {
    chapters.forEach((c) => shown.add(c.id));
  }, [chapters]);
  // the yellow wash: fades in a moment after the tree appears (the student opens the app and sees it), fades out after watering
  const yellow = useSharedValue(0);
  const pressed = useSharedValue(-1); // which canopy is being pressed (it swells a little under the finger)
  const wiltPrev = useRef(0);
  useEffect(() => {
    const down = wilt < wiltPrev.current;
    wiltPrev.current = wilt;
    yellow.value = withDelay(down ? 2600 : 700, withTiming(wilt, { duration: 1800, easing: Easing.inOut(Easing.cubic) }));
  }, [wilt, yellow]);
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
      <Image pointerEvents="none" source={TREE.sky} style={layer} contentFit="cover" cachePolicy="memory-disk" />
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: height * 0.04, right: -10 }, c1]}>
        <Image pointerEvents="none" source={TREE.clouds[1]} style={{ width: width * 0.45, height: width * 0.2 }} contentFit="contain" />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: height * 0.12, left: -6 }, c2]}>
        <Image pointerEvents="none" source={TREE.clouds[0]} style={{ width: width * 0.34, height: width * 0.23 }} contentFit="contain" />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: height * 0.2, right: -8 }, c3]}>
        <Image pointerEvents="none" source={TREE.clouds[2]} style={{ width: width * 0.25, height: width * 0.18 }} contentFit="contain" />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[layer, treeA]}>
        <StageTree stage={stage}>
          <Image pointerEvents="none" source={T.tree} style={layer} contentFit="cover" cachePolicy="memory-disk" />
          {T.branches.map((src, i) => (
            <Branch key={i} index={i} pressed={pressed} src={src} anchor={T.anchors[i]} chapter={chapters[i]} yellow={yellow} grow={growNew && !!chapters[i] && !shown.has(chapters[i].id)} />
          ))}
        </StageTree>
      </Animated.View>

      {COCO_ON_TREE && coco && <CocoOnLawn width={width} height={height} landing={coco} />}

      {chapters.slice(0, TREE_MAX_BRANCHES).map((ch, i) => {
        const a = T.anchors[i];
        const on = ch.id === selected;
        return (
          <Pressable
            key={ch.id}
            onPress={() => onSelect(ch.id)}
            onPressIn={() => (pressed.value = i)}
            onPressOut={() => (pressed.value = -1)}
            onLongPress={onHold ? () => (haptic('medium'), onHold(ch.id)) : undefined}
            delayLongPress={350}
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

function Branch({ src, anchor: a, chapter, grow, yellow, index, pressed }: { index: number; pressed: SharedValue<number>; src: number; anchor: BranchAnchor; chapter?: Chapter; grow: boolean; yellow: SharedValue<number> }) {
  // Every planted chapter shows its canopy at the full Blender size. A new chapter's canopy grows
  // out of its arm; studying (mastery going up) makes it pulse.
  const s = useSharedValue(chapter && !grow ? 1 : 0);
  const pulse = useSharedValue(1);
  useEffect(() => {
    const target = chapter ? 1 : 0;
    if (s.value !== target) s.value = withDelay(200, withSpring(target, { damping: 14, stiffness: 110 }));
  }, [chapter, s]);
  const mastery = chapter?.mastery ?? 0;
  useEffect(() => {
    if (!chapter) return;
    const before = lastMastery.get(chapter.id);
    lastMastery.set(chapter.id, mastery);
    if (before !== undefined && mastery > before) {
      pulse.value = withDelay(500, withSequence(withTiming(1.06, { duration: 180 }), withSpring(1, { damping: 12 })));
    }
  }, [chapter, mastery, pulse]);
  const swell = useDerivedValue(() => withSpring(pressed.value === index ? 1 : 0, { damping: 12, stiffness: 160 }));
  const st = useAnimatedStyle(() => ({
    opacity: s.value > 0.02 ? 1 : 0,
    transform: [{ scale: s.value * pulse.value * (1 + swell.value * 0.07) }],
    transformOrigin: `${a.jx * 100}% ${a.jy * 100}%`,
  }));
  const wash = useAnimatedStyle(() => ({ opacity: yellow.value * 0.6 }));
  return (
    <Animated.View style={[layer, st]}>
      <Image pointerEvents="none" source={src} style={layer} contentFit="cover" cachePolicy="memory-disk" />
      {/* the same canopy, tinted: only the leaves turn yellow */}
      <Animated.View pointerEvents="none" style={[layer, wash]}>
        <Image pointerEvents="none" source={src} style={layer} contentFit="cover" cachePolicy="memory-disk" tintColor="#E4C13C" />
      </Animated.View>
    </Animated.View>
  );
}

// The tree for the current chapter count. The images swap in place (expo-image keeps the old picture
// until the new one is ready, so there is no blank frame); when a chapter is added the tree gives a
// small, soft pop.
function StageTree({ stage, children }: { stage: number; children: React.ReactNode }) {
  const s = useSharedValue(1);
  const prev = useRef(stage);
  useEffect(() => {
    if (prev.current === stage) return;
    prev.current = stage;
    s.value = withSequence(withTiming(0.97, { duration: 140 }), withSpring(1, { damping: 12, stiffness: 120 }));
  }, [stage, s]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], transformOrigin: '50% 72%' }));
  return <Animated.View style={[layer, st]}>{children}</Animated.View>;
}

// Coco on the lawn. He is only on the tree you're looking at: each time you arrive (`landing.n` changes) he
// drops in from above and lands (a harder fall if you were flipping fast), then idles, picking a new
// random idle clip every 10 s (weighted toward the calm ones).
export type CocoLanding = { n: number; hard: boolean; water?: boolean };

const arrivalClip = (l: CocoLanding) => (l.water ? COCO_TREE.water : l.hard ? COCO_TREE.fallHard : COCO_TREE.fall);

function pickIdle(prev?: number) {
  const clips = COCO_TREE.idle;
  const total = clips.reduce((t, c) => t + (c.weight ?? 1), 0);
  let r = Math.random() * total;
  for (let i = 0; i < clips.length; i++) {
    r -= clips[i].weight ?? 1;
    if (r <= 0) return i;
  }
  return prev ?? 0;
}

function CocoOnLawn({ width, height, landing }: { width: number; height: number; landing: CocoLanding }) {
  // `turn` changes on every clip, so the timer keeps running even when the same clip is picked twice
  const [st, setSt] = useState<{ clip: CocoClip; idle: number; turn: number }>(() => ({
    clip: arrivalClip(landing),
    idle: -1,
    turn: 0,
  }));
  // a clip's timer (and the watering sound) only start once its image is actually on screen —
  // a big animated WebP can take a moment to decode the first time on Android
  const [shownTurn, setShownTurn] = useState(-1);
  const drop = useSharedValue(-height * 0.2);

  // arrive → fall (or water, after a full session)
  useEffect(() => {
    setSt((s) => ({ clip: arrivalClip(landing), idle: -1, turn: s.turn + 1 }));
    if (landing.water) drop.value = 0;
    else {
      drop.value = -height * 0.2;
      drop.value = withTiming(0, { duration: landing.hard ? 170 : 230, easing: Easing.in(Easing.quad) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landing.n]);

  // refs, not state: the image's load event and the safety timer can both fire before a re-render,
  // and a stale state check let the watering sound play twice
  const shownRef = useRef(-1);
  const wateredFor = useRef(-1);
  const onShown = () => {
    if (shownRef.current === st.turn) return;
    shownRef.current = st.turn;
    setShownTurn(st.turn);
    if (st.clip === COCO_TREE.water && wateredFor.current !== landing.n) {
      wateredFor.current = landing.n; // once per watering, whatever happens
      play('water');
    }
  };

  // safety net: if the image never reports it loaded, carry on anyway
  useEffect(() => {
    // (also covers the same clip being picked twice in a row: no new load event then)
    const t = setTimeout(onShown, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.turn]);

  // after each clip → next idle clip
  useEffect(() => {
    if (shownTurn !== st.turn) return;
    const t = setTimeout(() => {
      setSt((s) => {
        const i = pickIdle(s.idle);
        return { clip: COCO_TREE.idle[i], idle: i, turn: s.turn + 1 };
      });
    }, st.clip.ms);
    return () => clearTimeout(t);
  }, [shownTurn, st.turn, st.clip.ms]);

  const dropA = useAnimatedStyle(() => ({ transform: [{ translateY: drop.value }] }));
  const [x, y, w, h] = st.clip.box;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width, height }, dropA]}>
      <Image
        pointerEvents="none"
        source={st.clip.src}
        autoplay
        cachePolicy="memory-disk"
        onLoad={onShown}
        style={{ position: 'absolute', left: (x / 1080) * width, top: (y / 1920) * height, width: (w / 1080) * width, height: (h / 1920) * height }}
        contentFit="fill"
      />
      {/* keep the special clips decoded in memory so they appear instantly when needed */}
      {[COCO_TREE.water, COCO_TREE.fall, COCO_TREE.fallHard].map((c, k) => (
        <Image key={`warm${k}`} source={c.src} autoplay={false} cachePolicy="memory-disk" style={{ position: 'absolute', width: 2, height: 2, opacity: 0.01, left: 0, top: 0 }} />
      ))}
    </Animated.View>
  );
}
