import { Directory, File, Paths } from 'expo-file-system';
import { PDFDocument } from 'pdf-lib';
import { Platform } from 'react-native';

import { readFileBase64 } from '@/lib/readfile';
import { countSlides, isOldPpt, isSlides, readSlides, type Slide } from '@/lib/slides';
import type { Analysis, Context } from '@/lib/ai';
import { TYPE_LABEL } from '@/lib/qloo';
import { useApp, type QResult, type SessionDraft, type WorldItem } from '@/store';

/** A picked file lives in the cache, which Android may clear: copy it into the app's own documents
 *  so Coco can still read the lecture weeks later. Falls back to the picked copy if anything fails.
 *  `name`: the picked file's name, so a PowerPoint keeps its .pptx ending. */
export async function keepFile(uri: string, name?: string): Promise<string> {
  if (Platform.OS === 'web') return uri;
  try {
    const dir = new Directory(Paths.document, 'materials');
    dir.create({ intermediates: true, idempotent: true });
    const ext = /\.(pptx|ppsx)$/i.exec(name ?? '')?.[1]?.toLowerCase() ?? 'pdf';
    const dest = new File(dir, `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`);
    const kind = ext === 'pdf' ? undefined : 'zip';
    try {
      await new File(uri).copy(dest);
    } catch {
      dest.write(await readFileBase64(uri, kind), { encoding: 'base64' }); // the copy was refused: write it from the content
    }
    // a PowerPoint must still open from the kept copy; if it doesn't, write it again from the picked file
    if (kind && !countSlides(await readFileBase64(dest.uri, kind).catch(() => ''))) dest.write(await readFileBase64(uri, kind), { encoding: 'base64' });
    return dest.uri;
  } catch {
    return uri;
  }
}

/** Some phones describe a real .pptx as the old .ppt format (or drop the file ending). Look at the file itself:
 *  a .pptx is a zip with slides inside, so it gets its proper name and type and is treated as a PowerPoint. */
export async function realType<T extends { uri: string; name?: string | null; mimeType?: string | null }>(f: T): Promise<T> {
  if (isSlides(f) || !isOldPpt(f)) return f;
  try {
    if (!countSlides(await readFileBase64(f.uri, 'zip'))) return f;
  } catch {
    return f; // not a zip: really the old format
  }
  const name = `${(f.name ?? 'Lecture').replace(/\.(ppt|pps)$/i, '')}.pptx`;
  return { ...f, name, mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
}

/** Upload limits. The AI takes at most ~20 MB per request, and one chapter rarely runs past 40 pages —
 *  so a free tree can't be "5 chapters in one file"; Pro gets roomier chapters. */
export const PDF_LIMITS = { maxMB: 15, freePages: 40, proPages: 150 };

async function pdfPages(uri: string): Promise<number | undefined> {
  try {
    const b64 = await readFileBase64(uri);
    return (await PDFDocument.load(b64, { ignoreEncryption: true, updateMetadata: false })).getPageCount();
  } catch {
    return undefined; // unreadable: let the size check decide
  }
}

/** How many pages a lecture file has (slides for a PowerPoint, counted the way readSlides numbers them). */
export async function fileLength(m: { uri: string; name?: string | null; mime?: string | null }): Promise<number | undefined> {
  if (isSlides(m)) {
    try {
      return countSlides(await readFileBase64(m.uri, 'zip'));
    } catch {
      return undefined;
    }
  }
  return pdfPages(m.uri);
}

/** A slide holds far less than a PDF page, so a deck may have more slides than a PDF has pages. */
export const SLIDE_LIMITS = { maxMB: 40, freeSlides: 80, proSlides: 300 };

/** Returns a reason the file can't be used, or undefined if it's fine. `chapter`: a lecture file (page limit applies).
 *  `name` / `mimeType`: the picked file's, to tell a PowerPoint from a PDF. */
export async function checkPdf(
  f: { uri: string; size?: number | null; name?: string | null; mimeType?: string | null },
  opts: { chapter: boolean; isPro: boolean },
): Promise<string | undefined> {
  if (isOldPpt(f) && !isSlides(f)) return 'This is an old PowerPoint file (.ppt). Open it in PowerPoint and choose Save As → .pptx (or PDF), then upload that.';
  if (isSlides(f)) {
    if (!opts.chapter) return 'Upload the syllabus and past papers as PDF. PowerPoint works for lecture slides.';
    if (f.size && f.size > SLIDE_LIMITS.maxMB * 1e6) return `This deck is ${(f.size / 1e6).toFixed(0)} MB. Decks up to ${SLIDE_LIMITS.maxMB} MB work — in PowerPoint use File → Compress Pictures, or save it as PDF.`;
    let n: number | undefined;
    try {
      n = countSlides(await readFileBase64(f.uri, 'zip'));
    } catch {}
    if (!n) return 'Drrys could not open this PowerPoint file. Save it again as .pptx (or as PDF) and upload that.';
    const maxS = opts.isPro ? SLIDE_LIMITS.proSlides : SLIDE_LIMITS.freeSlides;
    if (n > maxS)
      return opts.isPro
        ? `This deck has ${n} slides. One chapter can have up to ${maxS} — split it into chapters, one branch each.`
        : `This deck has ${n} slides. On the free plan a chapter can have up to ${maxS} slides — one chapter per branch. Drrys Pro gives you 5 branches per tree.`;
    return undefined;
  }
  if (f.size && f.size > PDF_LIMITS.maxMB * 1e6) return `This file is ${(f.size / 1e6).toFixed(0)} MB. Files up to ${PDF_LIMITS.maxMB} MB work best — try exporting it again with smaller images.`;
  if (!opts.chapter) return undefined;
  const max = opts.isPro ? PDF_LIMITS.proPages : PDF_LIMITS.freePages;
  const n = await pdfPages(f.uri);
  if (n && n > max)
    return opts.isPro
      ? `This file has ${n} pages. One chapter can have up to ${max} — split it into chapters, one branch each.`
      : `This file has ${n} pages. On the free plan a chapter can have up to ${max} pages — one chapter per branch. Drrys Pro gives you 5 branches per tree.`;
  return undefined;
}

/** Keep pages from..to (1-based) of a PDF. If the pages cannot be cut out it throws: the whole file must never
 *  be sent instead (the session would then use pages the student did not choose). */
async function slicePages(base64: string, from?: number, to?: number): Promise<{ data: string; pages: number }> {
  const src = await PDFDocument.load(base64, { ignoreEncryption: true });
  const n = src.getPageCount();
  const a = Math.max(1, Math.min(n, from ?? 1));
  const b = Math.max(a, Math.min(n, to ?? n));
  if (a === 1 && b === n) return { data: base64, pages: n };
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i));
  pages.forEach((p) => out.addPage(p));
  return { data: await out.saveAsBase64(), pages: b - a + 1 };
}

