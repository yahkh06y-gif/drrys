// "Show Coco your world" — from wide to narrow, each step one simple choice:
//   1. areas: sports, movies, shows & anime, books, history (big cards)
//   2. niches, straight from Qloo: its sports, its genres, its history genres (Coco's picture when there is one,
//      else the most popular thing in the niche). Films, shows and books share one set of genres ("Stories"),
//      so drama is picked once, not three times. Only Islamic history is Drrys' own (Qloo has no data for it).
//   3. things: one tab per area (Sports, Movies…), and in it one row per niche (Mystery, then its films;
//      Adventure, then its films…; in Shows, mystery shows…): the popular teams, players and titles, big
//      pictures with the name under them, plus search. Every pick teaches the list: three related things
//      (from Qloo) appear right after it.
// Step 2 shows one row per section (Sports, Stories, History) that slides left and right.
// The tray at the bottom always shows what's picked: tap one to take it out, wherever it came from.
// An area's niches start loading the moment it's picked (and a niche's things too), so the next step is
// usually ready on arrival.
// Profile → About you → Interests opens this same screen (`editing`): the saved picks are already in the tray and
// their areas already chosen, and "save" goes back instead of going on.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COCO } from '@/art';
import { NICHE_ART } from '@/art-niches';
import { SafePicture } from '@/components/SafePicture';
import { Btn, Choice, Enter, OnbBar } from '@/components/ui';
import { useBack } from '@/lib/back';
import { tap } from '@/lib/feedback';
import { progressOf } from '@/lib/onboarding';
import { prepareFirst } from '@/lib/first';
import { AREA_TYPE, CATEGORIES, cocoComment, nichesFor, relatedTo, rowOf, searchWorld, SECTION_ICON, SECTION_LABEL, sectionOf, shelfOf, TYPE_EMOJI, TYPE_ICON, type CategoryKey, type Niche, type Row, type Section } from '@/lib/qloo';
import { useApp, type WorldItem } from '@/store';
import { C, F } from '@/theme';

const MIN = 3;
const MAX = 8;
const GAP = 12;
const keyOf = (x: WorldItem) => x.id ?? `${x.type}:${x.name.toLowerCase()}`;
const toggleIn = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
type Step = 'areas' | 'niches' | 'things';
type Load<T> = T | 'loading' | 'error';

const TITLE: Record<Step, string> = { areas: 'Show Coco your world', niches: 'Narrow it down', things: 'Your favourites' };
const SECTION_EMOJI: Record<Section, string> = { sports: '⚽', stories: '🎬', history: '🏛️' };

/** The area a saved pick came from (for opening the screen again with it). */
const areaOf = (x: WorldItem): CategoryKey | undefined =>
  x.type === 'person' ? 'sports' : x.type === 'history' ? 'history' : CATEGORIES.find((c) => AREA_TYPE[c.key] === x.type)?.key;

export default function World() {
  return <WorldView />;
}

