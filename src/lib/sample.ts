// The sample lecture: a short PDF Drrys writes itself ("How memory works"), so anyone without a lecture
// at hand (judges, curious students) can try a full session. It's built on the phone with pdf-lib, so
// there's no file to ship and no rights to worry about.
// Only in this sample, "✨ Fill sample answer" types an answer for the student. The answers are
// deliberately imperfect (right, missing and one wrong idea) so Coco's feedback shows every colour.
// Real lectures never get a ready-made answer: recalling it yourself is what makes you learn.
import { Directory, File, Paths } from 'expo-file-system';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Platform } from 'react-native';

import type { ActiveQuestion } from '@/lib/ai';
import { uid, type Material } from '@/store';

export const SAMPLE_TITLE = 'How memory works';
export const SAMPLE_PAGES = 3;

const PAGES: { title: string; lines: string[] }[] = [
  {
    title: 'How memory works: encoding, storage and retrieval',
    lines: [
      'Memory has three stages. Encoding turns what we notice into a form the brain can store. Storage keeps it over time. Retrieval brings it back when we need it.',
      'Sensory memory holds a very brief copy of what we see and hear: less than a second for images and a few seconds for sounds.',
      'Attention decides what moves from sensory memory into short-term memory. What we do not pay attention to is usually lost.',
      'Short-term (working) memory holds a small amount of information for a short time, roughly 15 to 30 seconds if we do not rehearse it. Its capacity is limited: the classic estimate is "7 plus or minus 2" items (Miller, 1956); later research suggests about 4 chunks (Cowan, 2001).',
      'Long-term memory can store a very large amount of information for a very long time.',
    ],
  },
  {
    title: 'Forgetting and the spacing effect',
    lines: [
      'In 1885, Hermann Ebbinghaus tested his own memory of nonsense syllables. He found that forgetting is fastest soon after learning and then slows down. This is called the forgetting curve.',
      'Each well-timed review makes the curve flatter: after every review, the memory lasts longer before it fades.',
      'The spacing effect: the same amount of study time, spread over several sessions, leads to better long-term memory than one long session (cramming).',
      'Spaced repetition schedules reviews at growing intervals, for example after 1 day, 3 days and then a week.',
    ],
  },
  {
    title: 'Study strategies that work',
    lines: [
      'Retrieval practice (the testing effect): trying to recall information from memory strengthens it more than reading it again. In a study by Roediger and Karpicke (2006), students who practised recalling a text remembered more of it a week later than students who reread it.',
      'Rereading and highlighting feel productive, but they give little long-term benefit (Dunlosky and colleagues, 2013, rated them as low-utility techniques).',
      'Elaboration: explaining how and why an idea works, and linking it to what you already know, makes it easier to remember.',
      'Sleep helps consolidation: while we sleep, the brain stabilises newly learned memories.',
      'Summary: pay attention when you learn, space your reviews, test yourself, explain the ideas in your own words, and sleep.',
    ],
  },
];

/** Write the sample lecture PDF and return it as a lecture file for a chapter. */
export async function makeSampleLecture(): Promise<Material> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Drrys sample lecture: ${SAMPLE_TITLE}`);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595;
  const H = 842;
  const M = 56;
  const wrap = (text: string, size: number, f = font) => {
    const out: string[] = [];
    let cur = '';
    for (const w of text.split(' ')) {
      const next = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > W - 2 * M && cur) {
        out.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) out.push(cur);
    return out;
  };
  PAGES.forEach((p, i) => {
    const page = pdf.addPage([W, H]);
    let y = H - M;
    page.drawText(`Drrys sample lecture · Page ${i + 1} of ${PAGES.length}`, { x: M, y, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
    y -= 34;
    for (const l of wrap(p.title, 20, bold)) {
      page.drawText(l, { x: M, y, size: 20, font: bold, color: rgb(0.05, 0.37, 0.33) });
      y -= 26;
    }
    y -= 10;
    for (const para of p.lines) {
      for (const l of wrap(para, 12.5)) {
        page.drawText(l, { x: M, y, size: 12.5, font, color: rgb(0.12, 0.12, 0.12) });
        y -= 18;
      }
      y -= 12;
    }
  });
  const b64 = await pdf.saveAsBase64();
  const name = `Sample - ${SAMPLE_TITLE}.pdf`;
  let uri = `data:application/pdf;base64,${b64}`;
  if (Platform.OS !== 'web') {
    const dir = new Directory(Paths.document, 'materials');
    dir.create({ intermediates: true, idempotent: true });
    const f = new File(dir, `sample-${Date.now().toString(36)}.pdf`);
    f.write(b64, { encoding: 'base64' });
    uri = f.uri;
  }
  return { id: uid(), name, uri, size: Math.round((b64.length * 3) / 4), mime: 'application/pdf', sample: true };
}

/** A brain dump with right ideas, missing ones and one wrong one (rereading is NOT the best way). */
export const SAMPLE_RECALL =
  'Memory has three stages: encoding, storage and retrieval. Short-term memory only holds a few things, around 7, for a short time, and long-term memory can hold a lot for a long time. Ebbinghaus found that we forget fast right after learning, that is the forgetting curve. The best way to remember for an exam is to reread your notes and highlight them many times. Testing yourself helps a bit too.';

/** Question by question: one right, one almost, one wrong, and round again. */
export function sampleAnswer(q: ActiveQuestion, i: number): string {
  const ideal = q.ideal.trim();
  if (i % 3 === 0) return ideal;
  if (i % 3 === 1) {
    const words = ideal.split(/\s+/);
    return words.slice(0, Math.max(4, Math.ceil(words.length * 0.55))).join(' ').replace(/[,;:]$/, '') + '.';
  }
  return 'I think the main thing is to read the notes again and again until they feel familiar.';
}

/** Types `text` out quickly, as if someone were writing it. Returns a function that stops it. */
export function typeOut(text: string, onText: (t: string) => void, onDone?: () => void) {
  let n = 0;
  const t = setInterval(() => {
    n = Math.min(text.length, n + 3);
    onText(text.slice(0, n));
    if (n >= text.length) {
      clearInterval(t);
      onDone?.();
    }
  }, 16);
  return () => clearInterval(t);
}

/** Is the running session on the sample lecture? (Only then is "Fill sample answer" offered.) */
export const onSample = (s: { session?: { subjectId: string; chapterId: string; materialId?: string }; subjects: { id: string; chapters: { id: string; materials: Material[] }[] }[] }) =>
  !!s.session?.materialId &&
  !!s.subjects
    .find((x) => x.id === s.session!.subjectId)
    ?.chapters.find((c) => c.id === s.session!.chapterId)
    ?.materials.find((m) => m.id === s.session!.materialId)?.sample;
