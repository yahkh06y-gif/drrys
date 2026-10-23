// "Show Coco your world" — from wide to deep:
//   1. the areas the student is into (sports, movies, shows & anime, books, history), as big picture cards
//   2. for sports and history, which ones (football, basketball… / Islamic history, Ancient Egypt…)
//   3. three or more things inside them: big pictures with the name under them, from ready-made lists
//      (recognition over recall), with search for anything missing. Every pick teaches the list: three
//      related things (from Qloo) appear right after it. History is Drrys' own list: Qloo has no taste data for it.
// Pictures come straight from Qloo (the server drops anything adult first); no music or celebrities, and the
// only people are athletes: see supabase/functions/qloo.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { SafePicture } from '@/components/SafePicture';
import { Btn, Choice, Enter, OnbBar } from '@/components/ui';
import { useBack } from '@/lib/back';
import { tap } from '@/lib/feedback';
import { progressOf } from '@/lib/onboarding';
import { CATEGORIES, cocoComment, relatedTo, resolveStarters, searchWorld, shelvesFor, SUBS, TYPE_EMOJI, type CategoryKey, type Shelf } from '@/lib/qloo';
import { useApp, type WorldItem } from '@/store';
import { C, F } from '@/theme';

const MIN = 3;
const MAX = 8;
const GAP = 12;
const keyOf = (x: WorldItem) => x.id ?? `${x.type}:${x.name.toLowerCase()}`;
type Step = 'areas' | 'subs' | 'things';
type Pools = Record<string, WorldItem[]>;

const ALL = shelvesFor(
  CATEGORIES.map((c) => c.key),
  [],
);
const startPools = (): Pools => Object.fromEntries(ALL.map((s) => [s.key, s.starters.map((x) => ({ ...x }))]));
const toggleIn = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

