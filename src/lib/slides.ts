// PowerPoint lectures. Neither Claude nor Gemini reads a .pptx, so the deck is opened here (a .pptx is a zip of
// XML files): each slide's text, its speaker notes and its pictures go to Coco instead of a PDF. One slide = one page,
// so page ranges, page limits and "src" grounding work exactly as they do for a PDF.
import { strFromU8, unzipSync, type Unzipped } from 'fflate';

/** What the file pickers accept for a lecture. */
export const LECTURE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.openxmlformats-officedocument.presentationml.slideshow', // .ppsx
  'application/vnd.ms-powerpoint', // .ppt: picked only to explain that it must be saved as .pptx
];

export const isSlides = (f: { name?: string | null; mime?: string | null; mimeType?: string | null }) =>
  /presentationml/.test(f.mime ?? f.mimeType ?? '') || /\.(pptx|ppsx)$/i.test(f.name ?? '');

/** The old binary PowerPoint format (before 2007): it can't be opened here. */
export const isOldPpt = (f: { name?: string | null; mime?: string | null; mimeType?: string | null }) =>
  /ms-powerpoint/.test(f.mime ?? f.mimeType ?? '') || /\.(ppt|pps)$/i.test(f.name ?? '');

export type SlideImage = { mime: 'image/png' | 'image/jpeg' | 'image/webp'; data: string };
export type Slide = { page: number; slide: number; text: string; images: SlideImage[] };

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_IDX = new Uint8Array(128);
for (let i = 0; i < 64; i++) B64_IDX[B64.charCodeAt(i)] = i;

function fromBase64(s: string): Uint8Array {
  s = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const a = B64_IDX[s.charCodeAt(i)], b = B64_IDX[s.charCodeAt(i + 1)];
    const c = B64_IDX[s.charCodeAt(i + 2)], d = B64_IDX[s.charCodeAt(i + 3)];
    out[o++] = (a << 2) | (b >> 4);
    if (i + 2 < s.length) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < s.length) out[o++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, o);
}

function toBase64(u: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < u.length; i += 3) {
    const a = u[i], b = u[i + 1] ?? 0, c = u[i + 2] ?? 0;
    parts.push(B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)] + (i + 1 < u.length ? B64[((b & 15) << 2) | (c >> 6)] : '=') + (i + 2 < u.length ? B64[c & 63] : '='));
  }
  return parts.join('');
}

const unescapeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

/** The text of a slide (or notes / SmartArt / chart) XML, one line per paragraph. */
function xmlText(xml: string): string {
  const body = xml.replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, ''); // equations come twice: keep the real one
  const lines: string[] = [];
  for (const p of body.match(/<a:p>[\s\S]*?<\/a:p>|<a:p [\s\S]*?<\/a:p>/g) ?? []) {
    const runs = [...p.matchAll(/<(a|m):t(?:\s[^>]*)?>([\s\S]*?)<\/\1:t>/g)].map((m) => unescapeXml(m[2]));
    const line = runs.join('').replace(/\s+/g, ' ').trim();
    if (line) lines.push(line);
  }
  return lines.join('\n');
}

/** Relationship id → target path (resolved against the part's folder). */
function rels(files: Unzipped, part: string): Map<string, { type: string; path: string }> {
  const dir = part.slice(0, part.lastIndexOf('/'));
  const relPath = `${dir}/_rels/${part.slice(dir.length + 1)}.rels`;
  const out = new Map<string, { type: string; path: string }>();
  const raw = files[relPath];
  if (!raw) return out;
  for (const m of strFromU8(raw).matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
    const type = /\bType="([^"]+)"/.exec(m[0])?.[1] ?? '';
    const target = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    if (!id || !target || /TargetMode="External"/.test(m[0])) continue;
    const stack = target.startsWith('/') ? [] : dir.split('/');
    for (const seg of target.replace(/^\//, '').split('/')) {
      if (seg === '..') stack.pop();
      else if (seg !== '.') stack.push(seg);
    }
    out.set(id, { type: type.slice(type.lastIndexOf('/') + 1), path: stack.join('/') });
  }
  return out;
}

const isXml = (name: string) => name.endsWith('.xml') || name.endsWith('.rels');

