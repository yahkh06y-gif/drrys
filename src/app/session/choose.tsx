// Session step 1 — choose today's material and page range.
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RangePicker } from '@/design/RangePicker';

import { Btn, Enter, SessionHeader, T } from '@/components/ui';
import { play, tap } from '@/lib/feedback';
import { checkPdf, fileLength, keepFile } from '@/lib/session';
import { isSlides, LECTURE_TYPES } from '@/lib/slides';
import { uid, useApp } from '@/store';
import { autoDir } from '@/design/rtl';
import { color, radius } from '@/design/tokens';
import { C, F } from '@/theme';

export default function Choose() {
  const session = useApp((s) => s.session);
  const subject = useApp((s) => s.subjects.find((x) => x.id === s.session?.subjectId));
  const patchSession = useApp((s) => s.patchSession);
  const updateSubject = useApp((s) => s.updateSubject);
  const chapter = subject?.chapters.find((c) => c.id === session?.chapterId);
  const mat = chapter?.materials.find((m) => m.id === session?.materialId);
  const total = mat?.pages; // pages (or slides) in the chosen file, once counted
  const [unreadable, setUnreadable] = useState<string>(); // a file whose pages couldn't be counted (the range is then free)
  const counting = !!mat && !mat.pages && unreadable !== mat.id;

  // count the chosen file's pages once (kept on the file), so the range always matches the real file
  const subjectId = subject?.id;
  const chapterId = chapter?.id;
  useEffect(() => {
    if (!mat || mat.pages || !subjectId || !chapterId) return;
    let alive = true;
    fileLength(mat).then((n) => {
      if (!alive) return;
      if (!n) setUnreadable(mat.id);
      const st = useApp.getState();
      const sub = st.subjects.find((x) => x.id === subjectId);
      if (!n || !sub) return;
      st.updateSubject(subjectId, {
        chapters: sub.chapters.map((c) => (c.id === chapterId ? { ...c, materials: c.materials.map((x) => (x.id === mat.id ? { ...x, pages: n } : x)) } : c)),
      });
    });
    return () => {
      alive = false;
    };
  }, [mat, subjectId, chapterId]);

  // a newly chosen file starts on all its pages; the range never goes past the last page
  const from = session?.fromPage ?? 1;
  const to = session?.toPage ?? 1;
  const rangeFor = session?.rangeFor;
  useEffect(() => {
    if (!mat || !total) return;
    if (rangeFor !== mat.id) patchSession({ fromPage: 1, toPage: total, rangeFor: mat.id });
    else if (to > total) patchSession({ fromPage: Math.min(from, total), toPage: total });
  }, [mat, total, rangeFor, from, to, patchSession]);

  if (!session || !subject || !chapter) return null;

  const upload = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: LECTURE_TYPES, copyToCacheDirectory: true });
    if (r.canceled) return;
    const f = r.assets[0];
    const bad = await checkPdf(f, { chapter: true, isPro: useApp.getState().isPro });
    if (bad) return Alert.alert('Can’t use this file', bad);
    const m = { id: uid(), name: f.name, uri: await keepFile(f.uri, f.name), size: f.size, mime: f.mimeType };
    updateSubject(subject.id, { chapters: subject.chapters.map((c) => (c.id === chapter.id ? { ...c, materials: [...c.materials, m] } : c)) });
    patchSession({ materialId: m.id });
    play('select');
  };

  const unit = mat && isSlides(mat) ? 'slide' : 'page';
  const n = session.toPage - session.fromPage + 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <SessionHeader step={1} title="Session Setup" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
        <Enter>
          <T v="h2">Choose what to study</T>
          <T>For “{chapter.title}”</T>
        </Enter>

        <Enter delay={80} style={{ gap: 10 }}>
          <T v="label">Your files</T>
          {chapter.materials.map((m) => {
            const on = session.materialId === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => (tap('select'), patchSession({ materialId: m.id }))}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: on ? color.selected.bg : C.white, borderWidth: 1.5, borderColor: on ? color.selected.border : C.lineStrong, borderBottomWidth: 4, borderRadius: radius.lg, padding: 14 }}>
                <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: on ? C.white : C.sand, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="document-text" size={18} color={C.teal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[{ fontFamily: F.medium, fontSize: 15, color: on ? color.selected.text : C.ink }, autoDir(m.name)]}>
                    {m.name}
                  </Text>
                  {!!m.size && <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted }}>{m.sample ? 'Sample lecture by Drrys' : `${(m.size / 1e6).toFixed(1)} MB`} • {isSlides(m) ? 'PowerPoint' : 'PDF'}</Text>}
                </View>
                <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? color.selected.border : C.mutedLight} />
              </Pressable>
            );
          })}
          <Pressable onPress={upload} accessibilityRole="button" style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.lineStrong, borderRadius: radius.lg, padding: 14, flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="cloud-upload-outline" size={18} color={C.teal} />
            <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.teal }}>Upload a PDF or PowerPoint</Text>
          </Pressable>
          <Pressable
            onPress={() => (tap('select'), patchSession({ materialId: undefined }))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
            <Ionicons name={!session.materialId ? 'radio-button-on' : 'radio-button-off'} size={18} color={C.teal} />
            <Text style={{ flex: 1, fontFamily: F.regular, fontSize: 14, color: C.body }}>No file, Coco uses what it knows</Text>
          </Pressable>
        </Enter>

        {session.materialId && (
          <Enter style={{ gap: 10 }}>
            <T v="label">{unit === 'slide' ? 'Slides for today' : 'Pages for today'}</T>
            {counting && !total ? (
              <T v="caption">Counting the {unit}s…</T>
            ) : (
              <RangePicker total={total} from={session.fromPage} to={session.toPage} unit={unit} onChange={(fromPage, toPage) => patchSession({ fromPage, toPage })} />
            )}
            <T v="caption">About {Math.max(10, n * 3)} min</T>
          </Enter>
        )}
      </ScrollView>
      <View style={{ padding: 20, gap: 6 }}>
        <Btn title="Continue to recall" icon="arrow-forward" kind="green" onPress={() => router.push('/session/recall')} />
      </View>
    </SafeAreaView>
  );
}