export default function World() {
  const setProfile = useApp((s) => s.setProfile);
  const set = useApp((s) => s.set);
  const { width } = useWindowDimensions();
  const [step, setStep] = useState<Step>('areas');
  const [areas, setAreas] = useState<CategoryKey[]>([]);
  const [subs, setSubs] = useState<string[]>([]);
  const [tab, setTab] = useState(ALL[0].key);
  const [pools, setPools] = useState<Pools>(startPools);
  const [resolving, setResolving] = useState(false);
  const [picked, setPicked] = useState<WorldItem[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(new Set()); // things the list just learned
  const [line, setLine] = useState('First, what are you into? Pick as many as you like.');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WorldItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const resolved = useRef(new Set<string>()); // lists whose names Qloo has already turned into things
  const shelves = useMemo(() => shelvesFor(areas, subs), [areas, subs]);
  const shelf = shelves.find((s) => s.key === tab) ?? shelves[0] ?? ALL[0];
  const deeper = areas.filter((a) => SUBS[a]);
  const posterW = Math.floor((width - 40 - GAP * 2) / 3);

  const back = useCallback(() => {
    if (step === 'things') return setQuery(''), setStep(deeper.length ? 'subs' : 'areas'), true;
    if (step === 'subs') return setStep('areas'), true;
    return false;
  }, [step, deeper.length]);
  useBack(back);

  // the ready-made names become real Qloo things (ids, pictures and themes), once per list
  const toThings = () => {
    const now = shelvesFor(areas, subs);
    setTab(now[0].key);
    setStep('things');
    setLine('Now pick 3 or more things you love.');
    const todo = now.filter((s) => s.qloo && !resolved.current.has(s.key));
    if (!todo.length) return;
    todo.forEach((s) => resolved.current.add(s.key));
    const ask = todo.flatMap((s) => s.starters.map((x) => ({ ...x, shelf: s.key })));
    setResolving(true);
    resolveStarters(ask.map(({ name, type }) => ({ name, type })))
      .then((found) => {
        const hits = new Map<string, WorldItem>(); // "list/name" → the thing Qloo found
        const seen = new Set<string>();
        ask.forEach((a, i) => {
          const hit = found[i];
          // our spelling stays when Qloo found nothing, or something of another kind
          if (!hit || hit.type !== a.type || seen.has(keyOf(hit))) return;
          seen.add(keyOf(hit));
          hits.set(`${a.shelf}/${a.name}`, hit);
        });
        setPools((cur) => {
          const next = { ...cur };
          todo.forEach((s) => (next[s.key] = cur[s.key].map((x) => (!x.id && hits.get(`${s.key}/${x.name}`)) || x)));
          return next;
        });
        const byName = new Map([...hits.entries()].map(([k, v]) => [k.slice(k.indexOf('/') + 1), v]));
        setPicked((p) => p.map((x) => (x.id ? x : (byName.get(x.name) ?? x))));
      })
      .catch(() => {}) // Qloo unreachable: the lists still work, without pictures and "more like this"
      .finally(() => setResolving(false));
  };

  const fromAreas = () => {
    if (!deeper.length) return toThings();
    setStep('subs');
    setLine(deeper.length > 1 ? 'Nice! Now which ones?' : `Nice! Which ${CATEGORIES.find((c) => c.key === deeper[0])!.label.toLowerCase()}?`);
  };

  // search, a moment after typing stops (history searches its own list)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return setResults(null);
    if (!shelf.qloo) return setResults(pools[shelf.key].filter((x) => x.name.toLowerCase().includes(q.toLowerCase())));
    setSearching(true);
    const t = setTimeout(() => {
      searchWorld(q, shelf.type)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 450);
    return () => clearTimeout(t);
  }, [query, shelf, pools]);

  const isPicked = (x: WorldItem) => picked.some((p) => keyOf(p) === keyOf(x));

  const toggle = (x: WorldItem) => {
    tap('select');
    if (isPicked(x)) return setPicked((p) => p.filter((y) => keyOf(y) !== keyOf(x)));
    if (picked.length >= MAX) return setLine(`That’s plenty! ${MAX} is the most I need.`);
    setPicked((p) => [...p, x]);
    setLine(cocoComment(x, picked.length));
    const home = shelf.key;
    // a searched (or typed) pick joins its list
    if (results) {
      setPools((cur) => (cur[home].some((c) => keyOf(c) === keyOf(x)) ? cur : { ...cur, [home]: [x, ...cur[home]] }));
      setQuery('');
      scroller.current?.scrollTo({ y: 0, animated: true });
    }
    // the list learns: three related things right after this one
    if (x.id)
      relatedTo(x)
        .then((more) => {
          setPools((cur) => {
            const list = cur[home];
            const have = new Set(list.map(keyOf));
            const add = more.filter((m) => !have.has(keyOf(m)));
            if (!add.length) return cur;
            setFresh((f) => new Set([...f, ...add.map(keyOf)]));
            const i = list.findIndex((c) => keyOf(c) === keyOf(x));
            return { ...cur, [home]: i < 0 ? [...add, ...list] : [...list.slice(0, i + 1), ...add, ...list.slice(i + 1)] };
          });
        })
        .catch(() => {});
  };

  // something that isn't in any list: the student can still add it by name
  const typed = query.trim();
  const canAdd = !!results && typed.length >= 2 && !results.some((r) => r.name.toLowerCase() === typed.toLowerCase());

  const shown = useMemo(() => results ?? pools[shelf.key] ?? [], [results, pools, shelf]);
  const ready = picked.length >= MIN;

  const next = () => {
    set({ world: { picks: picked, because: [], tags: [] } });
    setProfile({ interests: picked.map((x) => x.name) });
    router.push(picked.some((x) => x.id) ? '/onboarding/explore' : '/onboarding/first');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 14 }}>
        <OnbBar value={progressOf('world')} onBack={() => back() || (router.canGoBack() && router.back())} />
        {/* Coco in the corner, reacting to every pick */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={COCO.classic} style={{ width: 48, height: 60 }} contentFit="contain" />
          <Enter key={line} style={{ flex: 1 }}>
            <View style={{ backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 9 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.teal }}>{line}</Text>
            </View>
          </Enter>
        </View>
        <Text style={{ fontFamily: F.bold, fontSize: 28, lineHeight: 32, color: C.title }}>Show Coco your world</Text>
      </View>

      {step === 'areas' ? (
        <ScrollView contentContainerStyle={{ padding: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {CATEGORIES.map((c, k) => (
            <Enter key={c.key} delay={k * 40} style={{ width: '47%' }}>
              <Choice label={c.icon !== undefined ? c.label : `${c.emoji} ${c.label}`} icon={c.icon} selected={areas.includes(c.key)} onPress={() => setAreas((a) => toggleIn(a, c.key))} />
            </Enter>
          ))}
        </ScrollView>
      ) : step === 'subs' ? (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
          {deeper.map((a) => (
            <View key={a} style={{ gap: 10 }}>
              {deeper.length > 1 && <Text style={{ fontFamily: F.bold, fontSize: 18, color: C.teal }}>{CATEGORIES.find((c) => c.key === a)!.label}</Text>}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                {SUBS[a]!.map((s, k) => (
                  <Enter key={s.key} delay={k * 40} style={{ width: '47%' }}>
                    <Choice label={s.icon !== undefined ? s.label : `${s.emoji} ${s.label}`} icon={s.icon} selected={subs.includes(s.key)} onPress={() => setSubs((x) => toggleIn(x, s.key))} />
                  </Enter>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <>
          <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 12, paddingHorizontal: 12 }}>
              <Ionicons name="search" size={16} color={C.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Can’t find it? Search…"
                placeholderTextColor="#A69A8A"
                returnKeyType="search"
                style={{ flex: 1, paddingVertical: 10, fontFamily: F.medium, fontSize: 14, color: C.ink }}
              />
              {searching || resolving ? (
                <ActivityIndicator size="small" color={C.teal} />
              ) : query ? (
                <Pressable hitSlop={8} onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={18} color={C.muted} />
                </Pressable>
              ) : null}
            </View>
            {shelves.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {shelves.map((s) => (
                  <ShelfTab key={s.key} shelf={s} on={shelf.key === s.key} onPress={() => (tap('select'), setQuery(''), setTab(s.key))} />
                ))}
              </ScrollView>
            )}
          </View>
          <ScrollView ref={scroller} contentContainerStyle={{ padding: 20, paddingTop: 14, flexDirection: 'row', flexWrap: 'wrap', columnGap: GAP, rowGap: 16 }} keyboardShouldPersistTaps="handled">
            {shown.map((x) => (
              <Poster key={keyOf(x)} item={x} width={posterW} selected={isPicked(x)} fresh={fresh.has(keyOf(x))} loading={resolving && shelf.qloo && !x.id} onPress={() => toggle(x)} />
            ))}
            {canAdd && (
              <Pressable
                onPress={() => toggle({ name: typed, type: shelf.type })}
                style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: C.title }}>
                <Ionicons name="add-circle-outline" size={18} color={C.title} />
                <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 14, color: C.title }}>Add “{typed}”</Text>
              </Pressable>
            )}
          </ScrollView>
        </>
      )}

      {/* the way on: areas, then which ones, then the tray with what's picked */}
      <View style={{ borderTopWidth: 1, borderColor: C.line, backgroundColor: C.paper, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, gap: 10 }}>
        {step === 'things' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flex: 1 }}>
              {picked.map((x) => (
                <SafePicture key={keyOf(x)} uri={x.image} emoji={TYPE_EMOJI[x.type]} emojiSize={16} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: C.green }} />
              ))}
            </ScrollView>
            <Text style={{ fontFamily: F.bold, fontSize: 15, color: ready ? C.green : C.muted }}>{picked.length} / 5</Text>
          </View>
        )}
        {step === 'areas' ? (
          <Btn title="continue" mono disabled={!areas.length} kind={areas.length ? 'green' : 'light'} onPress={fromAreas} />
        ) : step === 'subs' ? (
          <Btn title="continue" mono kind="green" onPress={toThings} />
        ) : (
          <Btn title="continue" mono disabled={!ready} kind={ready ? 'green' : 'light'} onPress={next} />
        )}
      </View>
    </SafeAreaView>
  );
}

