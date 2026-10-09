import { Directory, File, Paths } from 'expo-file-system';
import { PDFDocument } from 'pdf-lib';
import { Platform } from 'react-native';

import type { Analysis, Context } from '@/lib/ai';
import { useApp } from '@/store';

/** A picked PDF lives in the cache, which Android may clear: copy it into the app's own documents
 *  so Coco can still read the lecture weeks later. Falls back to the picked copy if anything fails. */
export async function keepFile(uri: string): Promise<string> {
  if (Platform.OS === 'web') return uri;
  try {
    const dir = new Directory(Paths.document, 'materials');
    dir.create({ intermediates: true, idempotent: true });
    const dest = new File(dir, `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.pdf`);
    await new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}

/** Upload limits. The AI takes at most ~20 MB per request, and one chapter rarely runs past 40 pages —
 *  so a free tree can't be "5 chapters in one file"; Pro gets roomier chapters. */
export const PDF_LIMITS = { maxMB: 15, freePages: 40, proPages: 150 };

async function pdfPages(uri: string): Promise<number | undefined> {
  try {
    const b64 =
      Platform.OS === 'web'
        ? await (async () => {
            const blob = await (await fetch(uri)).blob();
            return new Promise<string>((res, rej) => {
              const r = new FileReader();
              r.onload = () => res(String(r.result).split(',')[1] ?? '');
              r.onerror = () => rej(r.error);
              r.readAsDataURL(blob);
            });
          })()
        : await new File(uri).base64();
    return (await PDFDocument.load(b64, { ignoreEncryption: true, updateMetadata: false })).getPageCount();
  } catch {
    return undefined; // unreadable: let the size check decide
  }
}

/** Returns a reason the file can't be used, or undefined if it's fine. `chapter`: a lecture file (page limit applies). */
export async function checkPdf(f: { uri: string; size?: number | null }, opts: { chapter: boolean; isPro: boolean }): Promise<string | undefined> {
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
const pageCounts = new Map<string, number>();

async function readBase64(uri: string): Promise<string> {
  if (Platform.OS !== 'web') return new File(uri).base64();
  const blob = await (await fetch(uri)).blob();
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

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
  let why = '';
  if (withPdf && mat) {
    const key = `${mat.uri}#${d.fromPage}-${d.toPage}`;
    pdfBase64 = cache.get(key);
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
    pageCount: pdfBase64 ? pageCounts.get(`${mat?.uri}#${d.fromPage}-${d.toPage}`) : undefined,
    course,
    fromPage: d.fromPage,
    toPage: d.toPage,
    interests: s.coco.memory ? s.profile.interests : [],
    style: { friendly: 'friendly coach', calm: 'calm tutor', direct: 'direct & focused', playful: 'playful buddy' }[s.coco.style],
    depth: s.coco.depth,
  };
}

/** A light context (no lecture file, no running session): for chats about a single card, memory hooks and level-ups. */
export function cardContext(subjectId: string): Context {
  const st = useApp.getState();
  const subject = st.subjects.find((x) => x.id === subjectId);
  return {
    subject: subject?.name ?? 'General',
    chapter: '',
    interests: st.coco.memory ? st.profile.interests : [],
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
