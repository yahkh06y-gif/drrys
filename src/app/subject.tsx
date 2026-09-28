// Plant / edit a subject tree: name, lecture days, chapters (= branches) and their lecture files.
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn, Enter, IconBtn, T } from '@/components/ui';
import { play, tap } from '@/lib/feedback';
import { LIMITS } from '@/lib/purchases';
import { uid, useApp, type Chapter } from '@/store';
import { C, F } from '@/theme';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export default function SubjectForm() {
  const { onboarding, id } = useLocalSearchParams<{ onboarding?: string; id?: string }>();
  const existing = useApp((s) => s.subjects.find((x) => x.id === id));
  const isPro = useApp((s) => s.isPro);
  const addSubject = useApp((s) => s.addSubject);
  const updateSubject = useApp((s) => s.updateSubject);

  const [name, setName] = useState(existing?.name ?? '');
  const [days, setDays] = useState<number[]>(existing?.days ?? []);
  const [chapters, setChapters] = useState<Chapter[]>(
    existing?.chapters ?? [{ id: uid(), title: '', materials: [], mastery: 0, sessions: 0 }],
  );
  const maxCh = isPro ? LIMITS.proChapters : LIMITS.freeChapters;

  const patch = (cid: string, p: Partial<Chapter>) => setChapters((cs) => cs.map((c) => (c.id === cid ? { ...c, ...p } : c)));

  const pick = async (cid: string) => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true, multiple: false });
    if (r.canceled) return;
    const f = r.assets[0];
    play('select');
    setChapters((cs) =>
      cs.map((c) => (c.id === cid ? { ...c, materials: [...c.materials, { id: uid(), name: f.name, uri: f.uri, size: f.size, mime: f.mimeType }] } : c)),
    );
  };

  const addChapter = () => {
    if (chapters.length >= maxCh) {
      if (!isPro) router.push('/paywall');
      else Alert.alert('Tree is full', `A tree can hold ${maxCh} branches.`);
      return;
    }
    tap('select');
    setChapters((cs) => [...cs, { id: uid(), title: '', materials: [], mastery: 0, sessions: 0 }]);
  };

  const save = () => {
    const clean = chapters.map((c, i) => ({ ...c, title: c.title.trim() || `Chapter ${i + 1}` }));
    if (existing) updateSubject(existing.id, { name: name.trim(), days, chapters: clean });
    else addSubject({ name: name.trim(), days, chapters: clean });
    if (existing) {
      play('success');
      router.back();
    } else router.replace({ pathname: '/grow', params: onboarding ? { onboarding: '1' } : {} });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 22 }} keyboardShouldPersistTaps="handled">
          {!onboarding && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconBtn name="arrow-back" onPress={() => router.back()} />
              <T v="h3" style={{ color: C.teal }}>
                {existing ? 'Edit tree' : 'Plant a new tree'}
              </T>
            </View>
          )}
          <Enter>
            <Label>Subject name:</Label>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Cell Biology"
              placeholderTextColor="#A69A8A"
              style={inputStyle}
            />
          </Enter>

          <Enter delay={60}>
            <Label>Lecture day:</Label>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {DAYS.map((d, i) => {
                const on = days.includes(i);
                return (
                  <Pressable
                    key={d}
                    onPress={() => {
                      tap('select');
                      setDays((x) => (on ? x.filter((k) => k !== i) : [...x, i]));
                    }}
                    style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: C.teal, backgroundColor: on ? C.teal : C.white, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: F.bold, fontSize: 12, color: on ? C.white : C.teal }}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Enter>

          <Enter delay={120}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Label>Chapters:</Label>
              <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.title }}>
                {chapters.length} / {maxCh} BRANCHES
              </Text>
            </View>
            <View style={{ borderWidth: 1.5, borderColor: C.teal, borderRadius: 18, padding: 12, gap: 12, backgroundColor: C.white }}>
              {chapters.map((c, i) => (
                <View key={c.id} style={{ flexDirection: 'row', gap: 10, borderWidth: 1, borderStyle: c.materials.length ? 'solid' : 'dashed', borderColor: C.lineStrong, borderRadius: 14, padding: 10, backgroundColor: C.paper }}>
                  <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: c.materials.length ? C.teal : '#DCE9E6', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: F.bold, fontSize: 13, color: c.materials.length ? C.white : C.teal }}>CH{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <TextInput
                      value={c.title}
                      onChangeText={(t) => patch(c.id, { title: t })}
                      placeholder={`Chapter ${i + 1} title`}
                      placeholderTextColor="#A69A8A"
                      style={{ fontFamily: F.bold, fontSize: 15, color: C.ink, paddingVertical: 4 }}
                    />
                    {c.materials.map((m) => (
                      <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 }}>
                        <Ionicons name="document-text-outline" size={14} color={C.teal} />
                        <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.medium, fontSize: 12, color: C.ink }}>
                          {m.name}
                        </Text>
                        {!!m.size && <Text style={{ fontFamily: F.medium, fontSize: 10, color: C.muted }}>{(m.size / 1e6).toFixed(1)} MB</Text>}
                        <Pressable hitSlop={8} onPress={() => patch(c.id, { materials: c.materials.filter((x) => x.id !== m.id) })}>
                          <Ionicons name="close" size={14} color={C.muted} />
                        </Pressable>
                      </View>
                    ))}
                    <Pressable onPress={() => pick(c.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 }}>
                      <Ionicons name="cloud-upload-outline" size={14} color={C.title} />
                      <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.title }}>{c.materials.length ? 'Add file' : 'Upload lecture slides (PDF)'}</Text>
                    </Pressable>
                  </View>
                  {chapters.length > 1 && (
                    <Pressable hitSlop={8} onPress={() => setChapters((cs) => cs.filter((x) => x.id !== c.id))}>
                      <Ionicons name="trash-outline" size={16} color={C.muted} />
                    </Pressable>
                  )}
                </View>
              ))}
              <Pressable onPress={addChapter} style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: C.title, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.title }}>+ Add another chapter</Text>
              </Pressable>
            </View>
          </Enter>

          <Btn title={existing ? 'Save tree' : 'Plant & Save Subject'} icon="arrow-forward" kind="leaf" disabled={!name.trim()} onPress={save} />
          {onboarding && (
            <Pressable onPress={() => router.replace('/onboarding/signin')} style={{ alignSelf: 'center' }}>
              <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted, textDecorationLine: 'underline' }}>Skip for now, finish later</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const Label = ({ children }: { children: string }) => (
  <Text style={{ fontFamily: F.bold, fontSize: 17, color: C.title, marginBottom: 10 }}>{children}</Text>
);

const inputStyle = {
  borderWidth: 1.5,
  borderColor: C.teal,
  borderRadius: 14,
  paddingHorizontal: 14,
  paddingVertical: 14,
  fontFamily: F.medium,
  fontSize: 15,
  color: C.ink,
  backgroundColor: C.white,
} as const;