function ShelfTab({ shelf, on, onPress }: { shelf: Shelf; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, backgroundColor: on ? C.teal : C.sand, borderWidth: 1, borderColor: on ? C.teal : C.line }}>
      <Text style={{ fontFamily: F.bold, fontSize: 13, color: on ? C.white : C.teal }}>
        {shelf.emoji} {shelf.label}
      </Text>
    </Pressable>
  );
}

/** A big picture with the name under it. */
function Poster({ item, width, selected, fresh, loading, onPress }: { item: WorldItem; width: number; selected: boolean; fresh: boolean; loading: boolean; onPress: () => void }) {
  const s = useSharedValue(fresh ? 0.6 : 1);
  useEffect(() => {
    if (fresh) s.value = withSpring(1, { damping: 12 });
  }, [fresh, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const press = () => {
    s.value = withSequence(withTiming(1.06, { duration: 110 }), withSpring(1, { damping: 10 }));
    onPress();
  };
  return (
    <Pressable onPress={press} style={{ width }} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={item.name}>
      <Animated.View style={a}>
        <View style={{ width, height: width * 1.5, borderRadius: 12, overflow: 'hidden', backgroundColor: C.sand, borderWidth: selected ? 3 : 1, borderColor: selected ? C.green : fresh ? C.amber : C.line, alignItems: 'center', justifyContent: 'center' }}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={{ position: 'absolute', inset: 0 }} contentFit="cover" transition={200} />
          ) : loading ? (
            <ActivityIndicator color={C.teal} />
          ) : (
            <Text style={{ fontSize: 30, opacity: 0.6 }}>{TYPE_EMOJI[item.type]}</Text>
          )}
          {selected && (
            <View style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={15} color={C.white} />
            </View>
          )}
        </View>
      </Animated.View>
      <Text numberOfLines={2} style={{ fontFamily: F.bold, fontSize: 13, lineHeight: 16, color: C.ink, marginTop: 6 }}>
        {item.name}
      </Text>
    </Pressable>
  );
}
