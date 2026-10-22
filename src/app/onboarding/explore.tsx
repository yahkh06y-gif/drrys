// "Coco is exploring your world" — Qloo finds what fans of each pick also love, and the student watches
// the map grow (labor illusion: seeing the work makes the result feel earned). Then Coco shows what he
// found, "Because you love X → …", and anything that isn't you can be removed.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';

import { COCO } from '@/art';
import { Btn, Coco, Enter, OnbBar } from '@/components/ui';
import { haptic, play, tap } from '@/lib/feedback';
import { progressOf } from '@/lib/onboarding';
import { exploreWorld, TYPE_EMOJI, TYPE_LABEL } from '@/lib/qloo';
import { useApp, type WorldItem } from '@/store';
import { C, F } from '@/theme';

const MIN_MS = 4000; // even if Qloo answers sooner: the student should see the exploring
const LINES = (picks: WorldItem[]) => [
  `Looking at what ${picks[0]?.name ?? 'your'} fans love…`,
  'Finding stories that match your taste…',
  'Reading what your world is about…',
  picks[1] ? `Following the trail from ${picks[1].name}…` : 'Connecting the dots…',
];

type Group = { from: string; items: WorldItem[] };

export default function Explore() {
  const { width } = useWindowDimensions();
  const picks = useApp((s) => s.world.picks);
  const set = useApp((s) => s.set);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<'exploring' | 'found'>('exploring');
  const [lineI, setLineI] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const lines = useMemo(() => LINES(picks), [picks]);

  useEffect(() => {
    let live = true;
    exploreWorld(picks)
      .then((r) => {
        if (!live) return;
        setGroups(r.groups);
        setTags(r.tags);
      })
      .catch(() => live && (setGroups([]), setFailed(true)));
    const rot = setInterval(() => setLineI((i) => (i + 1) % 4), 1400);
    return () => ((live = false), clearInterval(rot));
  }, [picks]);

  // the new posters pop onto the map one by one
  const flat = useMemo(() => (groups ?? []).flatMap((g) => g.items.map((it) => ({ from: g.from, it }))), [groups]);
  useEffect(() => {
    if (!groups) return;
    const t = setInterval(() => setRevealed((n) => (n < flat.length ? (haptic('light'), n + 1) : n)), 320);
    // switch to the list once the map is full and the minimum time has passed
    const done = setTimeout(() => {
      setPhase('found');
      play('celebrate');
    }, Math.max(MIN_MS, flat.length * 320 + 900));
    return () => (clearInterval(t), clearTimeout(done));
  }, [groups, flat.length]);

  const total = (groups ?? []).reduce((n, g) => n + g.items.length, 0);

  const remove = (from: string, id?: string) => {
    tap('select');
    setGroups((gs) => (gs ?? []).map((g) => (g.from === from ? { ...g, items: g.items.filter((x) => x.id !== id) } : g)).filter((g) => g.items.length));
  };

  const next = () => {
    set({ world: { picks, because: groups ?? [], tags } });
    router.push('/onboarding/first');
  };

  const size = width - 40;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.tealBg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        <OnbBar value={progressOf('explore')} />
      </View>
      {phase === 'exploring' ? (
        <View style={{ flex: 1, padding: 20, alignItems: 'center' }}>
          <Text style={{ fontFamily: F.bold, fontSize: 28, lineHeight: 32, color: C.white, alignSelf: 'flex-start' }}>Coco is exploring your world</Text>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Constellation size={size} picks={picks} shown={flat.slice(0, revealed)} />
          </View>
          <Enter key={lineI}>
            <Text style={{ fontFamily: F.medium, fontSize: 15, color: C.white, textAlign: 'center', opacity: 0.9 }}>{lines[lineI]}</Text>
          </Enter>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
            <Enter>
              <Text style={{ fontFamily: F.bold, fontSize: 28, lineHeight: 32, color: C.white }}>
                {failed || !total ? 'I know enough to start!' : `I found ${total} things you’d probably love.`}
              </Text>
              {!failed && !!total && <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.white, opacity: 0.85, marginTop: 6 }}>Not you? Tap ✕ and I’ll forget it.</Text>}
            </Enter>
            {(groups ?? []).map((g, k) => {
              const src = picks.find((p) => p.id === g.from);
              return (
                <Enter key={g.from} delay={k * 120}>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: 14, gap: 10 }}>
                    <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.white }}>Because you love {src?.name ?? 'this'}</Text>
                    {g.items.map((it) => (
                      <View key={it.id ?? it.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Thumb item={it} size={40} />
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 14, color: C.white }}>
                            {it.name}
                          </Text>
                          <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.white, opacity: 0.7 }}>{TYPE_LABEL[it.type]}</Text>
                        </View>
                        <Pressable hitSlop={10} onPress={() => remove(g.from, it.id)} accessibilityLabel={`Remove ${it.name}`}>
                          <Ionicons name="close" size={18} color={C.white} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </Enter>
              );
            })}
            {!total && <Coco src={COCO.reading} size={170} />}
          </ScrollView>
          <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
            <Btn title="That’s me!" kind="leaf" mono sfx="select" onPress={next} />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function Thumb({ item, size }: { item: WorldItem; size: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: C.sand, borderWidth: 2, borderColor: C.white, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.45 }}>{TYPE_EMOJI[item.type]}</Text>
    </View>
  );
}

// Coco in the middle, the picks on a ring around him, and what Qloo found further out, each joined to
// the pick it came from by a dotted line, like a star map.
function Constellation({ size, picks, shown }: { size: number; picks: WorldItem[]; shown: { from: string; it: WorldItem }[] }) {
  const c = size / 2;
  const r1 = size * 0.27;
  const r2 = size * 0.44;
  const angleOf = (i: number) => (2 * Math.PI * i) / Math.max(1, picks.length) - Math.PI / 2;
  const at = (a: number, r: number) => ({ x: c + r * Math.cos(a), y: c + r * Math.sin(a) });
  const perPick = new Map<string, number>();
  const outer = shown.map(({ from, it }) => {
    const i = Math.max(0, picks.findIndex((p) => p.id === from));
    const j = perPick.get(from) ?? 0;
    perPick.set(from, j + 1);
    const spread = Math.min(0.5, Math.PI / Math.max(2, picks.length));
    return { it, p: at(angleOf(i) + (j - 1) * spread, r2), src: at(angleOf(i), r1) };
  });
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {outer.map((o, k) => (
          <Line key={k} x1={o.src.x} y1={o.src.y} x2={o.p.x} y2={o.p.y} stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} strokeDasharray="3 5" />
        ))}
      </Svg>
      <View style={{ position: 'absolute', left: c - 50, top: c - 62 }}>
        <Coco src={COCO.reading} size={100} />
      </View>
      {picks.map((p, i) => {
        const q = at(angleOf(i), r1);
        return (
          <View key={p.id ?? p.name} style={{ position: 'absolute', left: q.x - 40, top: q.y - 27, width: 80, alignItems: 'center' }}>
            <Thumb item={p} size={54} />
            <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 10, color: C.white, marginTop: 2 }}>
              {p.name}
            </Text>
          </View>
        );
      })}
      {outer.map((o) => (
        <Enter key={o.it.id ?? o.it.name} style={{ position: 'absolute', left: o.p.x - 20, top: o.p.y - 20 }}>
          <Thumb item={o.it} size={40} />
        </Enter>
      ))}
    </View>
  );
}
