// "Show Coco your world" — two quick steps:
//   1. the areas the student is into (sports, movies, shows & anime, books, Islamic history)
//   2. three or more things inside those areas, from ready-made lists (recognition over recall), with
//      search for anything missing. Every pick teaches the list: three related things (from Qloo) appear
//      right after it. Islamic history is Drrys' own list: Qloo has no taste data for it.
// Pictures come from Qloo and are shown only after the AI check (components/SafePicture); no music or
// celebrities: see supabase/functions/qloo.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { SafePicture } from '@/components/SafePicture';
import { Btn, Enter, OnbBar } from '@/components/ui';
import { useBack } from '@/lib/back';
import { tap } from '@/lib/feedback';
import { progressOf } from '@/lib/onboarding';
import { CATEGORIES, categoryOf, cocoComment, relatedTo, resolveStarters, searchWorld, STARTERS, TYPE_EMOJI, type CategoryKey } from '@/lib/qloo';
import { useApp, type WorldItem } from '@/store';
import { C, F } from '@/theme';

const MIN = 3;
const MAX = 8;
const keyOf = (x: WorldItem) => x.id ?? `${x.type}:${x.name.toLowerCase()}`;
type Pools = Record<CategoryKey, WorldItem[]>;

const startPools = (): Pools =>
  Object.fromEntries(CATEGORIES.map((c) => [c.key, STARTERS[c.key].map((name) => ({ name, type: c.type }))])) as Pools;