/** The deck's visible slides, in the order they are shown. */
function slideOrder(files: Unzipped): string[] {
  const pres = files['ppt/presentation.xml'];
  if (!pres) throw new Error('This PowerPoint file looks damaged (no slides found)');
  const r = rels(files, 'ppt/presentation.xml');
  const ids = [...strFromU8(pres).matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)].map((m) => r.get(m[1])?.path).filter((p): p is string => !!p && !!files[p]);
  return ids.filter((p) => !/<p:sld\b[^>]*\bshow="0"/.test(strFromU8(files[p]).slice(0, 2000))); // hidden slides are skipped
}

const decks = new Map<string, Uint8Array>();
const bytesOf = (base64: string) => {
  const key = `${base64.length}:${base64.slice(0, 64)}:${base64.slice(-64)}`;
  let b = decks.get(key);
  if (!b) {
    b = fromBase64(base64);
    decks.clear(); // one deck at a time is plenty, and they can be large
    decks.set(key, b);
  }
  return b;
};

/** Number of (visible) slides in a deck, or undefined if it can't be opened. */
export function countSlides(base64: string): number | undefined {
  try {
    return slideOrder(unzipSync(bytesOf(base64), { filter: (f) => isXml(f.name) })).length;
  } catch {
    return undefined;
  }
}

// Kept well under both AIs' request limits (Claude: 5 MB per picture; Gemini: ~20 MB for the whole request).
const MAX_IMAGES = 16;
const MAX_IMAGE_BYTES = 3_500_000;
const MAX_ALL_IMAGES = 9_000_000;
const MIN_IMAGE_BYTES = 4_000; // bullets, icons and lines say nothing about the lecture

/** Slides from..to (1-based, visible slides only): text, speaker notes and pictures, numbered as pages 1..N.
 *  Throws if the deck can't be opened. */
export function readSlides(base64: string, from?: number, to?: number): Slide[] {
  const bytes = bytesOf(base64);
  const xml = unzipSync(bytes, { filter: (f) => isXml(f.name) });
  const order = slideOrder(xml);
  if (!order.length) throw new Error('This PowerPoint file has no slides');
  const a = Math.max(1, Math.min(order.length, from ?? 1));
  const b = Math.max(a, Math.min(order.length, to ?? order.length));

  // a picture used on 3+ slides is a logo or a background, not lecture content
  const uses = new Map<string, number>();
  const parsed = order.map((part) => {
    const src = strFromU8(xml[part]);
    const r = rels(xml, part);
    const pics = [...new Set([...src.matchAll(/<a:blip\b[^>]*\br:embed="([^"]+)"/g)].map((m) => r.get(m[1])?.path).filter((p): p is string => !!p))];
    pics.forEach((p) => uses.set(p, (uses.get(p) ?? 0) + 1));
    return { part, src, r, pics };
  });

  const chosen = parsed.slice(a - 1, b);
  const wanted = new Set(chosen.flatMap((s) => s.pics).filter((p) => (uses.get(p) ?? 0) < 3 && /\.(png|jpe?g|webp)$/i.test(p)));
  const media = wanted.size
    ? unzipSync(bytes, { filter: (f) => wanted.has(f.name) && f.originalSize >= MIN_IMAGE_BYTES && f.originalSize <= MAX_IMAGE_BYTES })
    : {};

  let count = 0;
  let total = 0;
  const sent = new Set<string>();
  return chosen.map((s, i) => {
    const extra: string[] = [];
    for (const { type, path } of s.r.values()) {
      if (!xml[path]) continue;
      if (type === 'diagramData' || type === 'chart') extra.push(xmlText(strFromU8(xml[path]))); // SmartArt and chart text
    }
    const notesPath = [...s.r.values()].find((x) => x.type === 'notesSlide')?.path;
    const notes = notesPath && xml[notesPath] ? xmlText(strFromU8(xml[notesPath])).split('\n').filter((l) => !/^\d+$/.test(l)).join('\n') : '';
    const text = [xmlText(s.src), ...extra.filter(Boolean), notes && `Speaker notes:\n${notes}`].filter(Boolean).join('\n');
    const images: SlideImage[] = [];
    for (const p of s.pics) {
      const data = media[p];
      if (!data || sent.has(p) || count >= MAX_IMAGES || total + data.length > MAX_ALL_IMAGES) continue;
      sent.add(p);
      count++;
      total += data.length;
      const ext = p.slice(p.lastIndexOf('.') + 1).toLowerCase();
      images.push({ mime: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg', data: toBase64(data) });
    }
    return { page: i + 1, slide: order.indexOf(s.part) + 1, text, images };
  });
}
