/**
 * Coco's brain — one thin client, two providers:
 *   - Claude (EXPO_PUBLIC_ANTHROPIC_API_KEY) — used when its key is set
 *   - Google Gemini (EXPO_PUBLIC_GEMINI_API_KEY) — the free-tier option, used otherwise
 * Both read the lecture PDF natively. With no key at all, every call falls back to a
 * hand-written demo session so the app is still fully explorable (e.g. by judges).
 *
 * NOTE: calling the API straight from the app is fine for a prototype / competition build.
 * In production the key must live behind a small server proxy.
 */
import { Platform } from 'react-native';

import { DEMO } from './demo';

const KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';
const MODEL = process.env.EXPO_PUBLIC_CLAUDE_MODEL || 'claude-sonnet-5-5';
const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.8-flash';

export const aiProvider: 'claude' | 'gemini' | null = KEY.length > 10 ? 'claude' : GEMINI_KEY.length > 10 ? 'gemini' : null;
export const aiEnabled = aiProvider !== null;
/** Shown in Profile → "Coco's brain". */
export const aiLabel = aiProvider === 'claude' ? 'Claude AI · live' : aiProvider === 'gemini' ? 'Gemini AI · live' : 'Demo mode';

export type Concept = { title: string; detail: string; tag: string };
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
export type ActiveQuestion = { q: string; hint: string; ideal: string; kind?: QKind };
export type PretestQ = { q: string; ideal: string };
export type GroupCheck = { groups: { name: string; ok: boolean; note: string }[]; overall: string };
/** `card`: when the answer shows a gap, one flashcard aimed at exactly what the student didn't get. */
export type Grade = { correct: boolean; feedback: string; card?: FlashCard | null };
export type FlashCard = { q: string; a: string };

export type Context = {
  subject: string;
  chapter: string;
  pdfBase64?: string;
  course?: { label: string; data: string }[]; // syllabus / past papers: guide what to ask, never new content
  fromPage?: number;
  toPage?: number;
  interests: string[];
  style: string;
  depth: string;
};

type Block =
  | { type: 'text'; text: string }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
  | { type: 'audio'; mime: string; data: string }; // Gemini only (voice → text)

async function call(system: string, content: Block[], maxTokens = 2000): Promise<string> {
  return aiProvider === 'gemini' ? callGemini(system, content, maxTokens) : callClaude(system, content, maxTokens);
}