export default function World() {
  const setProfile = useApp((s) => s.setProfile);
  const set = useApp((s) => s.set);
  const [step, setStep] = useState<'areas' | 'things'>('areas');
  const [areas, setAreas] = useState<CategoryKey[]>([]);
  const [tab, setTab] = useState<CategoryKey>('sports');
  const [pools, setPools] = useState<Pools>(startPools);
  const [resolving, setResolving] = useState(false);
  const [picked, setPicked] = useState<WorldItem[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(new Set()); // things the list just learned
  const [line, setLine] = useState('First, what are you into? Pick as many as you like.');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WorldItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const resolved = useRef(false);
  const cat = CATEGORIES.find((c) => c.key === tab)!;

  const back = useCallback(() => {
    if (step === 'things') return setStep('areas'), true;
    return false;
  }, [step]);
  useBack(back);

  const toThings = () => {
    setTab(areas[0]);
    setStep('things');
    setLine('Now pick 3 or more things you love.');
    // the ready-made names become real Qloo things (ids and themes), once
    if (resolved.current) return;
    resolved.current = true;
    const ask = CATEGORIES.filter((c) => c.qloo).flatMap((c) => STARTERS[c.key].map((name) => ({ name, type: c.type, key: c.key })));
    setResolving(true);
    resolveStarters(ask.map(({ name, type }) => ({ name, type })))
      .then((found) => {
        const next = startPools();
        const seen = new Set<string>();
        ask.forEach((a, i) => {
          const hit = found[i];
          if (!hit) return;
          const k = keyOf(hit);
          if (seen.has(k)) return;
          seen.add(k);
          const list = next[a.key];
          const j = list.findIndex((x) => x.name === a.name);
          // the list keeps our spelling only when Qloo found something of a different kind
          if (j >= 0 && hit.type === a.type) list[j] = hit;
        });
        setPools((cur) => {
          // keep anything the student already added (searched or related)
          const merged = { ...next };
          (Object.keys(cur) as CategoryKey[]).forEach((k) => {
            const extra = cur[k].filter((x) => !STARTERS[k].includes(x.name) && !merged[k].some((m) => keyOf(m) === keyOf(x)));
            merged[k] = [...extra, ...merged[k]];
          });
          return merged;
        });
        setPicked((p) => p.map((x) => (x.id ? x : (next[categoryOf(x.type)?.key ?? 'sports']?.find((n) => n.name === x.name) ?? x))));
      })
      .catch(() => {}) // Qloo unreachable: the lists still work, without "more like this"
      .finally(() => setResolving(false));
  };

  // search, a moment after typing stops (Islamic history searches its own list)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return setResults(null);
    if (!cat.qloo) return setResults(pools[cat.key].filter((x) => x.name.toLowerCase().includes(q.toLowerCase())));
    setSearching(true);
    const t = setTimeout(() => {
      searchWorld(q, cat.type)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 450);
    return () => clearTimeout(t);
  }, [query, cat, pools]);

  const isPicked = (x: WorldItem) => picked.some((p) => keyOf(p) === keyOf(x));

  const toggle = (x: WorldItem) => {
    tap('select');
    if (isPicked(x)) return setPicked((p) => p.filter((y) => keyOf(y) !== keyOf(x)));
    if (picked.length >= MAX) return setLine(`That’s plenty! ${MAX} is the most I need.`);
    setPicked((p) => [...p, x]);
    setLine(cocoComment(x, picked.length));
    const home = categoryOf(x.type)?.key ?? tab;
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

  const shown = useMemo(() => results ?? pools[tab], [results, pools, tab]);
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
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
          {CATEGORIES.map((c, k) => {
            const on = areas.includes(c.key);
            return (
              <Enter key={c.key} delay={k * 50}>
                <Pressable
                  onPress={() => (tap('select'), setAreas((a) => (on ? a.filter((x) => x !== c.key) : [...a, c.key])))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, borderWidth: 2, borderBottomWidth: on ? 5 : 2, borderColor: on ? C.green : C.brown, backgroundColor: on ? C.cardSelected : C.card }}>
                  <Text style={{ fontSize: 30 }}>{c.emoji}</Text>
                  <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 20, color: C.teal }}>{c.label}</Text>
                  <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={on ? C.green : C.lineStrong} />
                </Pressable>
              </Enter>
            );
          })}
        </ScrollView>
      ) : (
        <>
          <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 10 }}>
            {areas.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {CATEGORIES.filter((c) => areas.includes(c.key)).map((c) => {
                  const on = tab === c.key;
                  return (
                    <Pressable key={c.key} onPress={() => (tap('select'), setQuery(''), setTab(c.key))} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, backgroundColor: on ? C.teal : C.sand, borderWidth: 1, borderColor: on ? C.teal : C.line }}>
                      <Text style={{ fontFamily: F.bold, fontSize: 13, color: on ? C.white : C.teal }}>
                        {c.emoji} {c.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 12, paddingHorizontal: 12 }}>
              <Ionicons name="search" size={16} color={C.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={`Can’t find it? Search ${cat.label.toLowerCase()}…`}
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
          </View>
          <ScrollView ref={scroller} contentContainerStyle={{ padding: 20, paddingTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }} keyboardShouldPersistTaps="handled">
            {shown.map((x) => (
              <Thing key={keyOf(x)} item={x} selected={isPicked(x)} fresh={fresh.has(keyOf(x))} onPress={() => toggle(x)} />
            ))}
            {canAdd && (
              <Pressable
                onPress={() => toggle({ name: typed, type: cat.type })}
                style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: C.title }}>
                <Ionicons name="add-circle-outline" size={18} color={C.title} />
                <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 14, color: C.title }}>Add “{typed}”</Text>
              </Pressable>
            )}
          </ScrollView>
        </>
      )}

      {/* the way on: areas first, then the tray with what's picked */}
      <View style={{ borderTopWidth: 1, borderColor: C.line, backgroundColor: C.paper, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, gap: 10 }}>
        {step === 'things' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flex: 1 }}>
              {picked.map((x) => (
                <View key={keyOf(x)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 99, backgroundColor: C.mint, borderWidth: 1, borderColor: C.mintBorder, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <SafePicture uri={x.image} emoji={TYPE_EMOJI[x.type]} emojiSize={10} style={{ width: 18, height: 18, borderRadius: 9 }} />
                  <Text numberOfLines={1} style={{ maxWidth: 110, fontFamily: F.bold, fontSize: 12, color: C.mossDark }}>
                    {x.name}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <Text style={{ fontFamily: F.bold, fontSize: 15, color: ready ? C.green : C.muted }}>{picked.length} / 5</Text>
          </View>
        )}
        {step === 'areas' ? (
          <Btn title="continue" mono disabled={!areas.length} kind={areas.length ? 'green' : 'light'} onPress={toThings} />
        ) : (
          <Btn title="continue" mono disabled={!ready} kind={ready ? 'green' : 'light'} onPress={next} />
        )}
      </View>
    </SafeAreaView>
  );
}

function Thing({ item, selected, fresh, onPress }: { item: WorldItem; selected: boolean; fresh: boolean; onPress: () => void }) {
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
    <Pressable onPress={press} style={{ width: '48%' }} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={item.name}>
      <Animated.View
        style={[
          { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: selected ? 2 : 1, borderBottomWidth: selected ? 4 : 2, borderColor: selected ? C.green : fresh ? C.amber : C.lineStrong, backgroundColor: selected ? C.mint : C.white },
          a,
        ]}>
        {item.type === 'history' ? (
          <Text style={{ fontSize: 20 }}>{TYPE_EMOJI[item.type]}</Text>
        ) : (
          <SafePicture uri={item.image} emoji={TYPE_EMOJI[item.type]} emojiSize={18} style={{ width: 36, height: 54, borderRadius: 6 }} />
        )}
        <Text numberOfLines={2} style={{ flex: 1, fontFamily: F.bold, fontSize: 14, lineHeight: 18, color: C.ink }}>
          {item.name}
        </Text>
        {selected && <Ionicons name="checkmark-circle" size={18} color={C.green} />}
      </Animated.View>
    </Pressable>
  );
}
