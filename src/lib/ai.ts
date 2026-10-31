/**
 * Coco's brain — one thin client, two providers:
 *   - Google Gemini — the free-tier option, used by default
 *   - Claude — used when EXPO_PUBLIC_COCO_AI=claude
 * Both read the lecture PDF natively; a PowerPoint is opened in the app first (lib/slides) and sent as text + pictures.
 * With EXPO_PUBLIC_COCO_AI=demo (or no server), every call falls back to a hand-written demo session so the app is
 * still fully explorable (e.g. by judges).
 *
 * The AI keys never ship in the app: every call goes through Drrys' server function (supabase/functions/ai),
 * which holds the keys as Supabase secrets.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PDFDocument } from 'pdf-lib';

import { cloudEnabled, fetchFunction } from './cloud';
import { DEMO } from './demo';
import { plainMath } from './plain';
import { readFileBase64 } from './readfile';
import type { Slide } from './slides';

const MODEL = process.env.EXPO_PUBLIC_CLAUDE_MODEL || 'claude-sonnet-5-5';
const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.5-flash';
const CHOICE = (process.env.EXPO_PUBLIC_COCO_AI || 'gemini').toLowerCase();

export const aiProvider: 'claude' | 'gemini' | null = !cloudEnabled || CHOICE === 'demo' ? null : CHOICE === 'claude' ? 'claude' : 'gemini';
export const aiEnabled = aiProvider !== null;
/** Shown in Profile → "Coco's brain". */
export const aiLabel = aiProvider === 'claude' ? 'Claude AI · live' : aiProvider === 'gemini' ? 'Gemini AI · live' : 'Demo mode';

export type Concept = { title: string; detail: string; tag: string; why?: string }; // why: where this idea matters (exam / real use)
export type Correction = { concept: string; youSaid: string; truth: string; formula?: string };
export type Analysis = {
  summary: string;
  nailed: Concept[];
  forgotten: (Concept & { page?: string })[];
  corrections: Correction[];
  keywords: string[]; // words from the recall that were correct (highlighted in the UI)
};
/** How the idea is best practised (PACER): conceptual = how ideas relate · procedural = steps / working it out ·
 *  analogous = a comparison and where it breaks · evidence = using a fact or example on a new case. */
export type QKind = 'conceptual' | 'procedural' | 'analogous' | 'evidence';
/** How the student answers: explain (type / say it) · order (drag steps into sequence) · sort (drag items into groups) ·
 *  match (connect pairs) · blank (fill the gaps of a sentence from a word bank) · work (solve on paper: type or sketch).
 *  order / sort / match / blank are marked by the app itself. */
export type QFormat = 'explain' | 'order' | 'sort' | 'match' | 'work' | 'blank';
export type ActiveQuestion = {
  q: string;
  hint: string;
  ideal: string;
  kind?: QKind;
  format?: QFormat;
  steps?: string[]; // order: the right sequence
  buckets?: { name: string; items: string[] }[]; // sort
  pairs?: { left: string; right: string }[]; // match
  text?: string; // blank: a sentence from the lecture; the words to fill in are written [[like this]]
  extras?: string[]; // blank: extra (wrong) words in the word bank
  figure?: FigureRef; // the picture of the lecture this question is about (chosen by the AI)
  page?: number; // the page of the session's lecture pages (1 = the first chosen page) where the answer is written
  picture?: QPicture; // that picture, cut out and saved, shown under the question
  idea?: string; // the idea of the lecture map this question practises (to know which gaps got a question)
};
/** Where a question's picture is in the lecture: the page, and on a PDF page the box around it ([top, left, bottom, right],
 *  0–1000 of the page, the way Gemini gives boxes); on a slide, which of the slide's pictures it is (1 = the first). */
export type FigureRef = { page: number; box?: number[]; image?: number };
/** A question's picture, ready to show: a saved file (a data URI on the web) and its width / height, when known. */
export type QPicture = { uri: string; ratio?: number };
export type GroupCheck = { groups: { name: string; ok: boolean; note: string }[]; overall: string };
/** `card`: when the answer shows a gap, one flashcard aimed at exactly what the student didn't get. */
export type Grade = { correct: boolean; close?: boolean; feedback: string; card?: FlashCard | null };
export type FlashCard = { q: string; a: string };

export type Context = {
  subject: string;
  chapter: string;
  pdfBase64?: string;
  slides?: Slide[]; // a PowerPoint lecture instead of a PDF: the chosen slides, numbered as pages 1..N
  course?: { label: string; data: string }[]; // syllabus / past papers: guide what to ask, never new content
  fromPage?: number;
  toPage?: number;
  pageCount?: number; // pages in the document sent (page 1 = the first page of the chosen range)
  interests: string[];
  style: string;
  depth: string;
};

type Block =
  | { type: 'text'; text: string }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/png' | 'image/jpeg' | 'image/webp'; data: string } } // a student's sketch, or a picture to check
  | { type: 'audio'; mime: string; data: string }; // Gemini only (voice → text)

/* ---------- timing: how long each request takes (shown in the Metro console as [timing] lines) ---------- */

/** One timed step: an AI request (with its model and tokens) or a step without AI (reading the file, cutting pictures). */
export type Timing = { label: string; ms: number; ok: boolean; model?: string; note?: string; inTokens?: number; outTokens?: number; thinkTokens?: number; cutOff?: boolean; at: number };
/** The last 50 timed steps, newest last. */
export const timings: Timing[] = [];

export function logTiming(t: Omit<Timing, 'at'>) {
  timings.push({ ...t, at: Date.now() });
  if (timings.length > 50) timings.shift();
  const tokens = t.inTokens != null ? ` · in ${t.inTokens} / out ${t.outTokens ?? 0} / thinking ${t.thinkTokens ?? 0} tokens` : '';
  console.log(`[timing] ${t.label}${t.model ? ` · ${t.model}` : ''} · ${(t.ms / 1000).toFixed(1)}s · ${t.ok ? 'ok' : 'failed'}${tokens}${t.cutOff ? ' · CUT OFF (hit the length limit)' : ''}${t.note ? ` · ${t.note}` : ''}`);
}

/** Time a step that is not an AI request (one [timing] line when it ends). */
export async function timed<T>(label: string, run: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    const out = await run();
    logTiming({ label, ms: Date.now() - t0, ok: true });
    return out;
  } catch (e) {
    logTiming({ label, ms: Date.now() - t0, ok: false, note: String((e as Error)?.message ?? e).slice(0, 120) });
    throw e;
  }
}

/** `json`: the answer must be JSON (Gemini is then held to it, so it can't come back as prose or broken). */
async function call(system: string, content: Block[], maxTokens = 2000, label = 'ai', json = false): Promise<string> {
  return aiProvider === 'gemini' ? callGemini(system, content, maxTokens, { label, json }) : callClaude(system, content, maxTokens, label);
}