async function callClaude(system: string, content: Block[], maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': KEY,
      'anthropic-version': '2023-06-01',
      ...(Platform.OS === 'web' ? { 'anthropic-dangerous-direct-browser-access': 'true' } : {}),
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return (json.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Gemini generateContent: the PDF goes in as inline data, the persona as the system instruction.
// Free-tier traffic is often turned away ("high demand" 503) or rate-limited (429). So:
//  - each request walks down a chain of Flash models until one answers,
//  - a model that just failed is skipped for a couple of minutes (no waiting on it again),
//  - the model that last worked is tried first,
//  - a request that hangs is cut off and the next model is tried,
//  - thinking is kept low: Coco's tasks don't need long deliberation, and it's much faster.
const GEMINI_CHAIN = [...new Set([GEMINI_MODEL, 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'])];
const RETRYABLE = new Set([404, 408, 429, 500, 503, 504]);
const cooldown = new Map<string, number>(); // model -> skip until (ms)
let lastGood: string | undefined;
let lastVoiceGood: string | undefined; // same idea for the transcription chain
const noThinking = new Set<string>(); // models that rejected the thinking setting

// Voice → text: Google's dedicated transcription model first (fast, made for this), then the light
// Flash models. Thinking is kept to a minimum — writing down speech needs no reasoning.
const TRANSCRIBE_CHAIN = ['gemini-3.5-transcribe', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash'];

type GeminiOpts = { chain?: string[]; thinking?: 'minimal' | 'low'; temperature?: number; timeoutMs?: number };

async function callGemini(system: string, content: Block[], maxTokens: number, opts: GeminiOpts = {}): Promise<string> {
  const parts = content.map((b) =>
    b.type === 'text'
      ? { text: b.text }
      : b.type === 'audio'
        ? { inline_data: { mime_type: b.mime, data: b.data } }
        : { inline_data: { mime_type: b.source.media_type, data: b.source.data } },
  );
  const bodyFor = (model: string) =>
    JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        maxOutputTokens: maxTokens + (opts.thinking === 'minimal' ? 256 : 2048),
        temperature: opts.temperature ?? 0.6,
        ...(noThinking.has(model) ? {} : { thinkingConfig: { thinkingLevel: opts.thinking ?? 'low' } }),
      },
    });
  const now = Date.now();
  const chain = opts.chain ?? GEMINI_CHAIN;
  const first = opts.chain ? lastVoiceGood : lastGood;
  const order = [...chain].sort((x, y) => (x === first ? -1 : y === first ? 1 : 0));
  const ready = order.filter((m) => (cooldown.get(m) ?? 0) < now);
  const tryList = ready.length ? ready : order; // everything cooling down → try anyway
  const hasPdf = content.some((b) => b.type === 'document');
  const hasAudio = content.some((b) => b.type === 'audio');
  let last = '';
  for (const model of tryList) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctrl = new AbortController();
      // the full-session request (PDF in, analysis + questions + cards out) legitimately takes a while
      const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? (hasPdf ? 120000 : hasAudio ? 45000 : 30000));
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
          body: bodyFor(model),
          signal: ctrl.signal,
        });
        if (res.ok) {
          const json = await res.json();
          const out = json.candidates?.[0]?.content?.parts ?? [];
          const text = out.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought).map((p: { text: string }) => p.text).join('');
          if (text) {
            if (opts.chain) lastVoiceGood = model;
            else lastGood = model;
            return text;
          }
          last = `${model}: empty reply`;
          break;
        }
        const errText = (await res.text()).slice(0, 300);
        last = `Gemini API ${res.status} (${model}): ${errText.slice(0, 160)}`;
        if (res.status === 400 && /thinking/i.test(errText) && !noThinking.has(model)) {
          noThinking.add(model); // this model doesn't take the thinking setting — same model again without it
          continue;
        }
        // a special-purpose model may turn down this input (400): the next model in its chain can still do it
        if (opts.chain && res.status === 400 && !/API key/i.test(errText)) {
          cooldown.set(model, Date.now() + 600000);
          break;
        }
        if (!RETRYABLE.has(res.status)) throw Object.assign(new Error(last), { fatal: true }); // bad key / bad request — another model won't help
        cooldown.set(model, Date.now() + 120000);
        break;
      } catch (e) {
        if ((e as { fatal?: boolean }).fatal) throw e;
        // timed out (RN reports an aborted fetch as "Fetch request has been canceled") or the network
        // dropped: try the next model rather than failing the whole session
        last = ctrl.signal.aborted ? `${model}: timed out` : `${model}: ${(e as Error).message}`;
        cooldown.set(model, Date.now() + 120000);
        break;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  throw new Error(last);
}

function parseJSON<T>(raw: string): T {
  const start = raw.search(/[[{]/);
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

const persona = (c: Context) => `You are Coco, a warm clay-figure study buddy inside the Drrys app.
Drrys teaches with evidence-based methods (active recall, elaboration, spaced repetition) without the student having to know them.
Style: ${c.style}. Depth: ${c.depth}.
${c.interests.length ? `The student enjoys: ${c.interests.join(', ')}. You MAY use one of these for an analogy, but only now and then — when an idea is genuinely hard to picture. Most explanations need no hobby analogy; never force one into every answer.` : 'Do not assume any hobbies.'}
Subject: ${c.subject}. Chapter: ${c.chapter}.
STAY INSIDE THE STUDENT'S MATERIAL: when lecture files are provided (or the session is built on them), every fact, definition, number, example and question must come from those files. Do not bring in outside information, extra topics or details the lecture doesn't contain. If something isn't covered in the material, say so instead of filling it in.
Keep language simple, encouraging, and concise.`;

function material(c: Context): Block[] {
  const blocks: Block[] = [];
  if (c.pdfBase64) {
    blocks.push(
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: c.pdfBase64 } },
      { type: 'text', text: `The document above is TODAY'S LECTURE (pages ${c.fromPage ?? 1}–${c.toPage ?? 'end'}). It is the only source of content for this session.` },
    );
  }
  for (const f of c.course ?? []) {
    blocks.push(
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } },
      { type: 'text', text: `The document above is the ${f.label}. Use it ONLY to judge which of today's lecture ideas are most examinable and how exam questions are phrased — do not quiz on anything that isn't in today's lecture.` },
    );
  }
  return blocks;
}


export type SessionPlan = { analysis: Analysis; questions: ActiveQuestion[]; cards: FlashCard[] };

/**
 * One request per session instead of three: the lecture PDF is sent once, and the analysis, the
 * active-learning questions and the flashcards all come back together (much faster, and on the free
 * tier it's a third of the requests).
 */
