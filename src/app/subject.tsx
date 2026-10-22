// Plant / edit a subject tree: name, lecture days, chapters (= branches) and their lecture files.
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn, Enter, IconBtn, T } from '@/components/ui';
import { haptic, play, tap } from '@/lib/feedback';
import { checkPdf, keepFile } from '@/lib/session';
import { chapterLimit, LIMITS } from '@/lib/purchases';
import { friendBranches } from '@/lib/together';
import { uid, useApp, type Chapter, type Material } from '@/store';
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
  const together = useApp((s) => s.together); // an invited friend can unlock a 2nd branch
  const maxCh = chapterLimit(isPro, together);
  const canInvite = !isPro && friendBranches(together) < 1;
  const [syllabus, setSyllabus] = useState<Material | undefined>(existing?.syllabus);
  const [papers, setPapers] = useState<Material[]>(existing?.pastPapers ?? []);
  const removeSubject = useApp((s) => s.removeSubject);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const patch = (cid: string, p: Partial<Chapter>) => setChapters((cs) => cs.map((c) => (c.id === cid ? { ...c, ...p } : c)));

  const pick = async (cid: string) => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true, multiple: false });
    if (r.canceled) return;
    const f = r.assets[0];
    const bad = await checkPdf(f, { chapter: true, isPro });
    if (bad) return Alert.alert('Can’t use this file', bad);
    play('select');
    const uri = await keepFile(f.uri);
    setChapters((cs) =>
      cs.map((c) => (c.id === cid ? { ...c, materials: [...c.materials, { id: uid(), name: f.name, uri, size: f.size, mime: f.mimeType }] } : c)),
    );
  };

  const pickPdf = async (multiple: boolean): Promise<Material[]> => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true, multiple });
    if (r.canceled) return [];
    for (const f of r.assets) {
      const bad = await checkPdf(f, { chapter: false, isPro });
      if (bad) {
        Alert.alert('Can’t use this file', `${f.name}: ${bad}`);
        return [];
      }
    }
    play('select');
    return Promise.all(r.assets.map(async (f) => ({ id: uid(), name: f.name, uri: await keepFile(f.uri), size: f.size, mime: f.mimeType })));
  };

  const addChapter = () => {
    if (chapters.length >= maxCh) {
      if (canInvite)
        Alert.alert('Want a 2nd branch?', 'Invite a friend to Drrys: when they finish their first session, your trees get a free 2nd branch. Or go Pro for 5.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'See Pro', onPress: () => router.push('/paywall') },
          { text: 'Invite a friend', onPress: () => router.push('/together') },
        ]);
      else if (!isPro) router.push('/paywall');
      else Alert.alert('Tree is full', `A tree can hold ${maxCh} branches.`);
      return;
    }
    tap('select');
    setChapters((cs) => [...cs, { id: uid(), title: '', materials: [], mastery: 0, sessions: 0 }]);
  };

  const save = () => {
    const clean = chapters.map((c, i) => ({ ...c, title: c.title.trim() || `Chapter ${i + 1}` }));
    const files = { syllabus, pastPapers: papers };
    if (existing) updateSubject(existing.id, { name: name.trim(), days, chapters: clean, ...files });
    else addSubject({ name: name.trim(), days, chapters: clean, ...files });
    if (existing) {
      haptic('success');
      router.back();
    } else router.replace({ pathname: '/grow', params: onboarding ? { onboarding: '1' } : {} });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView ref={scroller} contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 22 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconBtn name="arrow-back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/onboarding/plant'))} />
            {!onboarding && (
              <T v="h3" style={{ color: C.teal }}>
                {existing ? 'Edit tree' : 'Plant a new tree'}
              </T>
            )}
          </View>
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

          {/* first planting keeps it to a name and days: chapters and files come next, on the tree */}
          {!onboarding && (
          <Enter delay={120}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Label>{onboarding ? 'First chapter:' : 'Chapters:'}</Label>
              {!onboarding && (
                <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.title }}>
                  {chapters.length > maxCh ? `${maxCh} OPEN · ${chapters.length - maxCh} RESTING` : `${chapters.length} / ${maxCh} BRANCHES`}
                </Text>
              )}
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
                        {m.sample ? (
                          <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.mossDark, backgroundColor: C.mint, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' }}>SAMPLE</Text>
                        ) : (
                          !!m.size && <Text style={{ fontFamily: F.medium, fontSize: 10, color: C.muted }}>{(m.size / 1e6).toFixed(1)} MB</Text>
                        )}
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
              {/* first planting keeps it short: one chapter now, the rest later from Edit tree */}
              {!onboarding && chapters.length < LIMITS.proChapters && (
                <Pressable onPress={addChapter} style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: C.title, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.title }}>+ Add another chapter</Text>
                  {chapters.length >= maxCh && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.teal, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Ionicons name="lock-closed" size={10} color={C.white} />
                      <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.white }}>PRO</Text>
                    </View>
                  )}
                </Pressable>
              )}
            </View>
          </Enter>

          )}

          {onboarding ? (
            <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted, textAlign: 'center', marginTop: -8 }}>
              Next, you’ll add your first lecture right on your tree.
            </Text>
          ) : (
          <Enter delay={180}>
            <View style={{ gap: 2 }}>
              <Label>Course files:</Label>
              <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.muted, marginBottom: 8 }}>
                Optional. They help Coco focus on what your exams ask. They don’t add branches.
              </Text>
            </View>
            <View style={{ borderWidth: 1.5, borderColor: C.teal, borderRadius: 18, padding: 12, gap: 12, backgroundColor: C.white }}>
              <FileSlot
                icon="list-outline"
                title="Syllabus"
                hint="Course outline, topics and weights"
                files={syllabus ? [syllabus] : []}
                addLabel={syllabus ? 'Replace file' : 'Upload syllabus (PDF)'}
                onAdd={async () => {
                  const [f] = await pickPdf(false);
                  if (f) setSyllabus(f);
                }}
                onRemove={() => setSyllabus(undefined)}
              />
              <FileSlot
                icon="documents-outline"
                title="Past papers"
                hint="Old exams and quizzes"
                files={papers}
                addLabel={papers.length ? 'Add another paper' : 'Upload past papers (PDF)'}
                onAdd={async () => {
                  const fs = await pickPdf(true);
                  if (fs.length) setPapers((p) => [...p, ...fs]);
                }}
                onRemove={(id) => setPapers((p) => p.filter((x) => x.id !== id))}
              />
            </View>
          </Enter>
          )}

          <Btn title={existing ? 'Save tree' : 'Plant & Save Subject'} icon="arrow-forward" kind="leaf" disabled={!name.trim()} onPress={save} />
          {existing && (
            <View style={{ marginTop: 8, borderTopWidth: 1, borderColor: C.line, paddingTop: 16 }}>
              {!confirmDelete ? (
                <Pressable onPress={() => (tap('select'), setConfirmDelete(true), setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80))} hitSlop={8} style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 }}>
                  <Ionicons name="trash-outline" size={16} color={C.red} />
                  <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.red }}>Delete this tree</Text>
                </Pressable>
              ) : (
                <Enter>
                  <View style={{ borderWidth: 2, borderColor: C.red, borderRadius: 16, padding: 16, gap: 12, backgroundColor: '#FDF1F0' }}>
                    <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.ink }}>Delete “{existing.name}”?</Text>
                    <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.muted }}>
                      The tree, its {existing.chapters.length} {existing.chapters.length === 1 ? 'branch' : 'branches'} and all its flashcards will be gone. This can’t be undone.
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Pressable onPress={() => (tap(), setConfirmDelete(false))} style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: 2, borderColor: C.line, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }}>
                        <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.ink }}>Keep it</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          haptic('medium');
                          removeSubject(existing.id);
                          router.back();
                        }}
                        style={{ flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.red, flexDirection: 'row', gap: 6 }}>
                        <Ionicons name="trash" size={15} color={C.white} />
                        <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.white }}>Delete tree</Text>
                      </Pressable>
                    </View>
                  </View>
                </Enter>
              )}
            </View>
          )}
          {onboarding && (
            <Pressable onPress={() => router.replace('/onboarding/plan')} style={{ alignSelf: 'center' }}>
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

// A course-wide upload slot (syllabus / past papers) — same file-chip look as the chapter slides.
function FileSlot({
  icon,
  title,
  hint,
  files,
  addLabel,
  onAdd,
  onRemove,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  files: Material[];
  addLabel: string;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const has = files.length > 0;
  return (
    <View style={{ flexDirection: 'row', gap: 10, borderWidth: 1, borderStyle: has ? 'solid' : 'dashed', borderColor: C.lineStrong, borderRadius: 14, padding: 10, backgroundColor: C.paper }}>
      <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: has ? C.teal : '#DCE9E6', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color={has ? C.white : C.teal} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View>
          <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink }}>{title}</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>{hint}</Text>
        </View>
        {files.map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 }}>
            <Ionicons name="document-text-outline" size={14} color={C.teal} />
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.medium, fontSize: 12, color: C.ink }}>
              {m.name}
            </Text>
            {!!m.size && <Text style={{ fontFamily: F.medium, fontSize: 10, color: C.muted }}>{(m.size / 1e6).toFixed(1)} MB</Text>}
            <Pressable hitSlop={8} onPress={() => onRemove(m.id)}>
              <Ionicons name="close" size={14} color={C.muted} />
            </Pressable>
          </View>
        ))}
        <Pressable onPress={onAdd} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 }}>
          <Ionicons name="cloud-upload-outline" size={14} color={C.title} />
          <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.title }}>{addLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}