export function WorldView({ editing = false }: { editing?: boolean }) {
  const setProfile = useApp((s) => s.setProfile);
  const set = useApp((s) => s.set);
  const saved = useApp((s) => s.world);
  const { width } = useWindowDimensions();
  const [step, setStep] = useState<Step>('areas');
  const [areas, setAreas] = useState<CategoryKey[]>(() =>
    editing ? CATEGORIES.map((c) => c.key).filter((a) => saved.picks.some((x) => areaOf(x) === a)) : [],
  );
  const [nichesBy, setNichesBy] = useState<Partial<Record<Section, Load<Niche[]>>>>({});
  const [chosen, setChosen] = useState<string[]>([]); // niche keys
  const [shelves, setShelves] = useState<Record<string, Load<WorldItem[]>>>({});
  const [tab, setTab] = useState<CategoryKey | ''>('');
  const [picked, setPicked] = useState<WorldItem[]>(() => (editing ? saved.picks.slice(0, MAX) : []));
  const [fresh, setFresh] = useState<Set<string>>(new Set()); // things the list just learned
  const [line, setLine] = useState('What do you love?');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WorldItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const sections = useMemo(() => [...new Set(areas.map(sectionOf))], [areas]);
  // a story genre shows only if films, shows or books picked have it (anime: shows only)
  const visible = useCallback((n: Niche) => areas.some((a) => rowOf(n, a)), [areas]);
  const allNiches = useMemo(() => sections.flatMap((x) => (Array.isArray(nichesBy[x]) ? (nichesBy[x] as Niche[]).filter(visible) : [])), [sections, nichesBy, visible]);
  const picks = useMemo(() => allNiches.filter((n) => chosen.includes(n.key)), [allNiches, chosen]);
  const rowsIn = (a: CategoryKey) => picks.map((n) => rowOf(n, a)).filter((r): r is Row => !!r);
  const tabs = areas.filter((a) => rowsIn(a).length > 0);
  const area = tab && tabs.includes(tab) ? tab : tabs[0];
  const rows = area ? rowsIn(area) : [];
  const lead = rows[0]; // where searched picks go
  const posterW = Math.floor((width - 40 - GAP * 2) / 3);
  const rowW = Math.floor((width - 40) / 3.3); // a little of the next poster shows, so the row reads as scrollable
  const nicheW = Math.floor((width - 40) / 2.4); // a little of the next card shows, so the row reads as scrollable

  const back = useCallback(() => {
    if (step === 'things') return setQuery(''), setStep('niches'), true;
    if (step === 'niches') return setStep('areas'), true;
    return false;
  }, [step]);
  useBack(back);

  /* ---------- loading from Qloo ---------- */

  const loadNiches = useCallback((x: Section) => {
    setNichesBy((m) => ({ ...m, [x]: 'loading' }));
    nichesFor(x)
      .then((list) => setNichesBy((m) => ({ ...m, [x]: list.length ? list : 'error' })))
      .catch(() => setNichesBy((m) => ({ ...m, [x]: 'error' })));
  }, []);

  const loadShelf = useCallback((r: Row) => {
    setShelves((m) => ({ ...m, [r.key]: 'loading' }));
    shelfOf(r)
      .then((items) => setShelves((m) => ({ ...m, [r.key]: items.length ? items : 'error' })))
      .catch(() => setShelves((m) => ({ ...m, [r.key]: 'error' })));
  }, []);
  const needs = (key: string) => shelves[key] === undefined || shelves[key] === 'error';

  // editing: the areas that are already chosen start loading their niches
  useEffect(() => {
    if (editing) [...new Set(areas.map(sectionOf))].forEach(loadNiches);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickArea = (a: CategoryKey) => {
    setAreas((x) => toggleIn(x, a));
    if (areas.includes(a)) return;
    const x = sectionOf(a);
    if (nichesBy[x] === undefined || nichesBy[x] === 'error') loadNiches(x);
    // a genre already picked now has a row here too (drama shows, after drama films)
    picks.forEach((n) => {
      const r = rowOf(n, a);
      if (r && needs(r.key)) loadShelf(r);
    });
  };

  const pickNiche = (n: Niche) => {
    tap('select');
    setChosen((x) => toggleIn(x, n.key));
    if (chosen.includes(n.key)) return;
    areas.forEach((a) => {
      const r = rowOf(n, a);
      if (r && needs(r.key)) loadShelf(r);
    });
  };

  const toNiches = () => {
    setStep('niches');
    setLine('Ooh, nice. Go deeper.');
  };
  const toThings = () => {
    setTab(tabs[0] ?? '');
    setStep('things');
    setLine(picked.length ? 'Anything else?' : `Pick ${MIN} or more.`);
  };

  /* ---------- search (inside the open area; Islamic history searches its own list too) ---------- */

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || !lead) return setResults(null);
    const mine = rows.flatMap((r) => r.niche.local ?? []).filter((x) => x.name.toLowerCase().includes(q.toLowerCase()));
    const qloo = rows.find((r) => !r.niche.local);
    if (!qloo) return setResults(mine);
    setSearching(true);
    const t = setTimeout(() => {
      searchWorld(q, area === 'sports' ? 'sports' : qloo.type)
        .then((found) => setResults([...mine, ...found]))
        .catch(() => setResults(mine))
        .finally(() => setSearching(false));
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, area, chosen]);

  /* ---------- picking things ---------- */

  const isPicked = (x: WorldItem) => picked.some((p) => keyOf(p) === keyOf(x));
  const remove = (x: WorldItem) => {
    tap('select');
    setPicked((p) => p.filter((y) => keyOf(y) !== keyOf(x)));
  };

  const toggle = (x: WorldItem, row?: string) => {
    if (isPicked(x)) return remove(x);
    tap('select');
    if (picked.length >= MAX) return setLine('That’s plenty! Tap one below to swap it.');
    setPicked((p) => [...p, x]);
    setLine(cocoComment(x, picked.length));
    const home = row ?? lead?.key;
    if (!home) return;
    // a searched (or typed) pick joins the area's first row
    if (results) {
      setShelves((m) => {
        const list = Array.isArray(m[home]) ? (m[home] as WorldItem[]) : [];
        return list.some((c) => keyOf(c) === keyOf(x)) ? m : { ...m, [home]: [x, ...list] };
      });
      setQuery('');
      scroller.current?.scrollTo({ y: 0, animated: true });
    }
    // the list learns: three related things right after this one
    if (x.id)
      relatedTo(x)
        .then((more) => {
          setShelves((m) => {
            const list = Array.isArray(m[home]) ? (m[home] as WorldItem[]) : [];
            const have = new Set(list.map(keyOf));
            const add = more.filter((r) => !have.has(keyOf(r)));
            if (!add.length) return m;
            setFresh((f) => new Set([...f, ...add.map(keyOf)]));
            const i = list.findIndex((c) => keyOf(c) === keyOf(x));
            return { ...m, [home]: i < 0 ? [...add, ...list] : [...list.slice(0, i + 1), ...add, ...list.slice(i + 1)] };
          });
        })
        .catch(() => {});
  };

  const typed = query.trim();
  const canAdd = !!results && !!lead && typed.length >= 2 && !results.some((r) => r.name.toLowerCase() === typed.toLowerCase());

  const next = () => {
    set({ world: { picks: picked, because: [], tags: [] } });
    setProfile({ interests: picked.map((x) => x.name) });
    if (editing) return router.back();
    // Coco's first explanation starts now, and is made while the student sets up their plan
    prepareFirst();
    router.push('/onboarding/plan');
  };

  /* ---------- the way on: one button, and it says what's missing ---------- */

  const left = MIN - picked.length;
  const cta =
    step === 'areas'
      ? { title: 'continue', ok: areas.length > 0, go: toNiches }
      : step === 'niches'
        ? { title: 'continue', ok: picks.length > 0, go: toThings }
        : { title: left > 0 ? `pick ${left} more` : editing ? 'save' : 'continue', ok: left <= 0, go: next };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 14 }}>
        <OnbBar value={editing ? 1 : progressOf('world')} onBack={() => back() || (router.canGoBack() && router.back())} />
        {/* Coco in the corner, reacting to every pick */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={COCO.classic} style={{ width: 44, height: 54 }} contentFit="contain" />
          <Enter key={line} style={{ flex: 1 }}>
            <View style={{ alignSelf: 'flex-start', backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.teal }}>{line}</Text>
            </View>
          </Enter>
        </View>
        <Enter key={step}>
          <Text style={{ fontFamily: F.bold, fontSize: 28, lineHeight: 32, color: C.title }}>{TITLE[step]}</Text>
        </Enter>
      </View>

      {step === 'areas' && (
        <ScrollView contentContainerStyle={{ padding: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {CATEGORIES.map((c, k) => (
            <Enter key={c.key} delay={k * 40} style={{ width: '47%' }}>
              <Choice label={c.icon !== undefined ? c.label : `${c.emoji} ${c.label}`} icon={c.icon} selected={areas.includes(c.key)} onPress={() => pickArea(c.key)} />
            </Enter>
          ))}
        </ScrollView>
      )}

      {step === 'niches' && (
        // one row per section (Sports, Stories, History): its niches slide left and right
        <ScrollView contentContainerStyle={{ paddingVertical: 20, gap: 24 }}>
          {sections.map((x) => {
            const got = nichesBy[x];
            return (
              <View key={x} style={{ gap: 10 }}>
                <Text style={{ paddingHorizontal: 20, fontFamily: F.bold, fontSize: 18, color: C.teal }}>{SECTION_LABEL[x]}</Text>
                {got === 'error' ? (
                  <View style={{ paddingHorizontal: 20 }}>
                    <Retry onPress={() => loadNiches(x)} />
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: GAP }}>
                    {got === 'loading' || got === undefined
                      ? [0, 1, 2].map((i) => <Pulse key={i} style={{ width: nicheW, height: nicheW + 26, borderRadius: 16 }} />)
                      : got.filter(visible).map((n) => <NicheCard key={n.key} niche={n} emoji={SECTION_EMOJI[x]} icon={SECTION_ICON[x]} width={nicheW} selected={chosen.includes(n.key)} onPress={() => pickNiche(n)} />)}
                  </ScrollView>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {step === 'things' && (
        <>
          <View style={{ paddingTop: 12, gap: 10 }}>
            {tabs.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
                {tabs.map((t) => {
                  const cat = CATEGORIES.find((c) => c.key === t)!;
                  const on = area === t;
                  return (
                    <Pressable key={t} onPress={() => (tap('select'), setQuery(''), setTab(t), scroller.current?.scrollTo({ y: 0, animated: false }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 14, height: 40, borderRadius: 99, backgroundColor: on ? C.teal : C.sand, borderWidth: 1, borderColor: on ? C.teal : C.line }}>
                      {cat.icon !== undefined ? <Image source={cat.icon} style={{ width: 28, height: 28 }} contentFit="contain" /> : <Text style={{ fontSize: 16 }}>{cat.emoji}</Text>}
                      <Text style={{ fontFamily: F.bold, fontSize: 13, color: on ? C.white : C.teal }}>{cat.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            <View style={{ marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderWidth: 1, borderColor: C.lineStrong, borderRadius: 12, paddingHorizontal: 12 }}>
              <Ionicons name="search" size={16} color={C.muted} />
              <TextInput value={query} onChangeText={setQuery} placeholder="Search" placeholderTextColor="#A69A8A" returnKeyType="search" style={{ flex: 1, paddingVertical: 10, fontFamily: F.medium, fontSize: 15, color: C.ink }} />
              {searching ? (
                <ActivityIndicator size="small" color={C.teal} />
              ) : query ? (
                <Pressable hitSlop={8} onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={18} color={C.muted} />
                </Pressable>
              ) : null}
            </View>
          </View>
          <ScrollView ref={scroller} contentContainerStyle={{ paddingVertical: 14, gap: 22 }} keyboardShouldPersistTaps="handled">
            {results ? (
              // search: one grid of what was found
              <View style={{ paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', columnGap: GAP, rowGap: 16 }}>
                {results.map((x) => (
                  <Poster key={keyOf(x)} item={x} width={posterW} selected={isPicked(x)} fresh={false} onPress={() => toggle(x)} />
                ))}
                {canAdd && lead && (
                  <Pressable
                    onPress={() => toggle({ name: typed, type: lead.type })}
                    style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: C.title }}>
                    <Ionicons name="add-circle-outline" size={18} color={C.title} />
                    <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 14, color: C.title }}>Add “{typed}”</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              // one row per niche: its name, then its things
              rows.map((r) => {
                const got = shelves[r.key];
                return (
                  <View key={r.key} style={{ gap: 10 }}>
                    <Text style={{ paddingHorizontal: 20, fontFamily: F.bold, fontSize: 18, color: C.teal }}>{r.niche.label}</Text>
                    {got === 'error' ? (
                      <View style={{ paddingHorizontal: 20 }}>
                        <Retry onPress={() => loadShelf(r)} />
                      </View>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: GAP }}>
                        {got === 'loading' || got === undefined
                          ? [0, 1, 2, 3].map((i) => <Pulse key={i} style={{ width: rowW, height: rowW * 1.5 + 22, borderRadius: 12 }} />)
                          : got.map((x) => <Poster key={keyOf(x)} item={x} width={rowW} selected={isPicked(x)} fresh={fresh.has(keyOf(x))} onPress={() => toggle(x, r.key)} />)}
                      </ScrollView>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </>
      )}

      {/* the tray: everything picked, one tap takes it out */}
      <View style={{ borderTopWidth: 1, borderColor: C.line, backgroundColor: C.paper, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, gap: 10 }}>
        {step === 'things' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 6, paddingRight: 6 }} style={{ flex: 1 }}>
              {picked.length === 0
                ? Array.from({ length: MIN }, (_, i) => <View key={i} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderStyle: 'dashed', borderColor: C.lineStrong }} />)
                : picked.map((x) => (
                    <Animated.View key={keyOf(x)} entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} layout={LinearTransition}>
                      <Pressable onPress={() => remove(x)} hitSlop={4} accessibilityRole="button" accessibilityLabel={`Remove ${x.name}`}>
                        <SafePicture uri={x.image} emoji={TYPE_EMOJI[x.type]} icon={TYPE_ICON[x.type]} emojiSize={16} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: C.green }} />
                        <View style={{ position: 'absolute', top: -5, right: -5, width: 20, height: 20, borderRadius: 10, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.paper }}>
                          <Ionicons name="close" size={11} color={C.white} />
                        </View>
                      </Pressable>
                    </Animated.View>
                  ))}
            </ScrollView>
            <Text style={{ fontFamily: F.bold, fontSize: 15, color: left <= 0 ? C.green : C.muted }}>
              {picked.length}/{MAX}
            </Text>
          </View>
        )}
        <Btn title={cta.title} mono disabled={!cta.ok} kind={cta.ok ? 'green' : 'light'} onPress={cta.go} />
      </View>
    </SafeAreaView>
  );
}

/** A niche: Coco's picture for it (or else its section's icon), with its name under it. */
function NicheCard({ niche, emoji, icon, width, selected, onPress }: { niche: Niche; emoji: string; icon?: number; width: number; selected: boolean; onPress: () => void }) {
  const art = NICHE_ART[niche.slug] ?? icon;
  return (
    <Pressable onPress={onPress} style={{ width }} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={niche.label}>
      <View style={{ width, height: width, borderRadius: 16, overflow: 'hidden', backgroundColor: art ? C.white : C.sand, borderWidth: selected ? 3 : 1, borderColor: selected ? C.green : C.line, alignItems: 'center', justifyContent: 'center' }}>
        {art ? (
          <Image source={art} style={{ width: '88%', height: '88%' }} contentFit="contain" />
        ) : (
          <Text style={{ fontSize: 36, opacity: 0.5 }}>{emoji}</Text>
        )}
        {selected && <Check />}
      </View>
      <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 15, color: selected ? C.green : C.ink, marginTop: 6, textAlign: 'center' }}>
        {niche.label}
      </Text>
    </Pressable>
  );
}

/** A big picture with the name under it. */
function Poster({ item, width, selected, fresh, onPress }: { item: WorldItem; width: number; selected: boolean; fresh: boolean; onPress: () => void }) {
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
          ) : TYPE_ICON[item.type] !== undefined ? (
            <Image source={TYPE_ICON[item.type]} style={{ width: '80%', height: '80%' }} contentFit="contain" />
          ) : (
            <Text style={{ fontSize: 30, opacity: 0.6 }}>{TYPE_EMOJI[item.type]}</Text>
          )}
          {selected && <Check />}
        </View>
      </Animated.View>
      <Text numberOfLines={2} style={{ fontFamily: F.bold, fontSize: 13, lineHeight: 16, color: C.ink, marginTop: 6 }}>
        {item.name}
      </Text>
    </Pressable>
  );
}

function Check() {
  return (
    <View style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.white }}>
      <Ionicons name="checkmark" size={14} color={C.white} />
    </View>
  );
}

/** A grey shape that breathes while something loads (it keeps the layout still, unlike a spinner). */
function Pulse({ style }: { style: ViewStyle }) {
  const o = useSharedValue(0.45);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.9, { duration: 700 }), -1, true);
  }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ backgroundColor: C.track }, style, a]} />;
}

function Retry({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: C.lineStrong, backgroundColor: C.white }}>
      <Ionicons name="refresh" size={18} color={C.teal} />
      <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.teal }}>Try again</Text>
    </Pressable>
  );
}