export async function prepareSession(c: Context, recall: string): Promise<SessionPlan> {
  if (!aiEnabled) {
    await wait(2200);
    return { analysis: DEMO.analysis, questions: DEMO.questions, cards: DEMO.cards };
  }
  const raw = await call(
    persona(c),
    [
      ...material(c),
      {
        type: 'text',
        text: `The student did a "brain dump" — everything they remember about this, from memory:
"""${recall}"""

Compare it with ${c.pdfBase64 ? "today's lecture pages" : 'the topic (no lecture file attached, so use standard curriculum knowledge for this chapter)'} and prepare today's session.
Return ONLY JSON with this shape:
{
 "analysis": {
   "summary": "1 short encouraging sentence",
   "nailed": [{"title": "concept", "detail": "what they got right (1 sentence)", "tag": "Strong Recall|Exact Match|Firmly Grasped"}],
   "forgotten": [{"title": "important idea from the lecture they did not mention", "detail": "teach it clearly in 2-3 simple sentences, as if explaining it for the first time", "tag": "Missed", "page": "page ref if known"}],
   "corrections": [{"concept": "name", "youSaid": "their wrong statement (quote/paraphrase)", "truth": "the correct idea in 1-2 sentences", "formula": "optional short formula"}],
   "keywords": ["exact short phrases copied from the student's text that are correct"]
 },
 "questions": [{"kind": "conceptual|procedural|analogous|evidence", "q": "...", "hint": "a nudge, not the answer", "ideal": "model answer in 1-2 sentences"}],
 "cards": [{"q": "short question", "a": "short, accurate answer"}]
}
Rules:
- analysis.forgotten: list EVERY important idea of these pages the student left out (not just a few), most important first; max 8. Each detail must actually teach the idea, because the student reads these before being questioned.
- analysis.corrections: every wrong statement, max 6. nailed: max 6. Empty lists are fine.
- questions: no fixed number — as many as it takes to cover every missed and corrected idea that matters (a light lecture may need 3, a dense one 8 or more). They make the student EXPLAIN (why/how), one idea each: mostly the missed and corrected ideas (only ones taught in analysis above), plus one that deepens something they already got right. Ask them the way an exam would: prioritise ideas the syllabus/past papers emphasise and mirror the past papers' question style when those files are attached. ${c.interests.length ? 'At most ONE question may invite an analogy from their interests, and only if an idea is abstract enough to need it; the rest are plain exam-style questions.' : ''} Never ask about something that is not in today's lecture pages or the analysis.
  Give each question a "kind" that fits the idea (this is how Drrys picks the right way to practise it):
    conceptual — how two or more ideas relate ("how does X change Y?", "why does X lead to Y?");
    procedural — a process or calculation: the student writes the steps in order or works a tiny example;
    analogous — a comparison from the lecture: the student says where it fits AND where it stops working;
    evidence — a fact or example from the lecture: the student uses it on a new, short scenario.
  Mix the kinds; use whichever fits each idea, never force a kind that doesn't fit.
- cards: only REFERENCE material — terms, definitions, numbers, formulas, lists, labels — the things that are simply remembered. Ideas that are better practised by explaining (the questions above) do not get a card. Built from the LECTURE content, not from the student's wording: the corrected misconceptions first, then the missed reference facts, then the other key reference facts of these pages. No fixed number — one card per fact worth memorising, as many as the material holds; dense pages get many cards, light pages few. Never pad with trivia, never skip a key idea, never add facts that aren't in the lecture.`,
      },
    ],
    9000, // dense lectures can need many questions and cards
  );
  const plan = parseJSON<SessionPlan>(raw);
  const a = plan?.analysis;
  if (!a) throw new Error('Coco’s answer came back incomplete');
  // the model sometimes leaves a list out: make every list safe to read
  const analysis = { ...a, nailed: a.nailed ?? [], forgotten: a.forgotten ?? [], corrections: a.corrections ?? [], keywords: a.keywords ?? [] };
  const KINDS: QKind[] = ['conceptual', 'procedural', 'analogous', 'evidence'];
  const questions = (plan.questions ?? []).filter((q) => q?.q).map((q) => ({ ...q, kind: KINDS.includes(q.kind as QKind) ? q.kind : 'conceptual' }) as ActiveQuestion);
  const cards = (plan.cards ?? []).filter((c) => c?.q && c?.a);
  return { analysis, questions, cards };
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
  return call(
    persona(c) +
      '\nYou are in the middle of an active-learning exchange. Reply in 1-3 short sentences. If the student is partly right, say which part. Prefer a guiding question over just giving the answer, unless they are clearly stuck. Match the language the student writes in.',
    [
      {
        type: 'text',
        text: `Question: ${q.q}\nModel answer: ${q.ideal}\nStudent's answer: """${answer}"""\nYour feedback: ${feedback}\n\n${convo}\nCoco:`,
      },
    ],
    500,
  );
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

Compare it with the lecture${c.pdfBase64 ? '' : ' topic (no file attached, use standard curriculum knowledge)'}.
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
  ]);
  return parseJSON<ActiveQuestion[]>(raw);
}

