// Session step 1 — choose today's material and page range.
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Btn, Enter, SessionHeader, T } from '@/components/ui';
import { play, tap } from '@/lib/feedback';
import { checkPdf, keepFile } from '@/lib/session';
import { uid, useApp } from '@/store';
import { C, F } from '@/theme';

export default function Choose() {
  const session = useApp((s) => s.session);
  const subject = useApp((s) => s.subjects.find((x) => x.id === s.session?.subjectId));
  const patchSession = useApp((s) => s.patchSession);
  const updateSubject = useApp((s) => s.updateSubject);
  const chapter = subject?.chapters.find((c) => c.id === session?.chapterId);
  if (!session || !subject || !chapter) return null;

  const upload = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true });
    if (r.canceled) return;
    const f = r.assets[0];
    const bad = await checkPdf(f, { chapter: true, isPro: useApp.getState().isPro });
    if (bad) return Alert.alert('Can’t use this file', bad);
    const m = { id: uid(), name: f.name, uri: await keepFile(f.uri), size: f.size, mime: f.mimeType };
    updateSubject(subject.id, { chapters: subject.chapters.map((c) => (c.id === chapter.id ? { ...c, materials: [...c.materials, m] } : c)) });
    patchSession({ materialId: m.id });
    play('select');
  };

  const step = (k: 'fromPage' | 'toPage', d: number) => {
    tap();
    const v = Math.max(1, session[k] + d);
    if (k === 'fromPage') patchSession({ fromPage: Math.min(v, session.toPage) });
    else patchSession({ toPage: Math.max(v, session.fromPage) });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <SessionHeader step={1} title="Session Setup" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
        <Enter>
          <T v="h2">Choose what to study</T>
          <T>Select the material for today’s session on “{chapter.title}”.</T>
        </Enter>

        <Enter delay={80} style={{ gap: 10 }}>
          <T v="label">Select from uploaded files</T>
          {chapter.materials.map((m) => {
            const on = session.materialId === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => (tap('select'), patchSession({ materialId: m.id }))}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderWidth: on ? 2 : 1, borderColor: on ? C.teal : C.lineStrong, borderBottomWidth: 4, borderRadius: 16, padding: 14 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.sand, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="document-text" size={18} color={C.teal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 14, color: C.teal }}>
                    {m.name}
                  </Text>
                  {!!m.size && <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>{(m.size / 1e6).toFixed(1)} MB • PDF</Text>}
                </View>
                <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? C.teal : C.lineStrong} />
              </Pressable>
            );
          })}
          <Pressable onPress={upload} style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: C.title, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
            <Ionicons name="cloud-upload-outline" size={16} color={C.title} />
            <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.title }}>Upload new file (PDF)</Text>
          </Pressable>
          <Pressable
            onPress={() => (tap('select'), patchSession({ materialId: undefined }))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
            <Ionicons name={!session.materialId ? 'radio-button-on' : 'radio-button-off'} size={18} color={C.teal} />
            <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.body }}>No file — Coco uses general knowledge of the topic</Text>
          </Pressable>
        </Enter>

        {session.materialId && (
          <Enter style={{ gap: 10 }}>
            <T v="label">Pages for today</T>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {(['fromPage', 'toPage'] as const).map((k) => (
                <View key={k} style={{ flex: 1, backgroundColor: C.white, borderWidth: 1, borderColor: C.lineStrong, borderBottomWidth: 4, borderRadius: 16, padding: 12 }}>
                  <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted }}>{k === 'fromPage' ? 'From page' : 'To page'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <Pressable hitSlop={8} onPress={() => step(k, -1)}>
                      <Ionicons name="remove-circle-outline" size={24} color={C.teal} />
                    </Pressable>
                    <Text style={{ fontFamily: F.bold, fontSize: 24, color: C.ink }}>{session[k]}</Text>
                    <Pressable hitSlop={8} onPress={() => step(k, 1)}>
                      <Ionicons name="add-circle-outline" size={24} color={C.teal} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
            <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.teal }}>
              ⏱ {session.toPage - session.fromPage + 1} pages selected • ~{Math.max(10, (session.toPage - session.fromPage + 1) * 3)} min session
            </Text>
          </Enter>
        )}
      </ScrollView>
      <View style={{ padding: 20, gap: 6 }}>
        <Btn title="Continue to recall" icon="arrow-forward" kind="teal" pill onPress={() => router.push('/session/recall')} />
        <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.muted, textAlign: 'center' }}>Your material will be hidden during recall — that’s the point 😉</Text>
      </View>
    </SafeAreaView>
  );
}