const cache = new Map<string, string>();
const slideCache = new Map<string, Slide[]>();
const pageCounts = new Map<string, number>();

const readBase64 = readFileBase64;

/** Syllabus + up to 2 past papers (first 20 pages each), so Coco can aim at what's examinable.
 *  Kept small: the whole request must stay under the AI's ~20 MB limit. */
async function courseFiles(files: { name: string; uri: string }[]): Promise<{ label: string; data: string }[]> {
  const out: { label: string; data: string }[] = [];
  for (const f of files) {
    const key = `${f.uri}#course`;
    let data = cache.get(key);
    if (!data) {
      try {
        data = (await slicePages(await readBase64(f.uri), 1, 20)).data;
        cache.set(key, data);
      } catch {
        continue;
      }
    }
    if (data.length < 5_500_000) out.push({ label: f.name, data }); // ~4 MB each at most
  }
  return out;
}

/** Everything Coco needs to know about the current session. */
export async function sessionContext(withPdf = true): Promise<Context> {
  const s = useApp.getState();
  const d = s.session!;
  const subject = s.subjects.find((x) => x.id === d.subjectId);
  const chapter = subject?.chapters.find((c) => c.id === d.chapterId);
  const mat = chapter?.materials.find((m) => m.id === d.materialId);
  let pdfBase64: string | undefined;
  let slides: Slide[] | undefined;
  let why = '';
  if (withPdf && mat && isSlides(mat)) {
    // a PowerPoint: the chosen slides' text, notes and pictures (one slide = one page)
    const key = `${mat.uri}#${d.fromPage}-${d.toPage}`;
    slides = slideCache.get(key);
    if (!slides) {
      try {
        slides = readSlides(await readFileBase64(mat.uri, 'zip'), d.fromPage, d.toPage);
        slideCache.set(key, slides);
      } catch (e) {
        why = String((e as Error)?.message ?? e).slice(0, 90);
      }
    }
    if (!slides?.length) throw new Error(`File problem${why ? ` (${why})` : ''}: Drrys could not read your slides, so it did not start. Re-add the file and try again.`);
  } else if (withPdf && mat) {
    const key = `${mat.uri}#${d.fromPage}-${d.toPage}`;
    pdfBase64 = cache.get(key);
    if (!pdfBase64) {
      try {
        pdfBase64 = await readFileBase64(mat.uri);
        // send only the pages this session covers: a much smaller upload and far fewer tokens → faster
        const cut = await slicePages(pdfBase64, d.fromPage, d.toPage);
        pdfBase64 = cut.data;
        cache.set(key, pdfBase64);
        pageCounts.set(key, cut.pages);
      } catch (e) {
        pdfBase64 = undefined;
        why = String((e as Error)?.message ?? e).slice(0, 90);
      }
    }
    // the student chose a file, but its pages could not be prepared: stop here. Never carry on from general
    // knowledge or from the wrong pages: everything in a session must come from the chosen pages.
    if (!pdfBase64) throw new Error(`File problem${why ? ` (${why})` : ''}: Drrys could not read your pages, so it did not start. Re-add the file and try again.`);
  }
  let course: { label: string; data: string }[] = [];
  if (withPdf && subject) {
    const list = [
      ...(subject.syllabus ? [{ name: `COURSE SYLLABUS (${subject.syllabus.name})`, uri: subject.syllabus.uri }] : []),
      ...(subject.pastPapers ?? []).slice(-2).map((p) => ({ name: `PAST EXAM PAPER (${p.name})`, uri: p.uri })),
    ];
    course = await courseFiles(list);
  }
  return {
    subject: subject?.name ?? 'General',
    chapter: chapter?.title ?? 'Chapter',
    pdfBase64,
    slides,
    pageCount: slides ? slides.length : pdfBase64 ? pageCounts.get(`${mat?.uri}#${d.fromPage}-${d.toPage}`) : undefined,
    course,
    fromPage: d.fromPage,
    toPage: d.toPage,
    interests: tasteOf(s),
    style: { friendly: 'friendly coach', calm: 'calm tutor', direct: 'direct & focused', playful: 'playful buddy' }[s.coco.style],
    depth: s.coco.depth,
  };
}

