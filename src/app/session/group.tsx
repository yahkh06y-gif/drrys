// Session step 5 — Organize: the student groups what they missed, in their own way, and names what
// connects each group. Coco only CHECKS the grouping; she never does it for them.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn, Enter, Pill, SessionHeader, T } from '@/components/ui';
import { verifyGrouping, type GroupCheck } from '@/lib/ai';
import { haptic, play, tap } from '@/lib/feedback';
import { missedIdeas, ORGANIZE_MIN, sessionContext } from '@/lib/session';
import { useApp } from '@/store';
import { C, F } from '@/theme';

type Item = { id: string; title: string; detail: string };
type Group = { name: string; items: string[] };

const MAX_GROUPS = 4;
const MAX_PER_GROUP = 4; // about how many things a mind holds at once

// rough check of a typed memory against an idea's title (shares at least half of its meaningful words)
const remembered = (typed: string, title: string) => {
  const words = title.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3);
  if (!words.length) return typed.toLowerCase().includes(title.toLowerCase());
  const t = typed.toLowerCase();
  return words.filter((w) => t.includes(w.slice(0, Math.max(4, w.length - 2)))).length >= Math.ceil(words.length / 2);
};

export default function Group() {
  const analysis = useApp((s) => s.session?.analysis);
  const patchSession = useApp((s) => s.patchSession);

  // everything the student missed or mixed up
  const items = useMemo<Item[]>(() => missedIdeas(analysis), [analysis]);

  // this step is only for sessions with 4+ missed ideas: otherwise carry on
  useEffect(() => {
    if (items.length < ORGANIZE_MIN) router.replace('/session/active');
  }, [items.length]);

  const [groups, setGroups] = useState<Group[]>([
    { name: '', items: [] },
    { name: '', items: [] },
  ]);
  const [picked, setPicked] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<GroupCheck>();
  const [failed, setFailed] = useState(false);
  // after the check: cover the ideas and try to say what was in each group from memory
  const [phase, setPhase] = useState<'sort' | 'recall'>('sort');
  const [typed, setTyped] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);

  const placed = new Set(groups.flatMap((g) => g.items));
  const loose = items.filter((x) => !placed.has(x.id));
  const byId = (id: string) => items.find((x) => x.id === id)!;
  const used = groups.filter((g) => g.items.length);
  const ready = !loose.length && used.length >= 2 && used.every((g) => g.name.trim().length >= 2);

  const putIn = (gi: number) => {
    if (!picked) return;
    tap('select');
    setGroups((gs) => gs.map((g, k) => (k === gi ? { ...g, items: [...g.items, picked] } : g)));
    setPicked(undefined);
    setCheck(undefined);
  };
  const takeOut = (gi: number, id: string) => {
    tap('select');
    setGroups((gs) => gs.map((g, k) => (k === gi ? { ...g, items: g.items.filter((x) => x !== id) } : g)));
    setCheck(undefined);
  };

  const submit = async () => {
    setBusy(true);
    setFailed(false);
    const mine = used.map((g) => ({ name: g.name.trim(), items: g.items.map((id) => ({ title: byId(id).title, detail: byId(id).detail })) }));
    patchSession({ groups: used.map((g) => ({ name: g.name.trim(), items: g.items.map((id) => byId(id).title) })) });
    try {
      const r = await verifyGrouping(await sessionContext(false), mine);
      setCheck(r);
      play(r.groups.every((g) => g.ok) ? 'success' : 'select');
      haptic('success');
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };

  if (items.length < ORGANIZE_MIN) return null;

  if (phase === 'recall') {
    const total = used.reduce((n, g) => n + g.items.length, 0);
    const got = used.reduce((n, g, gi) => n + g.items.filter((id) => remembered(typed[gi] ?? '', byId(id).title)).length, 0);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
        <SessionHeader step={4} title="Organize" />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
            <Enter>
              <Pill text="30 SECONDS" />
              <T v="h2" style={{ marginTop: 6 }}>
                Cover and recall
              </T>
              <T>The ideas are hidden. Look at each group’s name and write what was inside it, from memory.</T>
            </Enter>
            {used.map((g, gi) => (
              <View key={gi} style={{ backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.lineStrong, borderBottomWidth: 4, padding: 12, gap: 8 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.teal }}>{g.name}</Text>
                <TextInput
                  value={typed[gi] ?? ''}
                  onChangeText={(t) => setTyped((a) => a.map((x, k) => (k === gi ? t : x)))}
                  editable={!revealed}
                  multiline
                  placeholder="What was in this group?"
                  placeholderTextColor="#A69A8A"
                  style={{ minHeight: 56, fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: C.ink, textAlignVertical: 'top' }}
                />
                {revealed &&
                  g.items.map((id) => {
                    const ok = remembered(typed[gi] ?? '', byId(id).title);
                    return (
                      <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={ok ? C.leaf : C.muted} />
                        <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 13, color: ok ? C.moss : C.body }}>{byId(id).title}</Text>
                      </View>
                    );
                  })}
              </View>
            ))}
            {revealed && (
              <Enter>
                <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.teal, textAlign: 'center' }}>
                  {got} of {total} came back from memory
                </Text>
                <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 2 }}>A rough check by matching words — you know best.</Text>
              </Enter>
            )}
          </ScrollView>
          <View style={{ padding: 20 }}>
            {revealed ? (
              <Btn title="On to the questions" icon="arrow-forward" kind="teal" pill onPress={() => router.replace('/session/active')} />
            ) : (
              <Btn title="Reveal" iconLeft="eye" kind="teal" pill onPress={() => (play('success'), haptic('light'), setRevealed(true))} />
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <SessionHeader step={4} title="Organize" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
          <Enter>
            <Pill text="YOUR TURN" />
            <T v="h2" style={{ marginTop: 6 }}>
              Group these in your own way
            </T>
            <T>
              Tap an idea, then tap the group it belongs to. Name each group by what connects its ideas. Coco won’t do it for you — she’ll just check your thinking.
            </T>
          </Enter>

          {/* ideas not placed yet */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, minHeight: 36 }}>
            {loose.map((x) => (
              <Pressable
                key={x.id}
                onPress={() => (tap('select'), setPicked(picked === x.id ? undefined : x.id))}
                style={{
                  backgroundColor: picked === x.id ? C.teal : C.white,
                  borderWidth: 1.5,
                  borderColor: picked === x.id ? C.teal : C.lineStrong,
                  borderBottomWidth: 3,
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  maxWidth: '100%',
                }}>
                <Text style={{ fontFamily: F.bold, fontSize: 13, color: picked === x.id ? C.white : C.ink }}>{x.title}</Text>
              </Pressable>
            ))}
            {!loose.length && <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.leaf }}>All sorted ✓</Text>}
          </View>

          {/* the groups */}
          {groups.map((g, gi) => {
            const res = check?.groups.find((r) => r.name.trim().toLowerCase() === g.name.trim().toLowerCase());
            return (
              <Pressable
                key={gi}
                onPress={() => putIn(gi)}
                style={{
                  backgroundColor: picked ? '#F0F8E6' : C.white,
                  borderRadius: 18,
                  borderWidth: picked ? 2 : 1,
                  borderStyle: picked ? 'dashed' : 'solid',
                  borderColor: picked ? C.mintBorder : C.lineStrong,
                  borderBottomWidth: picked ? 2 : 4,
                  padding: 12,
                  gap: 8,
                }}>
                <TextInput
                  value={g.name}
                  onChangeText={(t) => {
                    setGroups((gs) => gs.map((x, k) => (k === gi ? { ...x, name: t } : x)));
                    setCheck(undefined);
                  }}
                  placeholder={`Group ${gi + 1}: what connects them?`}
                  placeholderTextColor="#A69A8A"
                  style={{ fontFamily: F.bold, fontSize: 15, color: C.teal, paddingVertical: 4 }}
                />
                {!!picked && (
                  <Pressable
                    onPress={() => putIn(gi)}
                    style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.leaf, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 }}>
                    <Ionicons name="add" size={14} color={C.white} />
                    <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 12, color: C.white, maxWidth: 260 }}>
                      Put “{byId(picked).title}” here
                    </Text>
                  </Pressable>
                )}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, minHeight: 28 }}>
                  {g.items.map((id) => (
                    <Pressable
                      key={id}
                      onPress={() => takeOut(gi, id)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.sand, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.ink }}>{byId(id).title}</Text>
                      <Ionicons name="close" size={12} color={C.muted} />
                    </Pressable>
                  ))}
                  {!g.items.length && (
                    <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>{picked ? 'Nothing here yet' : 'Empty'}</Text>
                  )}
                </View>
                {g.items.length > MAX_PER_GROUP && (
                  <Text style={{ fontFamily: F.medium, fontSize: 12, lineHeight: 18, color: C.goldInk }}>
                    💡 That’s a lot for one group. Four or fewer are easier to hold: can you split it?
                  </Text>
                )}
                {res && (
                  <Enter>
                    <View
                      style={{
                        flexDirection: 'row',
                        gap: 8,
                        backgroundColor: res.ok ? '#F0F8E6' : '#FFF6E3',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: res.ok ? C.mintBorder : C.amber,
                        padding: 10,
                      }}>
                      <Ionicons name={res.ok ? 'checkmark-circle' : 'help-circle'} size={18} color={res.ok ? C.leaf : C.orange} />
                      <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 13, lineHeight: 19, color: C.ink }}>{res.note}</Text>
                    </View>
                  </Enter>
                )}
              </Pressable>
            );
          })}

          {groups.length < MAX_GROUPS && (
            <Pressable
              onPress={() => (tap(), setGroups((gs) => [...gs, { name: '', items: [] }]))}
              style={{ alignSelf: 'center', flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: C.sand, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6 }}>
              <Ionicons name="add" size={14} color={C.body} />
              <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.body }}>Add a group</Text>
            </Pressable>
          )}

          {check && !!check.overall && (
            <Enter>
              <Text style={{ fontFamily: F.bold, fontSize: 14, lineHeight: 21, color: C.teal, textAlign: 'center' }}>{check.overall}</Text>
            </Enter>
          )}
          {failed && (
            <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted, textAlign: 'center' }}>
              Coco couldn’t check this time — but making the groups already did the work. Carry on.
            </Text>
          )}
        </ScrollView>
        <View style={{ padding: 20, gap: 10 }}>
          {check || failed ? (
            <>
              <Btn
                title="Cover and recall"
                icon="arrow-forward"
                kind="teal"
                pill
                onPress={() => {
                  setTyped(used.map(() => ''));
                  setRevealed(false);
                  setPhase('recall');
                }}
              />
              <Pressable onPress={() => router.replace('/session/active')} style={{ alignSelf: 'center' }}>
                <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>Skip to the questions</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Btn title="Ask Coco to check" iconLeft="checkmark-circle" kind="teal" pill loading={busy} disabled={!ready} onPress={submit} />
              <Pressable onPress={() => router.replace('/session/active')} style={{ alignSelf: 'center' }}>
                <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted }}>Skip this step</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