async function callClaude(system: string, content: Block[], maxTokens: number, label = 'ai'): Promise<string> {
  const t0 = Date.now();
  const res = await fetchFunction('ai', { action: 'claude', model: MODEL, max_tokens: maxTokens, system, content });
  if (!res.ok) {
    logTiming({ label, model: MODEL, ms: Date.now() - t0, ok: false, note: `status ${res.status}` });
    throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = await res.json();
  logTiming({ label, model: MODEL, ms: Date.now() - t0, ok: true, inTokens: json.usage?.input_tokens, outTokens: json.usage?.output_tokens, cutOff: json.stop_reason === 'max_tokens' });
  return (json.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Gemini generateContent: the PDF goes in as inline data, the persona as the system instruction.
// Free-tier traffic is often turned away ("high demand" 503) or rate-limited (429), and a model can hang. So:
//  - each request walks down a chain of Flash models, the stable one first,
//  - a model that fails is benched (circuit breaker): 2 minutes, then 10, then 30 if it keeps failing,
//    remembered across app restarts, cleared the moment it answers again,
//  - the model that last worked is tried first,
//  - hedging: if the model is slower than usual, the next one is asked too and the first answer wins
//    (the other is stopped), so one hanging model costs seconds, not a 30-second timeout,
//  - thinking is kept low: Coco's tasks don't need long deliberation, and it's much faster.
const GEMINI_CHAIN = [...new Set([GEMINI_MODEL, 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'])];
const RETRYABLE = new Set([404, 408, 429, 500, 503, 504]);
const cooldown = new Map<string, number>(); // model -> skip until (ms)
const strikes = new Map<string, number>(); // model -> failures in a row
const BENCH_MS = [120000, 600000, 1800000];
const HEALTH_KEY = 'drrys.ai-health';
let lastGood: string | undefined;
let lastVoiceGood: string | undefined; // same idea for the transcription chain
const noThinking = new Set<string>(); // models that rejected the thinking setting

AsyncStorage.getItem(HEALTH_KEY)
  .then((raw) => {
    const saved = raw ? (JSON.parse(raw) as { until: [string, number][]; strikes: [string, number][] }) : undefined;
    saved?.until.forEach(([m, t]) => t > Date.now() && !cooldown.has(m) && cooldown.set(m, t));
    saved?.strikes.forEach(([m, n]) => !strikes.has(m) && strikes.set(m, n));
  })
  .catch(() => {});
const saveHealth = () => AsyncStorage.setItem(HEALTH_KEY, JSON.stringify({ until: [...cooldown], strikes: [...strikes] })).catch(() => {});

/** The model failed: bench it, longer each time it fails again. */
function bench(model: string, ms?: number) {
  const n = Math.min((strikes.get(model) ?? 0) + 1, BENCH_MS.length);
  strikes.set(model, n);
  cooldown.set(model, Date.now() + (ms ?? BENCH_MS[n - 1]));
  saveHealth();
}
/** The model answered: it is healthy again. */
function healthy(model: string) {
  if (!strikes.has(model) && !cooldown.has(model)) return;
  strikes.delete(model);
  cooldown.delete(model);
  saveHealth();
}

// Voice → text: the light Flash models (fast). Thinking is kept to a minimum — writing down speech needs no reasoning.
const TRANSCRIBE_CHAIN = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash']; // gemini-3.5-transcribe turned voice answers down (400)

type GeminiOpts = { chain?: string[]; thinking?: 'minimal' | 'low'; temperature?: number; timeoutMs?: number; label?: string; json?: boolean };

async function callGemini(system: string, content: Block[], maxTokens: number, opts: GeminiOpts = {}): Promise<string> {
  const parts = content.map((b) =>
    b.type === 'text'
      ? { text: b.text }
      : b.type === 'audio'
        ? { inline_data: { mime_type: b.mime, data: b.data } }
        : { inline_data: { mime_type: b.source.media_type, data: b.source.data } },
  );
  const bodyFor = (model: string) => ({
    action: 'gemini',
    model,
    request: {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        maxOutputTokens: maxTokens + (opts.thinking === 'minimal' ? 256 : 2048),
        temperature: opts.temperature ?? 0.6,
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
        ...(noThinking.has(model) ? {} : { thinkingConfig: { thinkingLevel: opts.thinking ?? 'low' } }),
      },
    },
  });
  const now = Date.now();
  const chain = opts.chain ?? GEMINI_CHAIN;
  const first = opts.chain ? lastVoiceGood : lastGood;
  const order = [...chain].sort((x, y) => (x === first ? -1 : y === first ? 1 : 0));
  const ready = order.filter((m) => (cooldown.get(m) ?? 0) < now);
  const tryList = ready.length ? ready : order; // everything cooling down → try anyway
  const hasPdf = content.some((b) => b.type === 'document') || content.filter((b) => b.type === 'image').length > 1; // a PDF or a slide deck
  const hasAudio = content.some((b) => b.type === 'audio');
  // how long a model may take before the next one is asked too, and before it is given up on
  const hedgeMs = hasPdf ? 90000 : hasAudio ? 15000 : 8000;
  const timeoutMs = opts.timeoutMs ?? (hasPdf ? 120000 : hasAudio ? 45000 : 20000);
  const label = opts.label ?? (opts.chain ? 'transcribe' : 'ai');
  const failed = (msg: string, fatal = false) => Object.assign(new Error(msg), { fatal });

  /** One model, start to finish. Throws when it can't answer (fatal: no other model would help either). */
  const ask = async (model: string, ctrl: AbortController): Promise<string> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        ctrl.abort();
      }, timeoutMs);
      const t0 = Date.now();
      try {
        const res = await fetchFunction('ai', bodyFor(model), ctrl.signal);
        if (res.ok) {
          const json = await res.json();
          const out = json.candidates?.[0]?.content?.parts ?? [];
          const text = out.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought).map((p: { text: string }) => p.text).join('');
          const use = json.usageMetadata ?? {};
          logTiming({ label, model, ms: Date.now() - t0, ok: !!text, inTokens: use.promptTokenCount, outTokens: use.candidatesTokenCount, thinkTokens: use.thoughtsTokenCount, cutOff: json.candidates?.[0]?.finishReason === 'MAX_TOKENS', note: text ? undefined : 'empty reply' });
          if (!text) throw failed(`${model}: empty reply`);
          healthy(model);
          if (opts.chain) lastVoiceGood = model;
          else lastGood = model;
          return text;
        }
        const errText = (await res.text()).slice(0, 300);
        const msg = `Gemini API ${res.status} (${model}): ${errText.slice(0, 160)}`;
        logTiming({ label, model, ms: Date.now() - t0, ok: false, note: `status ${res.status}, trying the next model` });
        if (res.status === 400 && /thinking/i.test(errText) && !noThinking.has(model)) {
          noThinking.add(model); // this model doesn't take the thinking setting — same model again without it
          continue;
        }
        // a special-purpose model may turn down this input (400): the next model in its chain can still do it
        if (opts.chain && res.status === 400 && !/API key/i.test(errText)) {
          bench(model, 600000);
          throw failed(msg);
        }
        if (!RETRYABLE.has(res.status)) throw failed(msg, true); // bad key / bad request — another model won't help
        bench(model);
        throw failed(msg);
      } catch (e) {
        if (e instanceof Error && 'fatal' in e) throw e;
        // stopped because another model answered first: nothing wrong with this one
        if (ctrl.signal.aborted && !timedOut) throw failed(`${model}: stopped`);
        // timed out (RN reports an aborted fetch as "Fetch request has been canceled") or the network dropped
        logTiming({ label, model, ms: Date.now() - t0, ok: false, note: timedOut ? 'timed out, trying the next model' : String((e as Error).message).slice(0, 80) });
        bench(model);
        throw failed(timedOut ? `${model}: timed out` : `${model}: ${(e as Error).message}`);
      } finally {
        clearTimeout(timer);
      }
    }
    throw failed(`${model}: no answer`);
  };

  // Start the first model; ask the next one when a model fails, or when the newest one is slower than hedgeMs.
  // The first answer wins and the others are stopped.
  return new Promise<string>((resolve, reject) => {
    const ctrls: AbortController[] = [];
    let next = 0;
    let running = 0;
    let settled = false;
    let last = '';
    let hedge: ReturnType<typeof setTimeout> | undefined;
    const finish = (run: () => void) => {
      settled = true;
      clearTimeout(hedge);
      ctrls.forEach((c) => c.abort());
      run();
    };
    const launch = () => {
      clearTimeout(hedge);
      if (settled) return;
      if (next >= tryList.length) {
        if (!running) finish(() => reject(new Error(last)));
        return;
      }
      const model = tryList[next++];
      const ctrl = new AbortController();
      ctrls.push(ctrl);
      running++;
      ask(model, ctrl).then(
        (text) => {
          running--;
          if (!settled) finish(() => resolve(text));
        },
        (e: Error & { fatal?: boolean }) => {
          running--;
          if (settled) return;
          last = e.message;
          if (e.fatal) finish(() => reject(e));
          else launch();
        },
      );
      if (next < tryList.length) {
        hedge = setTimeout(() => {
          logTiming({ label, model, ms: hedgeMs, ok: false, note: 'slower than usual, asking the next model too' });
          launch();
        }, hedgeMs);
      }
    };
    launch();
  });
}

function parseJSON<T>(raw: string): T {
  const start = raw.search(/[[{]/);
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
  return plainDeep(JSON.parse(raw.slice(start, end + 1))) as T;
}

/** Every string in a parsed reply, with LaTeX math turned into plain symbols (lib/plain). */
function plainDeep(v: unknown): unknown {
  if (typeof v === 'string') return plainMath(v);
  if (Array.isArray(v)) return v.map(plainDeep);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plainDeep(x)]));
  return v;
}

const persona = (c: Context) => `You are Coco, a warm clay-figure study buddy inside the Drrys app.
Drrys teaches with evidence-based methods (active recall, elaboration, spaced repetition) without the student having to know them.
Style: ${c.style}. Depth: ${c.depth}.
${c.interests.length ? `The student enjoys: ${c.interests.join(', ')}. You MAY use one of these for an analogy, but only now and then — when an idea is genuinely hard to picture. Most explanations need no hobby analogy; never force one into every answer.` : 'Do not assume any hobbies.'}
Subject: ${c.subject}. Chapter: ${c.chapter}.
STAY INSIDE THE STUDENT'S MATERIAL: when lecture files are provided (or the session is built on them), every fact, definition, number, example and question must come from those files. Never add anything from your own general knowledge: no outside facts, examples, numbers, extra topics or details the lecture pages don't contain, even if they are true and related. If something isn't covered in the material, say so instead of filling it in.
Keep language simple, encouraging, and concise.
Write math and symbols as plain text with Unicode characters (λ, Σ, δ, q₀, x², →, ∈), never LaTeX, never $…$.`;

/** A lecture file is attached (a PDF or PowerPoint slides). */
const hasLecture = (c: Context) => !!(c.pdfBase64 || c.slides?.length);