/** What the student loves, for Coco's analogies and hooks: each pick with its kind and what it is about
 *  (its Qloo tags), so an analogy rests on what the show / team / song really is, not on a guess. */
export function tasteOf(st: { coco: { memory: boolean }; profile: { interests: string[] }; world: { picks: WorldItem[] } }): string[] {
  if (!st.coco.memory) return [];
  if (!st.world.picks.length) return st.profile.interests;
  return st.world.picks.slice(0, 6).map((p) => {
    const about = (p.tags ?? []).slice(0, 4).join(', ');
    return `${p.name} (${TYPE_LABEL[p.type]}${about ? `; about: ${about}` : ''})`;
  });
}

/** A light context (no lecture file, no running session): for chats about a single card, memory hooks and level-ups. */
export function cardContext(subjectId: string): Context {
  const st = useApp.getState();
  const subject = st.subjects.find((x) => x.id === subjectId);
  return {
    subject: subject?.name ?? 'General',
    chapter: '',
    interests: tasteOf(st),
    style: { friendly: 'friendly coach', calm: 'calm tutor', direct: 'direct & focused', playful: 'playful buddy' }[st.coco.style],
    depth: st.coco.depth,
  };
}

/** What the student missed or mixed up (de-duplicated, at most 8). The "Organize" step shows when there are 4 or more. */
export const ORGANIZE_MIN = 4;
export function missedIdeas(a?: Analysis): { id: string; title: string; detail: string }[] {
  const raw = [
    ...(a?.forgotten ?? []).map((f) => ({ title: f.title, detail: f.detail })),
    ...(a?.corrections ?? []).map((c) => ({ title: c.concept, detail: c.truth })),
  ];
  const seen = new Set<string>();
  return raw
    .filter((x) => x.title && !seen.has(x.title.toLowerCase()) && !!seen.add(x.title.toLowerCase()))
    .slice(0, 8)
    .map((x, i) => ({ id: String(i), ...x }));
}

/** Keep the result of question `i`. The answers, the score and the gap cards are worked out again from all results,
 *  so a question answered, left and come back to is never counted twice. */
export function saveResult(i: number, r: QResult | ((old: QResult) => QResult)) {
  const st = useApp.getState().session;
  if (!st) return;
  const results = [...(st.results ?? [])];
  while (results.length <= i) results.push(null);
  const prev = results[i];
  if (typeof r === 'function') {
    if (!prev) return;
    results[i] = r(prev);
  } else results[i] = r;
  const done = results.filter((x): x is QResult => !!x);
  useApp.getState().patchSession({
    results,
    answers: done.map((x) => x.summary),
    correct: done.reduce((n, x) => n + (x.grade.correct ? 1 : x.grade.close ? 0.5 : 0), 0), // "almost" counts as half
    gapCards: done.flatMap((x) => (x.gap ? [x.gap] : [])),
  });
}

/** The first question not answered yet (= the number of questions when all are answered). */
export const firstOpen = (s?: SessionDraft) => {
  const n = s?.questions?.length ?? 0;
  for (let k = 0; k < n; k++) if (!s?.results?.[k]) return k;
  return n;
};

const RESUME_MS = 3 * 86_400_000;
/** An unfinished session on this chapter that already reached the questions: the question to open again, or undefined. */
export function resumeAt(s: SessionDraft | undefined, subjectId: string, chapterId: string): number | undefined {
  if (!s || s.result || s.subjectId !== subjectId || s.chapterId !== chapterId || !s.questions?.length) return undefined;
  if (Date.now() - s.startedAt > RESUME_MS) return undefined;
  return Math.min(s.qIndex ?? firstOpen(s), s.questions.length - 1);
}
