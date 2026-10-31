// Pictures for Coco's questions. The AI says which picture of the lecture a question is about (lib/ai: FigureRef);
// here that picture is cut out and saved, so it can be shown right under the question:
//   - a PDF page: the server cuts the box out of the page (supabase/functions/figures),
//   - a slide: the picture is already in the deck (lib/slides), so it is used as it is.
// A question about a picture that can't be shown can't be answered, so it is left out of the session.
import { Directory, File, Paths } from 'expo-file-system';
import { PDFDocument } from 'pdf-lib';
import { Platform } from 'react-native';

import { timed, type ActiveQuestion, type Context, type QPicture } from './ai';
import { callFunction, cloudEnabled } from './cloud';

/** Save one picture (base64) and return where it is: a file in the app's documents, or a data URI on the web. */
function save(data: string, mime: string): string {
  if (Platform.OS === 'web') return `data:${mime};base64,${data}`;
  const dir = new Directory(Paths.document, 'figures');
  dir.create({ intermediates: true, idempotent: true });
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const f = new File(dir, `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}.${ext}`);
  f.write(data, { encoding: 'base64' });
  return f.uri;
}

type Cut = { data: string; width: number; height: number } | null;

/** Cut the questions' pictures out of the PDF pages (one request for all of them). */
async function cutFromPdf(pdf: string, qs: ActiveQuestion[]): Promise<(QPicture | undefined)[]> {
  if (!cloudEnabled) return qs.map(() => undefined);
  const crops = qs.map((q) => ({ page: q.figure!.page, box: q.figure!.box }));
  // the picture server may be waking up (its PDF engine loads on the first request after a quiet while): one more try
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { images } = await timed(attempt ? 'pictures (again)' : 'pictures', () => callFunction<{ images: Cut[] }>('figures', { pdf, crops }, 45000));
      return qs.map((_, k) => {
        const im = images?.[k];
        return im?.data ? { uri: save(im.data, 'image/jpeg'), ratio: im.width / im.height } : undefined;
      });
    } catch {}
  }
  return qs.map(() => undefined); // the server could not cut them: these questions are left out below
}

let warmed = 0;
/** Wake the picture server while the student waits for the analysis: its first request after a quiet while loads a
 *  10 MB PDF engine, so a tiny one-page PDF is cut now and the real pictures later find it ready. Never throws. */
export function warmPictures() {
  if (!cloudEnabled || Date.now() - warmed < 5 * 60000) return;
  warmed = Date.now();
  (async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    const pdf = await doc.saveAsBase64();
    await timed('pictures server warm-up', () => callFunction('figures', { pdf, crops: [{ page: 1 }] }, 45000));
  })().catch(() => {});
}

/** Give every question that is about a picture its picture. Questions whose picture can't be made are left out,
 *  always: a question about a picture the student can't see can't be answered. */
export async function attachPictures(c: Context, questions: ActiveQuestion[]): Promise<ActiveQuestion[]> {
  const want = questions.filter((q) => q.figure);
  if (!want.length) return questions;
  const made = new Map<ActiveQuestion, QPicture | undefined>();
  if (c.slides?.length) {
    for (const q of want) {
      const im = c.slides[q.figure!.page - 1]?.images[(q.figure!.image ?? 0) - 1];
      try {
        made.set(q, im ? { uri: save(im.data, im.mime) } : undefined);
      } catch {
        made.set(q, undefined);
      }
    }
  } else if (c.pdfBase64) {
    const cuts = await cutFromPdf(c.pdfBase64, want);
    want.forEach((q, k) => made.set(q, cuts[k]));
  }
  return questions.flatMap((q) => {
    if (!q.figure) return [q];
    const picture = made.get(q);
    if (!picture) console.log(`[check] question left out: its picture could not be made: "${q.q.slice(0, 80)}"`);
    return picture ? [{ ...q, picture }] : [];
  });
}