function material(c: Context): Block[] {
  const blocks: Block[] = [];
  if (c.slides?.length) {
    const n = c.slides.length;
    blocks.push({ type: 'text', text: `TODAY'S LECTURE is a PowerPoint deck: ONLY slides ${c.fromPage ?? 1}–${c.toPage ?? 'end'} of the student's file, ${n} slide${n > 1 ? 's' : ''}. Each slide is one PAGE, numbered 1 to ${n} below; its text (and speaker notes) comes first, then its pictures. It is the ONLY source of content for this session: every fact, definition, number, example and question must be found on these pages. Nothing else exists for this session.` });
    for (const sl of c.slides) {
      blocks.push({ type: 'text', text: `=== PAGE ${sl.page} (slide ${sl.slide} of the file) ===\n${sl.text || '(no text on this slide, only the pictures below)'}` });
      sl.images.forEach((im, k) => {
        blocks.push({ type: 'text', text: `(picture ${k + 1} of page ${sl.page})` });
        blocks.push({ type: 'image', source: { type: 'base64', media_type: im.mime, data: im.data } });
      });
    }
    blocks.push({ type: 'text', text: '=== END OF THE LECTURE ===' });
  } else if (c.pdfBase64) {
    blocks.push(
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: c.pdfBase64 } },
      { type: 'text', text: `The document above is TODAY'S LECTURE: ONLY the pages ${c.fromPage ?? 1}–${c.toPage ?? 'end'} of the student's file${c.pageCount ? `, ${c.pageCount} page${c.pageCount > 1 ? 's' : ''}; in this document they are numbered 1 to ${c.pageCount}` : ''}. It is the ONLY source of content for this session: every fact, definition, number, example and question must be found on these pages. Nothing else exists for this session.` },
    );
  }
  for (const f of c.course ?? []) {
    blocks.push(
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } },
      { type: 'text', text: `The document above is the ${f.label}. This is NOT lecture content. Use it ONLY to judge which of today's lecture ideas are most examinable and how exam questions are phrased. NEVER take a fact, term, example, number or topic from it: anything that appears only in this document must NOT appear in your answer.` },
    );
  }
  return blocks;
}


/** A usable picture reference, or undefined. */
function cleanFigure(f: unknown): FigureRef | undefined {
  const x = f as { page?: unknown; box?: unknown; image?: unknown } | null | undefined;
  const page = Number(x?.page);
  if (!x || !Number.isInteger(page) || page < 1) return undefined;
  const box = Array.isArray(x.box) && x.box.length === 4 && x.box.every((v) => Number.isFinite(Number(v))) ? x.box.map(Number) : undefined;
  const image = Number(x.image);
  return { page, ...(box ? { box } : {}), ...(Number.isInteger(image) && image >= 1 ? { image } : {}) };
}

// "On page 4, …", "(see slide 2)", "go back to page 3 and …", "ارجع للصفحة ٤": the student answers from memory, not from
// the file. A sentence that only sends the student to a page is dropped; elsewhere just the page mention goes.
const PAGE_REF =
  /\s*[([]?\s*(?:(?:on|in|from|at|per)\s+)?(?:the\s+)?(?:page|slide|p\.)\s*[\d٠-٩]+(?:\s*(?:-|–|and|&|,)\s*[\d٠-٩]+)?(?:\s+of the (?:lecture|slides|file))?\s*[)\]]?\s*[,:;]?|\s*[([]?\s*(?:(?:في|على|من)\s+)?(?:ال|لل|ل)?(?:صفحة|صفحه|شريحة|سلايد)\s*(?:رقم\s*)?[\d٠-٩]+\s*[)\]]?\s*[،,:]?/gi;
const GO_LOOK = /\b(see|check|look(?: back)? at|go (?:back )?to|refer to|revisit|re-?read|open)\b[^.!?]{0,30}\b(page|slide)\s*[\d٠-٩]|(ارجع|راجع|انظر|شوف|افتح|اقرأ)[^.!؟]{0,20}(صفحة|صفحه|شريحة|سلايد)/i;
function noPages(t: string, whenOnlyAPointer?: string): string {
  const tidy = (x: string) => x.replace(PAGE_REF, ' ').replace(/\s{2,}/g, ' ').replace(/\s+([.,;:?!،؟])/g, '$1').trim();
  const sentences = t.match(/[^.!?؟]+[.!?؟]*/g) ?? [t];
  const kept = sentences.filter((x) => !GO_LOOK.test(x));
  if (!kept.length && whenOnlyAPointer) return whenOnlyAPointer;
  const out = tidy((kept.length ? kept : sentences).join(' '));
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : t;
}

/** The hint when the AI's own hint only sent the student to a page or a picture. */
const HINT_FALLBACK = 'Think back to how this was explained, step by step.';

const MARKED = ['order', 'sort', 'match', 'blank'] as const;
type Marked = (typeof MARKED)[number];
const isMarked = (f?: string): f is Marked => (MARKED as readonly string[]).includes(f ?? '');
/** Wording that asks the student to drag or tap cards (English or Arabic): such a question needs its cards. */
const ASKS_TO_ARRANGE =
  /^\W*(match|connect|pair up|link each|put .{0,60}\b(in|into) (the )?(right |correct )?order|arrange|order the|sort|classify|group the|drag|fill in|complete the (sentence|gaps|blanks))\b|^\W*(صل|وصّل|وصل|طابق|رتّب|رتب|صنّف|صنف|املأ|اِملأ|أكمل الفراغ|اكمل الفراغ)(\s|$)/i;

/** Keep a question's format only if its payload is usable; otherwise it is simply an "explain" question.
 *  Returns null for a question that only makes sense with cards it doesn't have. */
export function cleanQuestion(q: ActiveQuestion): ActiveQuestion | null {
  const s = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
  const steps = (q.steps ?? []).map(s).filter(Boolean).slice(0, 6);
  const buckets = (q.buckets ?? [])
    .map((b) => ({ name: s(b?.name), items: (b?.items ?? []).map(s).filter(Boolean).slice(0, 4) }))
    .filter((b) => b.name && b.items.length)
    .slice(0, 3);
  const pairs = (q.pairs ?? []).map((p) => ({ left: s(p?.left), right: s(p?.right) })).filter((p) => p.left && p.right).slice(0, 5);
  const blankText = s(q.text);
  const gaps = [...blankText.matchAll(/\[\[(.+?)\]\]/g)].length;
  const { fit: _fit, ...rest } = q as ActiveQuestion & { fit?: unknown }; // "fit" only made the AI check the format
  const base = { ...rest, q: noPages(q.q), hint: noPages(q.hint ?? '', HINT_FALLBACK), ideal: noPages(q.ideal ?? ''), figure: cleanFigure(q.figure), steps: undefined, buckets: undefined, pairs: undefined, text: undefined, extras: undefined };
  const usable: Record<Marked, boolean> = {
    order: steps.length >= 3,
    sort: buckets.length >= 2 && buckets.reduce((n, b) => n + b.items.length, 0) >= 4,
    match: pairs.length >= 3,
    blank: gaps >= 2 && gaps <= 5,
  };
  // the AI sometimes names one format and writes the parts of another (or forgets to name it): go by the parts it wrote
  let f = q.format;
  if (!(isMarked(f) && usable[f])) {
    const found = MARKED.filter((k) => usable[k]);
    if (found.length === 1) f = found[0];
  }
  if (f === 'order' && usable.order) return { ...base, format: f, steps, ideal: q.ideal || steps.join(' → ') };
  if (f === 'sort' && usable.sort) return { ...base, format: f, buckets };
  if (f === 'match' && usable.match) return { ...base, format: f, pairs };
  if (f === 'blank' && usable.blank) return { ...base, format: f, text: blankText, extras: (q.extras ?? []).map(s).filter(Boolean).slice(0, 2) };
  // a "match these" / "put these in order" question without its cards can't be answered by writing: leave it out
  if (isMarked(q.format) || ASKS_TO_ARRANGE.test(q.q)) return null;
  return { ...base, format: q.format === 'work' ? 'work' : 'explain' };
}

/** The shape an idea of the lecture has. It decides how the student practises it (see planQuestions):
 *  visual = it lives in a picture · sequence = steps in one right order · groups = things in named groups ·
 *  pairs = one-to-one pairs · definition = a key sentence whose terms matter · calculation = worked on paper ·
 *  reasoning = a why / how idea, best explained. */
export type IdeaShape = 'visual' | 'sequence' | 'groups' | 'pairs' | 'definition' | 'calculation' | 'reasoning';
const SHAPES: IdeaShape[] = ['visual', 'sequence', 'groups', 'pairs', 'definition', 'calculation', 'reasoning'];
/** One idea of the lecture, checked against the student's brain dump. `figure`: the picture it lives in, if any.
 *  A gap carries what the student reads about it: `teach` + `why` for a missed idea, `youSaid` + `truth` for a wrong one. */
export type MapIdea = {
  idea: string;
  page?: number;
  weight: number;
  status: 'nailed' | 'missed' | 'wrong';
  shape: IdeaShape;
  figure?: FigureRef;
  teach?: string;
  why?: string;
  youSaid?: string;
  truth?: string;
  formula?: string;
};
export type Lesson = { analysis: Analysis; map: MapIdea[] };

const NO_PAGES = `NO PAGE NUMBERS IN WHAT THE STUDENT READS: questions, hints, answers, cards and the analysis texts never mention a page or slide number and never send the student to the lecture ("on page 4…", "see slide 2", "go back to page 3"). The student answers from memory; page numbers belong only in "src", "page" and "figure".`;
const NO_PICTURE_TALK = `NO PICTURES HERE: the student sees this text WITHOUT any picture of the lecture, so it must make sense on its own. Never refer to a figure, diagram, graph, chart, table, image or drawing ("in the diagram", "the table below", "as shown above", "في الشكل التالي"): say in words what it shows instead.`;