export async function gradeAnswer(c: Context, q: ActiveQuestion, answer: string): Promise<Grade> {
  if (!aiEnabled) {
    await wait(900);
    const ok = answer.trim().split(/\s+/).length >= 5;
    return { correct: ok, feedback: ok ? DEMO.goodFeedback : DEMO.tryFeedback };
  }
  const raw = await call(persona(c), [
    {
      type: 'text',
      text: `Question (${q.kind ?? 'conceptual'}): ${q.q}\nModel answer: ${q.ideal}\nStudent answer: """${answer}"""
${q.kind === 'analogous' ? 'This is a comparison question: the answer must say where the comparison fits AND where it stops working.\n' : ''}${q.kind === 'procedural' ? 'This is a procedure question: the steps must be right and in the right order.\n' : ''}Judge if the student's explanation captures the key idea (be fair, not pedantic). The model answer comes from the lecture: judge against it and add nothing from outside it.
Also spot the gap: if the answer is wrong, incomplete or mixes something up, write ONE flashcard aimed at exactly that
missing or confused point (not the whole question again), answered from the lecture. If the answer is fully right, "card" is null.
Return ONLY JSON: {"correct": true|false, "feedback": "1-2 sentences in Coco's voice; if wrong, give the missing piece",
"card": {"q": "short question on the exact gap", "a": "short, accurate answer"} | null}`,
    },
  ], 700);
  return parseJSON<Grade>(raw);
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
Return ONLY JSON: [{"q": "short question", "a": "short, accurate answer"}]`,
    },
  ]);
  return parseJSON<FlashCard[]>(raw);
}

export async function chatCoco(c: Context, history: { role: 'user' | 'assistant'; text: string }[]): Promise<string> {
  if (!aiEnabled) {
    await wait(700);
    return DEMO.chat[history.length % DEMO.chat.length];
  }
  const convo = history.map((m) => `${m.role === 'user' ? 'Student' : 'Coco'}: ${m.text}`).join('\n');
  return call(persona(c) + '\nReply in 1-3 short sentences. Match the language the student writes in.', [
    { type: 'text', text: `${convo}\nCoco:` },
  ], 500);
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
  return call(
    persona(c) +
      '\nThe student is reviewing a flashcard and has a question about it. Explain simply in 1-4 short sentences, using what the card and lecture say; an example helps. Match the language the student writes in.',
    [{ type: 'text', text: `Flashcard — Q: ${card.q}\nA: ${card.a}\n\n${convo}\nCoco:` }],
    600,
  );
}

/** Voice → text needs Gemini (Claude doesn't take audio). With a Claude-only setup the keyboard mic still works. */
export const voiceEnabled = GEMINI_KEY.length > 10;

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
    { chain: TRANSCRIBE_CHAIN, thinking: 'minimal', temperature: 0, timeoutMs: 25000 },
  );
  const text = out.trim();
  return /^\[silence\]$/i.test(text) ? '' : text;
}


/* ---------- warm-up, grouping, memory hooks, level-up ---------- */

/** Warm-up before the recall: two short questions on today's pages. They are meant to be hard — a wrong guess still primes the brain. */
export async function makePretest(c: Context): Promise<PretestQ[]> {
  if (!aiEnabled) {
    await wait(900);
    return DEMO.pretest;
  }
  const raw = await call(
    persona(c),
    [
      ...material(c),
      {
        type: 'text',
        text: `The student is about to study ${c.pdfBase64 ? "today's lecture pages" : 'this chapter'}. Write exactly 2 warm-up questions on the big ideas they are about to meet.
They are guesses, not a test: the student has NOT studied this yet, so ask about the "why" or "how" of a central idea, answerable in one sentence, never a trivia fact.
Answer ONLY from ${c.pdfBase64 ? 'the lecture pages' : 'standard curriculum knowledge for this chapter'}.
Return ONLY JSON: [{"q": "...", "ideal": "the answer in 1-2 simple sentences"}]`,
      },
    ],
    900,
  );
  return parseJSON<PretestQ[]>(raw).filter((x) => x?.q && x?.ideal).slice(0, 2);
}

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
Suggest 3 different memory hooks (a vivid image, a short rhyme, an acronym, or a silly sentence), each one line, that make the ANSWER easy to recall. They must be accurate: never change the answer.
Return ONLY JSON: ["hook 1", "hook 2", "hook 3"]`,
      },
    ],
    500,
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
  );
  const r = parseJSON<FlashCard>(raw);
  if (!r?.q || !r?.a) throw new Error('empty level-up');
  return r;
}
