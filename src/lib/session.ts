import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import type { Context } from '@/lib/ai';
import { useApp } from '@/store';

const cache = new Map<string, string>();

/** Everything Coco needs to know about the current session. */
export async function sessionContext(withPdf = true): Promise<Context> {
  const s = useApp.getState();
  const d = s.session!;
  const subject = s.subjects.find((x) => x.id === d.subjectId);
  const chapter = subject?.chapters.find((c) => c.id === d.chapterId);
  const mat = chapter?.materials.find((m) => m.id === d.materialId);
  let pdfBase64: string | undefined;
  if (withPdf && mat) {
    pdfBase64 = cache.get(mat.uri);
    if (!pdfBase64) {
      try {
        if (Platform.OS === 'web') {
          const blob = await (await fetch(mat.uri)).blob();
          pdfBase64 = await new Promise<string>((res) => {
            const r = new FileReader();
            r.onload = () => res(String(r.result).split(',')[1]);
            r.readAsDataURL(blob);
          });
        } else {
          pdfBase64 = await new File(mat.uri).base64();
        }
        cache.set(mat.uri, pdfBase64);
      } catch {
        pdfBase64 = undefined;
      }
    }
  }
  return {
    subject: subject?.name ?? 'General',
    chapter: chapter?.title ?? 'Chapter',
    pdfBase64,
    fromPage: d.fromPage,
    toPage: d.toPage,
    interests: s.profile.interests,
    style: { friendly: 'friendly coach', calm: 'calm tutor', direct: 'direct & focused', playful: 'playful buddy' }[s.coco.style],
    depth: s.coco.depth,
  };
}