// Words that point at a picture the student would have to see ("in the diagram below", "Figure 3", "في الرسمة").
// A question or card without its picture that says this can't be answered, so it is left out.
// Up to 4 words may sit between "the" and the picture word: "based on the transition function diagram", "the given state diagram".
const PICTURE_TALK =
  /\b(?:in|on|from|using|see|look at|refer to|based on|according to|consider|study|examine|given)\s+(?:the|this|that)\s+(?:[\w-]+\s+){0,4}?(?:figure|fig\.?|diagram|graph|chart|table|image|picture|illustration|drawing|plot|screenshot)s?\b|\b(?:the|this)\s+(?:figure|diagram|image|picture|illustration|screenshot|chart)\s+(?:below|above|shown)\b|\b(?:shown|pictured|illustrated|depicted)\s+(?:below|above)\b|\bfig(?:ure)?\.?\s*\d|(?:في|من|على|ب)\s*ال(?:رسمة|رسم البياني|صورة|مخطط)|(?:الشكل|الرسمة|الرسم|الصورة|المخطط|الجدول)\s+(?:التالي|التالية|أدناه|المرفق|المرفقة|المقابل|المقابلة|الموضح|الموضحة|السابق|السابقة|رقم)/i;
/** The text points at a picture of the lecture. */
export const mentionsPicture = (t?: string) => !!t && PICTURE_TALK.test(t);

/**
 * Questions and cards are shown without a picture unless they have one (`figure`). When such a text still points at a
 * picture ("Based on the transition function diagram…"), it is rewritten to stand on its own: usually it already holds
 * what the picture shows, so only the pointer goes. One short call for all of them, without the lecture file.
 * An item that can't be asked without its picture is left out (and logged), never shown broken.
 */
async function standAlone<T extends { figure?: FigureRef }>(c: Context, items: T[], fields: (keyof T & string)[], what: string): Promise<T[]> {
  const refs = items.flatMap((x, k) => (x.figure ? [] : fields.filter((f) => mentionsPicture(x[f] as string)).map((f) => ({ k, f, text: String(x[f]) }))));
  if (!refs.length) return items;
  let fixed: string[] = [];
  try {
    const out = await callJSON<unknown[]>(
      persona(c),
      [
        {
          type: 'text',
          text: `Each text below is from a study app. The student sees it WITHOUT any picture, but it points at one ("based on the diagram…", "in the table below…").
Rewrite each one so it stands on its own: take out the pointer and keep every fact the text already gives (states, transitions, values, labels), written in words. Add no new facts. Keep the meaning, the language and roughly the length.
If a text can't be understood without seeing the picture (the facts it needs are not in the text), return "" for it.
Texts: ${JSON.stringify(refs.map((r) => r.text))}
Return ONLY a JSON array of strings: the same number, in the same order.`,
        },
      ],
      1500,
      'Keep each text short.',
      `${what} without picture talk`,
    );
    fixed = refs.map((_, k) => (typeof out?.[k] === 'string' ? (out[k] as string).trim() : ''));
  } catch {}
  const next = items.map((x) => ({ ...x }));
  const lost = new Set<number>();
  refs.forEach((r, k) => {
    const t = fixed[k];
    if (t && !mentionsPicture(t)) (next[r.k] as Record<string, unknown>)[r.f] = t;
    else lost.add(r.k);
  });
  lost.forEach((k) => console.log(`[check] ${what} left out: it needs a picture it doesn't have: "${refs.find((r) => r.k === k)!.text.slice(0, 80)}"`));
  return next.filter((_, k) => !lost.has(k));
}

const grounding = (c: Context) =>
  `GROUNDING (the most important rule): everything comes from the lecture pages above and nothing else. Never use your own knowledge, the syllabus or the past papers as a source of facts. "src" is the page number of the lecture document (1 to ${c.pageCount ?? 'the last page'}) where the answer or fact is actually written. If you cannot point to a page, leave that item out.`;

/** Ask once more when the answer came back cut off or as broken JSON (a dense lecture makes a long answer). */
/** `complete`: says whether the parsed answer has everything; one that doesn't is asked for again, like broken JSON. */
async function callJSON<T>(system: string, content: Block[], maxTokens: number, retryNote: string, label = 'ai', complete?: (v: T) => boolean): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const raw = await call(system, attempt ? [...content, { type: 'text', text: `YOUR PREVIOUS ANSWER WAS CUT OFF OR NOT VALID JSON. Answer again with COMPLETE, valid JSON. ${retryNote}` }] : content, maxTokens, attempt ? `${label} (again: the first answer was cut off or broken)` : label);
      const v = parseJSON<T>(raw);
      if (complete && !complete(v)) {
        console.log(`[check] ${label}: the answer is missing a part (it has: ${Object.keys(v ?? {}).join(', ') || 'nothing'}), asking again`);
        throw new SyntaxError('the answer is missing a part');
      }
      return v;
    } catch (e) {
      if (!(e instanceof SyntaxError) || attempt >= 1) throw e;
    }
  }
}

/** How many map entries a lecture can have, and the room the analysis gets: a long lecture (80 pages) has far more
 *  ideas than a short one, and an answer cut off at its length limit can't be read at all. */
const mapCap = (c: Context) => Math.min(60, 25 + Math.round((c.pageCount ?? 20) / 3));
const analysisBudget = (c: Context) => Math.min(16000, 8000 + Math.max(0, (c.pageCount ?? 20) - 20) * 120);

/**
 * Session step 1 — the only one the student waits for: every idea of the lecture pages (with its shape, and the
 * picture it lives in), compared with the brain dump, and the analysis the student reads next. The questions and
 * the flashcards are written from this afterwards, in the background (writeQuestions, writeCards).
 */
export async function analyseSession(c: Context, recall: string): Promise<Lesson> {
  if (!aiEnabled) {
    await wait(2200);
    return { analysis: DEMO.analysis, map: [] };
  }
  const slides = !!c.slides?.length;
  const out = await callJSON<{ map?: Partial<MapIdea>[]; analysis?: Analysis }>(
    persona(c),
    [
      ...material(c),
      {
        type: 'text',
        text: `The student did a "brain dump" — everything they remember about this, from memory:
"""${recall}"""

Compare it with ${hasLecture(c) ? "today's lecture pages" : 'the topic (no lecture file attached, so use standard curriculum knowledge for this chapter)'}.
Return ONLY JSON with this shape:
{
 "map": [{"idea": "short name", "page": 1, "weight": 3, "status": "nailed|missed|wrong", "shape": "visual|sequence|groups|pairs|definition|calculation|reasoning", "figure": ${slides ? '{"page": 1, "image": 1}' : '{"page": 1, "box": [0, 0, 1000, 1000]}'} | null,
          ...only when "missed": "teach": "teach it clearly in 2-3 simple sentences, as if explaining it for the first time", "why": "ONE short sentence: where it shows up (a typical exam question, or what it is needed for); never add content from the syllabus or past papers",
          ...only when "wrong": "youSaid": "their wrong statement (quote/paraphrase)", "truth": "the correct idea in 1-2 sentences", "formula": "optional short formula"}],
 "analysis": {
   "summary": "1 short encouraging sentence",
   "nailed": [{"title": "concept", "detail": "what they got right (1 sentence)", "tag": "Strong Recall|Exact Match|Firmly Grasped"}],
   "keywords": ["exact short phrases copied from the student's text that are correct"]
 }
}
Rules:
- ${NO_PAGES}
- ${grounding(c)}
- The texts the student reads (summary, detail, teach, why, truth) are read without pictures. ${NO_PICTURE_TALK}
- map (do this FIRST, it is your working list and the ONLY list of the student's gaps): walk through the lecture pages in order and list EVERY distinct idea, definition, formula, number, example or picture worth knowing, whether or not the student mentioned it. "page": where it is (1 to ${c.pageCount ?? 'the last page'}). weight: 3 = core and likely examined, 2 = important support, 1 = detail. status compares it with the brain dump: nailed (stated correctly), missed (not mentioned), wrong (stated incorrectly). The LECTURE decides what matters, never the student's text.
- NO GAP IS LOST: every missed or wrong idea of weight 2 or 3 gets its own entry, and every wrong statement in the brain dump gets a "wrong" entry. To keep the answer short, merge NAILED ideas and weight-1 details instead: the map has at most ${mapCap(c)} entries that are nailed or weight 1; missed and wrong ideas of weight 2-3 don't count toward that.
- Every "missed" entry has "teach" and "why"; every "wrong" entry has "youSaid" and "truth". "teach" must actually teach the idea, because the student reads these before being questioned. Nailed entries are names only.
- "shape" says how the idea is built in the lecture. Look at each one honestly; Drrys picks how to practise it from this:
    visual — the idea is taught with a picture the student must SEE: a diagram, automaton, graph, chart, table, circuit, map, labelled drawing, code screenshot. Lectures that are mostly pictures have many of these.
    sequence — steps of a process or algorithm, stages in time, a chain where each step causes the next: ONE right order that the lecture shows. A list of types, features or examples is not a sequence.
    groups — the lecture puts things into 2-3 named groups (types, classes, the two sides of a comparison).
    pairs — one-to-one pairs: terms and their meanings, causes and effects, things and their properties.
    definition — a key sentence (a definition, a rule, a law) whose exact terms matter.
    calculation — something worked out on paper: a calculation, derivation, proof, tracing an algorithm by hand.
    reasoning — a why / how idea, best explained in words. Use it only when none of the shapes above fits.
- "figure" (for a visual idea; null otherwise): the picture it lives in. ${slides ? 'This lecture is slides: {"page": the page, "image": which picture of that page, as numbered in the lecture ("picture 2 of page 5" → 2)}. Only the numbered pictures can be shown: a visual drawn with shapes or text on the slide has none, so it is not "visual".' : 'This lecture is a PDF: {"page": the page, "box": [top, left, bottom, right]}: a tight box around the whole visual with its labels (not the page title or the text around it), each value 0-1000 of the page\'s height or width, like your usual box_2d.'}
- analysis.nailed: max 6. Empty lists are fine.`,
      },
    ],
    analysisBudget(c),
    `Your answer was too long. Merge NAILED ideas and weight-1 details so they are at most ${Math.round(mapCap(c) * 0.6)} entries, keep every missed and wrong idea of weight 2-3, and keep every "teach" and "truth" to one sentence.`,
    'analysis',
    (v) => !!v?.analysis && Array.isArray(v.map) && v.map.length > 0,
  );
  const a = out.analysis;
  if (!a) throw new Error('Coco’s answer came back incomplete');
  const text = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
  const map = (out.map ?? [])
    .filter((m) => m?.idea)
    .map((m): MapIdea => {
      const page = Number(m.page);
      const figure = m.shape === 'visual' ? figureIn(c, cleanFigure(m.figure)) : undefined;
      const shape = SHAPES.includes(m.shape as IdeaShape) ? (m.shape as IdeaShape) : 'reasoning';
      const status = m.status === 'nailed' || m.status === 'wrong' ? m.status : 'missed';
      const gapText =
        status === 'missed'
          ? { teach: noPages(text(m.teach)), why: noPages(text(m.why)) }
          : status === 'wrong'
            ? { youSaid: text(m.youSaid), truth: noPages(text(m.truth)), formula: text(m.formula) }
            : {};
      return {
        idea: String(m.idea),
        page: Number.isInteger(page) && page >= 1 ? page : undefined,
        weight: Math.max(1, Math.min(3, Number(m.weight) || 2)),
        status,
        // a picture that can't be shown is practised in words
        shape: shape === 'visual' && !figure ? 'reasoning' : shape,
        ...(figure ? { figure } : {}),
        ...Object.fromEntries(Object.entries(gapText).filter(([, v]) => v)),
      };
    });
  // what the student reads is built from the map, so every gap they read about is one the questions and cards know
  const analysis: Analysis = { ...a, nailed: a.nailed ?? [], ...gapsToRead(map), keywords: a.keywords ?? [] };
  return { analysis, map };
}

