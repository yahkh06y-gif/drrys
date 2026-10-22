// "Show Coco your world" — the student picks 3+ things they love from a grid of posters (Qloo).
// Recognition over recall: real posters are on screen at once, so nobody has to think up an answer;
// search is there for anything missing. Every pick teaches the grid: three related posters (from Qloo)
// appear right after it. If Qloo can't be reached, the simple interest tiles take its place.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COCO, OPTION_ICONS } from '@/art';
import { Btn, Choice, Enter, OnbBar } from '@/components/ui';
import { tap } from '@/lib/feedback';
import { progressOf } from '@/lib/onboarding';
import { cocoComment, FALLBACK_INTERESTS, relatedTo, resolveStarters, searchWorld, STARTERS, TYPE_EMOJI, WORLD_TABS } from '@/lib/qloo';
import { useApp, type WorldItem, type WorldType } from '@/store';
import { C, F } from '@/theme';

const MIN = 3;
const MAX = 8;
const keyOf = (x: WorldItem) => x.id ?? `${x.type}:${x.name.toLowerCase()}`;

export default function World() {
  const { width } = useWindowDimensions();
  const setProfile = useApp((s) => s.setProfile);
  const set = useApp((s) => s.set);
  const [pool, setPool] = useState<WorldItem[]>(() => STARTERS.map((s) => ({ ...s })));
  const [status, setStatus] = useState<'loading' | 'ready' | 'offline'>('loading');
  const [tab, setTab] = useState<'all' | WorldType>('all');
  const [picked, setPicked] = useState<WorldItem[]>(() => useApp.getState().world.picks);
  const [fresh, setFresh] = useState<Set<string>>(new Set()); // posters the grid just learned
  const [line, setLine] = useState('What do you love? Pick 3 or more.');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WorldItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [fallback, setFallback] = useState<string[]>([]);
  const scroller = useRef<ScrollView>(null);

  // the ready-made posters get their real pictures from Qloo
  useEffect(() => {
    let live = true;
    resolveStarters(STARTERS)
      .then((found) => {
        if (!live) return;
        if (!found.some(Boolean)) return setStatus('offline');
        const seen = new Set<string>();
        const next = STARTERS.map((s, i) => found[i] ?? { ...s }).filter((x) => {
          const k = keyOf(x);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        setPool(next);
        // anything picked before the pictures arrived becomes the real thing too
        setPicked((p) => p.map((x) => (x.id ? x : (next.find((n) => n.name.toLowerCase() === x.name.toLowerCase()) ?? x))));
        setStatus('ready');
      })
      .catch(() => live && setStatus('offline'));
    return () => {
      live = false;
    };
  }, []);

  // search, a moment after typing stops
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return setResults(null);
    setSearching(true);
    const t = setTimeout(() => {
      searchWorld(q, tab === 'all' ? undefined : tab)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 450);
    return () => clearTimeout(t);
  }, [query, tab]);

  const isPicked = (x: WorldItem) => picked.some((p) => keyOf(p) === keyOf(x));

  const toggle = (x: WorldItem) => {
    tap('select');
    if (isPicked(x)) return setPicked((p) => p.filter((y) => keyOf(y) !== keyOf(x)));
    if (picked.length >= MAX) return setLine(`That’s plenty! ${MAX} is the most I need.`);
    setPicked((p) => [...p, x]);
    setLine(cocoComment(x, picked.length));
    // the grid learns: three related posters right after this one
    if (x.id)
      relatedTo(x)
        .then((more) => {
          setPool((cur) => {
            const have = new Set(cur.map(keyOf));
            const add = more.filter((m) => !have.has(keyOf(m)));
            if (!add.length) return cur;
            setFresh((f) => new Set([...f, ...add.map(keyOf)]));
            const i = cur.findIndex((c) => keyOf(c) === keyOf(x));
            return i < 0 ? [...add, ...cur] : [...cur.slice(0, i + 1), ...add, ...cur.slice(i + 1)];
          });
        })
        .catch(() => {});
    // a searched pick joins the grid too
    if (results) {
      setPool((cur) => (cur.some((c) => keyOf(c) === keyOf(x)) ? cur : [x, ...cur]));
      setQuery('');
      scroller.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const shown = useMemo(() => results ?? (tab === 'all' ? pool : pool.filter((x) => x.type === tab)), [results, pool, tab]);

  const count = status === 'offline' ? fallback.length : picked.length;
  const ready = count >= MIN;

  const next = () => {
    if (status === 'offline') {
      set({ world: { picks: fallback.map((name) => ({ name, type: 'brand' as const })), because: [], tags: [] } });
      setProfile({ interests: fallback });
      return router.push('/onboarding/first');
    }
    set({ world: { ...useApp.getState().world, picks: picked } });
    setProfile({ interests: picked.map((x) => x.name) });
    router.push(picked.some((x) => x.id) ? '/onboarding/explore' : '/onboarding/first');
  };

  const col = (width - 40 - 2 * 12) / 3;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 14 }}>
        <OnbBar value={progressOf('world')} />
        {/* Coco in the corner, reacting to every pick */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={COCO.classic} style={{ width: 48, height: 60 }} contentFit="contain" />
          <Enter key={line} style={{ flex: 1 }}>
            <View style={{ backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 9 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.teal }}>{status === 'offline' && !count ? 'What are you into? Pick 3 or more.' : line}</Text>
            </View>
          </Enter>
        </View>
        <Text style={{ fontFamily: F.bold, fontSize: 28, lineHeight: 32, color: C.title }}>Show Coco your world</Text>
      </View>

      {status === 'offline' ? (
        // Qloo is unreachable: the simple tiles still tell Coco what you're into
        <ScrollView contentContainerStyle={{ padding: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {FALLBACK_INTERESTS.map((label) => (
            <View key={label} style={{ width: '47%' }}>
              <Choice
                label={label}
                icon={OPTION_ICONS[`interests:${label}`]}
                selected={fallback.includes(label)}
                onPress={() => setFallback((f) => (f.includes(label) ? f.filter((x) => x !== label) : [...f, label]))}
              />
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
              {searching ? (
                <ActivityIndicator size="small" color={C.teal} />
              ) : query ? (
                <Pressable hitSlop={8} onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={18} color={C.muted} />
                </Pressable>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {WORLD_TABS.map((t) => {
                const on = tab === t.key;
                return (
                  <Pressable key={t.key} onPress={() => (tap('select'), setTab(t.key))} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, backgroundColor: on ? C.teal : C.sand, borderWidth: 1, borderColor: on ? C.teal : C.line }}>
                    <Text style={{ fontFamily: F.bold, fontSize: 13, color: on ? C.white : C.teal }}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          <ScrollView ref={scroller} contentContainerStyle={{ padding: 20, paddingTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }} keyboardShouldPersistTaps="handled">
            {results && !results.length && !searching && (
              <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.muted }}>Nothing found. Try another spelling?</Text>
            )}
            {shown.map((x) => (
              <Poster key={keyOf(x)} item={x} width={col} selected={isPicked(x)} fresh={fresh.has(keyOf(x))} loading={status === 'loading' && !x.id} onPress={() => toggle(x)} />
            ))}
          </ScrollView>
        </>
      )}

      {/* the tray: what's picked so far, and the way on */}
      <View style={{ borderTopWidth: 1, borderColor: C.line, backgroundColor: C.paper, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flex: 1 }}>
            {(status === 'offline' ? fallback.map((name): WorldItem => ({ name, type: 'brand' })) : picked).map((x) => (
              <View key={keyOf(x)} style={{ width: 34, height: 34, borderRadius: 17, overflow: 'hidden', backgroundColor: C.sand, borderWidth: 2, borderColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
                {x.image ? <Image source={{ uri: x.image }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Text style={{ fontSize: 14 }}>{TYPE_EMOJI[x.type]}</Text>}
              </View>
            ))}
          </ScrollView>
          <Text style={{ fontFamily: F.bold, fontSize: 15, color: ready ? C.green : C.muted }}>
            {count} / 5
          </Text>
        </View>
        <Btn title="continue" mono disabled={!ready} kind={ready ? 'green' : 'light'} onPress={next} />
      </View>
    </SafeAreaView>
  );
}

function Poster({ item, width, selected, fresh, loading, onPress }: { item: WorldItem; width: number; selected: boolean; fresh: boolean; loading: boolean; onPress: () => void }) {
  const s = useSharedValue(fresh ? 0.6 : 1);
  useEffect(() => {
    if (fresh) s.value = withSpring(1, { damping: 12 });
  }, [fresh, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const press = () => {
    s.value = withSequence(withTiming(1.08, { duration: 110 }), withSpring(1, { damping: 10 }));
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
            <Text style={{ fontSize: 30 }}>{TYPE_EMOJI[item.type]}</Text>
          )}
          {selected && (
            <View style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={15} color={C.white} />
            </View>
          )}
        </View>
      </Animated.View>
      <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 12, color: C.ink, marginTop: 4 }}>
        {item.name}
      </Text>
    </Pressable>
  );
}