/** The "you missed" and "fix this" lists the student reads, straight from the map: most important first. A missed
 *  weight-1 detail is listed only when the map taught it. */
function gapsToRead(map: MapIdea[]): Pick<Analysis, 'forgotten' | 'corrections'> {
  const byWeight = (x: MapIdea, y: MapIdea) => y.weight - x.weight || (x.page ?? 0) - (y.page ?? 0);
  const forgotten = map
    .filter((m) => m.status === 'missed' && (m.weight >= 2 || m.teach))
    .sort(byWeight)
    .map((m) => ({ title: m.idea, detail: m.teach || m.idea, ...(m.why ? { why: m.why } : {}), tag: 'Missed' }));
  const corrections = map
    .filter((m) => m.status === 'wrong')
    .sort(byWeight)
    .map((m) => ({ concept: m.idea, youSaid: m.youSaid ?? '', truth: m.truth || m.idea, ...(m.formula ? { formula: m.formula } : {}) }));
  return { forgotten, corrections };
}

/** One question to write: which idea, and how the student practises it. */
export type PlanItem = { n: number; idea: string; status: MapIdea['status']; page?: number; format: QFormat; figure?: FigureRef };

const SHAPE_FORMAT: Record<IdeaShape, QFormat> = {
  visual: 'explain', // the picture is shown; the AI may make it a match or an order when the picture holds that
  sequence: 'order',
  groups: 'sort',
  pairs: 'match',
  definition: 'blank',
  calculation: 'work',
  reasoning: 'explain',
};

/** Every session practises at least this many ideas (when the lecture has them), even after a strong recall. */
const MIN_QUESTIONS = 5;

/**
 * Which ideas get a question and in what format, decided here (not by the AI) from the shape of each idea:
 * the student's gaps and mix-ups first (wrong, then missed, most important first), then about a quarter that
 * deepen ideas they got right. Every format is kept to at most 3 a session, so one shape can't take it over.
 */
export function planQuestions(map: MapIdea[], analysis?: Analysis): PlanItem[] {
  // no map came back: question the ideas the analysis taught, in words
  if (!map.length && analysis) {
    const ideas = [...analysis.corrections.map((x) => ({ idea: x.concept, status: 'wrong' as const })), ...analysis.forgotten.map((x) => ({ idea: x.title, status: 'missed' as const }))];
    return ideas.slice(0, 8).map((x, k) => ({ n: k + 1, ...x, format: 'explain' }));
  }
  const byWeight = (a: MapIdea, b: MapIdea) => b.weight - a.weight || (a.page ?? 0) - (b.page ?? 0);
  const gaps = [...map.filter((m) => m.status === 'wrong' && m.weight >= 2).sort(byWeight), ...map.filter((m) => m.status === 'missed' && m.weight >= 2).sort(byWeight)].slice(0, 8);
  if (gaps.length < MIN_QUESTIONS) gaps.push(...map.filter((m) => m.status !== 'nailed' && m.weight < 2).slice(0, MIN_QUESTIONS - gaps.length));
  const known = map.filter((m) => m.status === 'nailed' && m.weight >= 2).sort(byWeight);
  // pictures first among the known ideas: a lecture made of pictures should be practised with them
  known.sort((a, b) => Number(!!b.figure) - Number(!!a.figure));
  // at least MIN_QUESTIONS when the lecture has them: a strong recall still gets real practice, on harder ground
  const deepen = known.slice(0, Math.max(1, Math.ceil(gaps.length / 3), MIN_QUESTIONS - gaps.length));
  if (gaps.length + deepen.length < MIN_QUESTIONS) deepen.push(...map.filter((m) => m.status === 'nailed' && m.weight < 2).slice(0, MIN_QUESTIONS - gaps.length - deepen.length));
  const chosen = [...gaps, ...deepen].slice(0, 10);
  const used: Partial<Record<QFormat, number>> = {};
  const items = chosen.map((m, k): PlanItem => {
    let format = SHAPE_FORMAT[m.shape];
    if (format !== 'explain' && (used[format] ?? 0) >= 3) format = 'explain';
    used[format] = (used[format] ?? 0) + 1;
    return { n: k + 1, idea: m.idea, status: m.status, page: m.page, format, ...(m.figure ? { figure: m.figure } : {}) };
  });
  // spread the formats through the session: never the same drag / tap format twice in a row when it can be helped
  for (let k = 1; k < items.length; k++) {
    if (items[k].format === 'explain' || items[k].format !== items[k - 1].format) continue;
    const swap = items.findIndex((x, j) => j > k && x.format !== items[k].format);
    if (swap > 0) [items[k], items[swap]] = [items[swap], items[k]];
  }
  return items.map((x, k) => ({ ...x, n: k + 1 }));
}

const FORMAT_HOW: Record<QFormat, string> = {
  explain: 'the student types or says an explanation. Make them EXPLAIN why / how, or use the idea on a new short scenario.',
  work: '"q" is a problem to solve on paper; "ideal" is the worked solution in a few lines.',
  order: 'add "steps": the 3-6 items in the CORRECT order, each at most 8 words (the app shuffles them). "q" says what is being ordered.',
  sort: 'add "buckets": 2-3 of {"name": "...", "items": ["...", "..."]} with 2-4 short items each; every item belongs to exactly one bucket.',
  match: 'add "pairs": 3-5 of {"left": "...", "right": "..."}, each side at most 8 words, one right answer per left.',
  blank: 'add "text": the key sentence with each missing word written [[like this]] (2-4 gaps, single words or very short terms), and "extras": 1-2 wrong but believable words for the word bank.',
};

/**
 * Session step 2a (in the background while the student reads the analysis): one question per planned item, in
 * the format the plan gives it. The pictures are not attached here (lib/figures does that).
 */
export async function writeQuestions(c: Context, lesson: Lesson, plan: PlanItem[]): Promise<ActiveQuestion[]> {
  if (!aiEnabled) {
    await wait(1200);
    return DEMO.questions;
  }
  if (!plan.length) return [];
  const list = plan.map((p) => ({
    n: p.n,
    idea: p.idea,
    student: p.status === 'wrong' ? 'mixed it up' : p.status === 'missed' ? 'forgot it' : 'knows it: go deeper (apply it to a new case, compare, or ask why)',
    page: p.page,
    format: p.format,
    ...(p.figure ? { picture: 'shown right under the question: the question is about it' } : {}),
  }));
  const raw = await callJSON<Partial<ActiveQuestion & { n: number; src: number }>[]>(
    persona(c),
    [
      ...material(c),
      {
        type: 'text',
        text: `What the student got wrong: ${JSON.stringify(lesson.analysis.corrections.map((x) => ({ concept: x.concept, youSaid: x.youSaid })))}

Write today's active-learning questions: exactly ONE question for each item of this plan, in the format it gives:
${JSON.stringify(list)}

Return ONLY JSON: [{"n": 1, "kind": "conceptual|procedural|analogous|evidence", "format": "...", "q": "...", "hint": "a nudge, not the answer", "ideal": "model answer in 1-2 sentences", "src": 1, ...the parts of its format}]
How each format works:
${(Object.keys(FORMAT_HOW) as QFormat[]).map((f) => `  ${f} — ${FORMAT_HOW[f]}`).join('\n')}
Rules:
- ${NO_PAGES}
- ${grounding(c)}
- Keep the format of each item. Only an item with a picture may change it: to "match", "order" or "blank" when the picture itself holds those pairs, steps or terms (e.g. several automata and the languages they accept → match).
- A question with a picture is about that picture and points at it ("In the diagram below, …"); everything it needs is in the picture.
- A question WITHOUT a picture in the plan is shown with no picture at all. ${NO_PICTURE_TALK} If the idea can't be asked without seeing the picture, ask about what it means instead.
- Never write an explain or work question that asks the student to match, connect, order, sort or fill gaps.
- For order, sort, match and blank, "ideal" is ONE sentence saying why it is that way (it becomes the student's flashcard if they miss it).
- "kind": conceptual (how ideas relate), procedural (a process or calculation), analogous (a comparison and where it stops working) or evidence (use a fact or example on a new case). Mix them.
- Ask the way an exam would: when a syllabus or past papers are attached, use them ONLY to choose the phrasing, never as a source of content.${c.interests.length ? `
- THE STUDENT'S WORLD (${c.interests.join(' · ')}): exactly ONE "explain" question (pick the most abstract idea of the plan that has no picture) is "kind": "analogous" and built on ONE item of this world. Compare the lecture idea with something specific and true about that item, then ask the student where the comparison fits and where it stops working. The lecture facts stay exactly as on the page; use only details of that item you are sure about, otherwise its listed "about" themes. Name the item in the question. No other question mentions their world.` : ''}`,
      },
    ],
    9000,
    'Keep every "ideal" short (one sentence), but write every question of the plan.',
    'questions',
  );
  const KINDS: QKind[] = ['conceptual', 'procedural', 'analogous', 'evidence'];
  const byN = new Map(plan.map((p) => [p.n, p]));
  const written = (Array.isArray(raw) ? raw : [])
    .filter((q) => q?.q)
    .flatMap((q) => {
      const p = byN.get(Number(q.n));
      // the picture comes from the plan (the analysis found it); the AI only keeps the format or picks one for a picture
      const format = p?.figure ? q.format : (p?.format ?? q.format);
      const clean = cleanQuestion({ ...q, format, kind: KINDS.includes(q.kind as QKind) ? q.kind : 'conceptual', figure: p?.figure, src: q.src ?? p?.page } as ActiveQuestion);
      if (!clean) return [];
      const hint = !clean.figure && mentionsPicture(clean.hint) ? HINT_FALLBACK : clean.hint;
      const src = Number(q.src ?? p?.page);
      return [{ ...clean, hint, idea: p?.idea, src: q.src ?? p?.page, ...(Number.isInteger(src) && src >= 1 ? { page: src } : {}) }];
    });
  // a question without a picture that still points at one is rewritten to stand on its own
  return standAlone(c, grounded(c, written), ['q', 'ideal'], 'question');
}

/** The student's gaps: every idea they got wrong, and every idea they missed that they read about (see gapsToRead). */
export const gapsOf = (map: MapIdea[]) => map.filter((m) => m.status === 'wrong' || (m.status === 'missed' && (m.weight >= 2 || !!m.teach)));

/** The gaps that got no question today. Each of them becomes a flashcard, so no gap is left without practice. */
export const unasked = (map: MapIdea[], questions: ActiveQuestion[]) => {
  const asked = new Set(questions.map((q) => q.idea).filter(Boolean));
  return gapsOf(map).filter((m) => !asked.has(m.idea));
};

/** The card for a gap the AI didn't write one for, made from what the student read about it. */
function gapCard(m: MapIdea): FlashCard | undefined {
  if (m.status === 'wrong') return m.truth ? { q: `${m.idea}: what is the correct idea?`, a: m.truth } : undefined;
  return m.teach ? { q: `Explain: ${m.idea}`, a: m.teach } : undefined;
}

/**
 * Session step 2b (in the background): the lecture's flashcards. `gaps`: the student's gaps that got no question
 * today (see unasked); each one gets a card, written by the AI or, if it left one out, made from the analysis.
 */
export async function writeCards(c: Context, lesson: Lesson, gaps: MapIdea[] = []): Promise<FlashCard[]> {
  if (!aiEnabled) return DEMO.cards;
  const a = lesson.analysis;
  const mustCover = gaps.map((m, k) => ({ gap: k + 1, idea: m.idea, student: m.status === 'wrong' ? `mixed it up (said: ${m.youSaid ?? ''})` : 'forgot it' }));
  const raw = await callJSON<(FlashCard & { gap?: number })[]>(
    persona(c),
    [
      ...material(c),
      {
        type: 'text',
        text: `The student's session: they mixed up ${JSON.stringify(a.corrections.map((x) => x.concept))}, forgot ${JSON.stringify(a.forgotten.map((x) => x.title))}.
Make the flashcards for these lecture pages.
Return ONLY JSON: [{"q": "short question", "a": "short, accurate answer", "src": 1${mustCover.length ? ', "gap": 1 (only on a card for one of the gaps below)' : ''}}]
Rules:
- ${NO_PAGES}
- ${grounding(c)}
- Cards are shown without any picture. ${NO_PICTURE_TALK}
- Only REFERENCE material: terms, definitions, numbers, formulas, lists, labels: the things that are simply remembered. Ideas that are better practised by explaining do not get a card. Built from the LECTURE content, not from the student's wording: the mixed-up ideas first, then the forgotten reference facts, then the other key reference facts of these pages.
- No fixed number: one card per fact worth memorising, as many as the material holds; dense pages get many cards, light pages few. Never pad with trivia, never skip a key fact, never add facts that aren't in the lecture.${mustCover.length ? `
- THESE GAPS GET NO QUESTION TODAY, so each one MUST get exactly one card with its "gap" number, even a why / how idea (then the card asks it in one short question and answers it in 1-2 sentences). They come first: ${JSON.stringify(mustCover)}` : ''}`,
      },
    ],
    6000 + gaps.length * 120,
    'Keep every answer short, but keep all the cards and one card for every gap.',
    'cards',
  );
  const list = (Array.isArray(raw) ? raw : []).filter((x) => x?.q && x?.a);
  // a gap's card stays even without a page: the gap itself came from the lecture map
  const isGap = (x: { gap?: number }) => Number.isInteger(x.gap) && x.gap! >= 1 && x.gap! <= gaps.length;
  const written = [...list.filter(isGap), ...grounded(c, list.filter((x) => !isGap(x)))].map((x) => ({ q: noPages(x.q), a: noPages(x.a), ...(isGap(x) ? { gap: x.gap } : {}) }));
  // cards are never shown with a picture: one that points at a picture is rewritten to stand on its own
  const cards = await standAlone<FlashCard & { gap?: number; figure?: FigureRef }>(c, written, ['q', 'a'], 'card');
  // every gap without a question must leave with a card: the ones the AI skipped are made from the analysis
  const covered = new Set(cards.map((x) => x.gap));
  const extra = gaps.flatMap((m, k) => {
    if (covered.has(k + 1)) return [];
    const card = gapCard(m);
    console.log(`[check] gap "${m.idea}" had no question and no card: ${card ? 'made one from the analysis' : 'nothing to make it from'}`);
    return card ? [card] : [];
  });
  return [...cards.map(({ q, a }) => ({ q, a })), ...extra];
}

/** The picture reference, if it points at something this session's pages can show. */
function figureIn(c: Context, f?: FigureRef): FigureRef | undefined {
  if (!f) return undefined;
  if (c.slides?.length) return f.image && (c.slides[f.page - 1]?.images.length ?? 0) >= f.image ? { page: f.page, image: f.image } : undefined;
  if (c.pdfBase64) return f.page <= (c.pageCount ?? Infinity) ? { page: f.page, ...(f.box ? { box: f.box } : {}) } : undefined;
  return undefined;
}

/**
 * Safety net: every question, card and "forgotten" idea must name a page (1..N) of the lecture the student chose.
 * Anything that doesn't was not found in the pages, so it is dropped (and the internal "src" is removed).
 */
function grounded<T extends object>(c: Context, list: T[]): T[] {
  const n = c.pageCount;
  const strip = (x: T): T => {
    const { src: _src, ...rest } = x as T & { src?: unknown };
    return rest as T;
  };
  if (!hasLecture(c) || !n) return list.map(strip); // no lecture file: nothing to check against
  const ok = (x: T) => {
    const v = Number((x as { src?: unknown }).src);
    return Number.isInteger(v) && v >= 1 && v <= n;
  };
  const good = list.filter(ok);
  return (good.length ? good : list).map(strip); // if the model left every "src" out, do not empty the session
}

/** Active learning is a conversation: after the grade, the student can push back or ask, and Coco replies. */
export async function discussAnswer(
  c: Context,
  q: ActiveQuestion,
  answer: string,
  feedback: string,
  thread: { role: 'user' | 'assistant'; text: string }[],
): Promise<string> {
  if (!aiEnabled) {
    await wait(700);
    return DEMO.chat[thread.length % DEMO.chat.length];
  }
  const convo = thread.map((m) => `${m.role === 'user' ? 'Student' : 'Coco'}: ${m.text}`).join('\n');
  return plainMath(await call(
    persona(c) +
      '\nYou are in the middle of an active-learning exchange. Reply in 1-3 short sentences. Answer only from the model answer and the lecture; if the student asks about something the lecture pages don’t cover, say it is outside today’s pages instead of explaining it from your own knowledge. If the student is partly right, say which part. Prefer a guiding question over just giving the answer, unless they are clearly stuck. Match the language the student writes in.',
    [
      ...(await pictureOf(q)),
      {
        type: 'text',
        text: `Question: ${q.q}\nModel answer: ${q.ideal}\nStudent's answer: """${answer}"""\nYour feedback: ${feedback}\n\n${convo}\nCoco:`,
      },
    ],
    500,
    'discuss',
  ));
}

export async function analyzeRecall(c: Context, recall: string): Promise<Analysis> {
  if (!aiEnabled) {
    await wait(2200);
    return DEMO.analysis;
  }
  const raw = await call(
    persona(c),
    [
      ...material(c),
      {
        type: 'text',
        text: `The student did a "brain dump" — everything they remember, from memory:
"""${recall}"""

Compare it with the lecture${hasLecture(c) ? '' : ' topic (no file attached, use standard curriculum knowledge)'}.
Return ONLY JSON:
{"summary": "1 short encouraging sentence",
 "nailed": [{"title": "concept", "detail": "what they got right (1 sentence)", "tag": "Strong Recall|Exact Match|Firmly Grasped"}],
 "forgotten": [{"title": "concept they did not mention but is important", "detail": "1-2 sentences explaining it", "tag": "Missed", "page": "page ref if known"}],
 "corrections": [{"concept": "name", "youSaid": "their wrong statement (quote/paraphrase)", "truth": "the correct mechanism in 1-2 sentences", "formula": "optional short formula"}],
 "keywords": ["exact short phrases copied from the student's text that are correct"]}
Max 4 items per list. Empty lists are fine.`,
      },
    ],
    2500,
    'analysis (old)',
  );
  return parseJSON<Analysis>(raw);
}

export async function makeQuestions(c: Context, a: Analysis): Promise<ActiveQuestion[]> {
  if (!aiEnabled) return DEMO.questions;
  const raw = await call(persona(c), [
    ...material(c),
    {
      type: 'text',
      text: `Recall analysis: ${JSON.stringify({ forgotten: a.forgotten, corrections: a.corrections })}
Write as many short active-learning questions as the gaps need (no fixed number), one idea at a time, that make the student EXPLAIN (why/how), exam-style, prioritising the gaps.
${c.interests.length ? 'At most one question may invite an analogy from their interests, only if an idea really needs it.' : ''}
Return ONLY JSON: [{"q": "...", "hint": "a nudge, not the answer", "ideal": "model answer in 1-2 sentences"}]`,
    },
  ], 2000, 'questions (old)');
  return parseJSON<ActiveQuestion[]>(raw);
}

const pageCache = new Map<string, string>();
/** The one lecture page a question comes from, for Coco to grade against (nothing if there is no file or no page).
 *  A PDF page is cut out of the session's pages (small, fast); a slide is sent as its text and pictures. */
async function sourcePage(c: Context, page?: number): Promise<Block[]> {
  if (!page || page < 1) return [];
  const note: Block = { type: 'text', text: 'The lecture page above is the one this question comes from.' };
  try {
    const sl = c.slides?.[page - 1];
    if (sl) {
      return [
        { type: 'text', text: `=== LECTURE PAGE ===\n${sl.text || '(no text, only pictures)'}` },
        ...sl.images.slice(0, 3).map((im): Block => ({ type: 'image', source: { type: 'base64', media_type: im.mime, data: im.data } })),
        note,
      ];
    }
    if (!c.pdfBase64 || page > (c.pageCount ?? Infinity)) return [];
    const key = `${c.pdfBase64.length}:${c.pdfBase64.slice(-64)}:${page}`;
    let data = pageCache.get(key);
    if (!data) {
      const src = await PDFDocument.load(c.pdfBase64, { ignoreEncryption: true });
      if (page > src.getPageCount()) return [];
      const out = await PDFDocument.create();
      const [p] = await out.copyPages(src, [page - 1]);
      out.addPage(p);
      data = await out.saveAsBase64();
      pageCache.set(key, data);
    }
    return [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }, note];
  } catch {
    return []; // grade from the model answer alone
  }
}

/** The question's picture, for Coco to look at while grading or talking about it (nothing if it can't be read). */
async function pictureOf(q: ActiveQuestion): Promise<Block[]> {
  if (!q.picture?.uri) return [];
  try {
    const data = await readFileBase64(q.picture.uri);
    if (!data) return [];
    return [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
      { type: 'text', text: 'The picture above is from the lecture: it is the one the question is about (the student sees it under the question).' },
    ];
  } catch {
    return [];
  }
}

export async function gradeAnswer(c: Context, q: ActiveQuestion, answer: string, sketch?: string): Promise<Grade> {
  if (!aiEnabled) {
    await wait(900);
    const words = answer.trim().split(/\s+/).filter(Boolean).length;
    return { correct: words >= 5, close: words >= 3 && words < 5, feedback: words >= 5 ? DEMO.goodFeedback : DEMO.tryFeedback };
  }
  const page = await sourcePage(c, q.page);
  const raw = await call(persona(c), [
    ...page,
    ...(await pictureOf(q)),
    ...(sketch ? ([{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: sketch } }] as Block[]) : []),
    {
      type: 'text',
      text: `${sketch ? 'The image above is what the student sketched or wrote by hand for this question.\n' : ''}Question (${q.kind ?? 'conceptual'}): ${q.q}\nModel answer: ${q.ideal}\nStudent answer: """${answer}"""
${q.format === 'work' ? 'This is a worked problem: judge the method, each step and the final answer (from the typed working and/or the sketch). If only the final answer is wrong, say which step to recheck.\n' : ''}${q.kind === 'analogous' ? 'This is a comparison question: the answer must say where the comparison fits AND where it stops working.\n' : ''}${q.kind === 'procedural' ? 'This is a procedure question: the steps must be right and in the right order.\n' : ''}Judge MEANING, never wording: the student explains in their own words, often in another language than the lecture (Arabic, English or a mix), and often by voice (so the text may have speech-to-text slips: a word that sounds like the right one counts as the right one). All of these count as right when the meaning is right: synonyms, everyday words instead of the term, an example instead of a definition, a different order, extra correct details, short or informal answers. Never mark an answer down for missing the exact term, the model answer's phrasing, or details the question did not ask for. "wrong" ONLY when the key idea is missing or the answer says something the lecture contradicts. When torn between two verdicts, pick the kinder one. Give a "verdict": "right" (the key idea is there), "close" (the student is on the right track and says part of it correctly, but it is incomplete or imprecise: not yet the answer wanted), or "wrong" (the key idea is missing or mixed up). The model answer comes from the lecture: judge against it and add nothing from outside it.${page.length ? ' The lecture page above is where this question comes from. The model answer is only a short summary of it: anything correct the student says that this page supports counts as correct, even if the model answer leaves it out.' : ''}
Also spot the gap: if the answer is wrong, incomplete or mixes something up, write ONE flashcard aimed at exactly that
missing or confused point (not the whole question again), answered from the lecture. If the answer is fully right, "card" is null.
The student will see the model answer right under your feedback, so the feedback must NOT repeat it, praise, or explain the whole idea.
Return ONLY JSON: {"verdict": "right|close|wrong", "feedback": "if right: one short line (max 10 words) on what they got. If close or wrong: ONLY what is missing or mixed up in their answer, as a short phrase (max 15 words, no praise, no intro), e.g. 'That λ is a move in the graph, not a symbol on the tape.' Same language as the student's answer",
"card": {"q": "short question on the exact gap", "a": "short, accurate answer"} | null}`,
    },
  ], 700, 'grade');
  const g = parseJSON<Grade & { verdict?: string }>(raw);
  const verdict = g.verdict ?? (g.correct ? 'right' : 'wrong');
  return { ...g, correct: verdict === 'right', close: verdict === 'close' };
}

export async function makeCards(c: Context, a: Analysis): Promise<FlashCard[]> {
  if (!aiEnabled) return DEMO.cards;
  const raw = await call(persona(c), [
    {
      type: 'text',
      text: `Create flashcards from the lecture content behind this session analysis (not from the student's wording):
the corrected misconceptions first, then the missed ideas, then the other key ideas. One card per idea worth remembering,
as many as the material needs (no fixed number), no filler, nothing that isn't in the lecture.
${JSON.stringify(a)}
Cards are shown without any picture: never refer to a figure, diagram, graph, table or picture.
Return ONLY JSON: [{"q": "short question", "a": "short, accurate answer"}]`,
    },
  ], 2000, 'cards (fallback)');
  return parseJSON<FlashCard[]>(raw).filter((x) => x?.q && x?.a && !mentionsPicture(x.q) && !mentionsPicture(x.a));
}

export async function chatCoco(c: Context, history: { role: 'user' | 'assistant'; text: string }[]): Promise<string> {
  if (!aiEnabled) {
    await wait(700);
    return DEMO.chat[history.length % DEMO.chat.length];
  }
  const convo = history.map((m) => `${m.role === 'user' ? 'Student' : 'Coco'}: ${m.text}`).join('\n');
  return plainMath(await call(persona(c) + '\nReply in 1-3 short sentences. Match the language the student writes in.', [
    { type: 'text', text: `${convo}\nCoco:` },
  ], 500, 'chat'));
}

/** Flashcard review: the student asks Coco about the card they're looking at. */
export async function askAboutCard(
  c: Context,
  card: { q: string; a: string },
  thread: { role: 'user' | 'assistant'; text: string }[],
): Promise<string> {
  if (!aiEnabled) {
    await wait(700);
    return DEMO.chat[thread.length % DEMO.chat.length];
  }
  const convo = thread.map((m) => `${m.role === 'user' ? 'Student' : 'Coco'}: ${m.text}`).join('\n');
  return plainMath(await call(
    persona(c) +
      '\nThe student is reviewing a flashcard and has a question about it. Explain simply in 1-4 short sentences, using what the card and lecture say; an example helps. Match the language the student writes in.',
    [{ type: 'text', text: `Flashcard — Q: ${card.q}\nA: ${card.a}\n\n${convo}\nCoco:` }],
    600,
    'ask about card',
  ));
}

/** Voice → text needs Gemini on the server (Claude doesn't take audio). EXPO_PUBLIC_VOICE=0 turns it off (e.g. a
 *  Claude-only server): the keyboard mic still works then. */
export const voiceEnabled = aiEnabled && process.env.EXPO_PUBLIC_VOICE !== '0';

/**
 * Turn a spoken recording into text, word for word, in whatever language(s) the student used.
 * Returns '' when nothing was said.
 */
export async function transcribe(base64: string, mime: string): Promise<string> {
  if (!voiceEnabled) throw new Error('Voice needs a Gemini key');
  const out = await callGemini(
    'You transcribe a student speaking to a study app. Write exactly what they said, in the language(s) they used (Arabic, English or a mix — keep each word in the language it was spoken). Fix nothing, add nothing, no notes, no quotes, no timestamps. Add normal punctuation. If there is no speech, reply with exactly: [silence]',
    [
      { type: 'text', text: 'Transcribe this recording.' },
      { type: 'audio', mime, data: base64 },
    ],
    1500,
    { chain: TRANSCRIBE_CHAIN, thinking: 'minimal', temperature: 0, timeoutMs: 25000, label: 'transcribe' },
  );
  const text = out.trim();
  return /^\[silence\]$/i.test(text) ? '' : text;
}


/* ---------- warm-up, grouping, memory hooks, level-up ---------- */

/** The student grouped what they missed on their own. Coco only CHECKS the grouping — it never regroups for them. */
export async function verifyGrouping(
  c: Context,
  groups: { name: string; items: { title: string; detail: string }[] }[],
): Promise<GroupCheck> {
  if (!aiEnabled) {
    await wait(900);
    return DEMO.groupCheck(groups.map((g) => g.name));
  }
  const raw = await call(
    persona(c) +
      "\nYou are checking a student's OWN grouping of ideas. Never regroup the ideas for them and never hand them the right grouping. Match the language the student writes in.",
    [
      {
        type: 'text',
        text: `The student sorted these ideas into groups and named each group (the name is what they think connects the ideas):
${JSON.stringify(groups)}
For each group decide whether its ideas really belong together for the reason in the name.
- ok: true → one short sentence saying what they connected well.
- ok: false → ONE short sentence naming which idea doesn't fit or what the name misses, plus a question that nudges them to see it. Do not say where it belongs.
Also give "overall": one encouraging sentence.
Return ONLY JSON: {"groups": [{"name": "same name", "ok": true|false, "note": "..."}], "overall": "..."}`,
      },
    ],
    900,
    'grouping',
  );
  const r = parseJSON<GroupCheck>(raw);
  return { groups: r.groups ?? [], overall: r.overall ?? '' };
}

/** A few ideas for a memory hook when the student asks for help (they can always write their own). */
export async function suggestHooks(c: Context, card: { q: string; a: string }): Promise<string[]> {
  if (!aiEnabled) {
    await wait(700);
    return DEMO.hooks;
  }
  const raw = await call(
    persona(c) + '\nMatch the language the student writes in.',
    [
      {
        type: 'text',
        text: `The student keeps forgetting this flashcard:
Q: ${card.q}
A: ${card.a}
Suggest 3 different memory hooks (a vivid image, a short rhyme, an acronym, or a silly sentence), each one line, that make the ANSWER easy to recall. They must be accurate: never change the answer.${c.interests.length ? `
The student loves: ${c.interests.join(', ')}. At least ONE of the 3 hooks (two at most) must be built on one of these: use a real, specific thing from it (a team, a player, a character, a game, a song…), so it feels like theirs. The other hooks can be anything.` : ''}
Return ONLY JSON: ["hook 1", "hook 2", "hook 3"]`,
      },
    ],
    500,
    'hooks',
  );
  return parseJSON<string[]>(raw).filter((x) => typeof x === 'string' && x.trim()).slice(0, 3);
}

/** A card the student got right 3 times in a row graduates: one harder, apply-it question replaces re-asking the same fact. */
export async function levelUp(c: Context, card: { q: string; a: string }): Promise<FlashCard> {
  if (!aiEnabled) {
    await wait(500);
    return DEMO.levelUp(card);
  }
  const raw = await call(
    persona(c) + '\nMatch the language the student writes in.',
    [
      {
        type: 'text',
        text: `The student has mastered this flashcard:
Q: ${card.q}
A: ${card.a}
Write ONE harder question on the same idea: it asks them to apply it to a new short situation, or to compare it with a related idea, instead of repeating the fact. Short, with a short accurate answer.
Return ONLY JSON: {"q": "...", "a": "..."}`,
      },
    ],
    500,
    'level up',
  );
  const r = parseJSON<FlashCard>(raw);
  if (!r?.q || !r?.a) throw new Error('empty level-up');
  return r;
}

/**
 * The student's written hook becomes a scene description for the picture maker, so the picture shows what the
 * hook says (every object, who does what, where). Nothing is added and the lesson is not explained.
 */
export async function hookToScene(c: Context, card: { q: string; a: string }, hook: string): Promise<string> {
  if (!aiEnabled) return hook.slice(0, 400);
  const raw = await call(
    'You turn a student’s memory hook into a precise scene description for an illustrator. Show exactly what the hook says. Never add new objects or ideas, never explain the lesson.',
    [
      {
        type: 'text',
        text: `The student wrote this memory hook for: "${card.q}" → "${card.a}".
Hook: "${hook}"
Describe ONE single picture for an illustrator in at most 70 words, in English: every object the hook mentions, who is doing what, and where things are. Words in brackets are the ideas the objects stand for: draw the objects, never write the bracketed words. No text or letters in the picture.
Return ONLY the description, no title, no quotes.`,
      },
    ],
    350,
    'hook scene',
  );
  return raw.trim().replace(/^["“]|["”]$/g, '').slice(0, 550);
}

/** Onboarding: Coco's first explanation. One hard idea from the student's field, explained through one
 *  thing they love. `themes` are that thing's tags from Qloo (what it is "about"), so the analogy rests on
 *  what the show / song / team is really like, not on guesses. Returns null when there's no AI. */
export async function explainWithWorld(
  concept: { name: string; usual: string; field: string },
  world: { name: string; kind: string; themes: string[] },
): Promise<string | null> {
  if (!aiEnabled) return null;
  const raw = await call(
    `You are Coco, a warm study buddy inside the Drrys app. You explain ONE hard idea from the student's field through ONE thing the student loves.
Rules:
- Build a single analogy that maps the parts of the idea onto that world. The concept must stay accurate: never bend the science to fit the story.
- Only mention characters, events or details of that world you are sure about. When unsure, use its general themes (given below) instead.
- If the student's world is from Islamic history, speak about its people and events with respect and use only well-established facts.
- 3 or 4 short sentences, simple English, at most 70 words. Family-friendly. No emojis.
Return ONLY JSON: {"analogy": "..."}`,
    [
      {
        type: 'text',
        text: `Idea: ${concept.name} (${concept.field}). Textbook definition: ${concept.usual}
The student loves: ${world.name} (${world.kind}).${world.themes.length ? ` Its themes: ${world.themes.slice(0, 10).join(', ')}.` : ''}`,
      },
    ],
    400,
    'explain with world',
  );
  const a = parseJSON<{ analogy?: string }>(raw).analogy?.trim();
  return a || null;
}
