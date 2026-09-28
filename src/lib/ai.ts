/**
 * Coco's brain — thin client for the Claude Messages API.
 *
 * If no API key is configured (EXPO_PUBLIC_ANTHROPIC_API_KEY), every call falls back to
 * a hand-written demo session so the app is still fully explorable (e.g. by judges).
 *
 * NOTE: calling the API straight from the app is fine for a prototype / competition build.
 * In production the key must live behind a small server proxy.
 */
import { Platform } from 'react-native';

import { DEMO } from './demo';

const KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';
const MODEL = process.env.EXPO_PUBLIC_CLAUDE_MODEL ?? 'claude-sonnet-5';

export const aiEnabled = KEY.length > 10;

export type Concept = { title: string; detail: string; tag: string };
export type Correction = { concept: string; youSaid: string; truth: string; formula?: string };
export type Analysis = {
  summary: string;
  nailed: Concept[];
  forgotten: (Concept & { page?: string })[];
  corrections: Correction[];
  keywords: string[]; // words from the recall that were correct (highlighted in the UI)
};
export type ActiveQuestion = { q: string; hint: string; ideal: string };
export type Grade = { correct: boolean; feedback: string };
export type FlashCard = { q: string; a: string };

export type Context = {
  subject: string;
  chapter: string;
  pdfBase64?: string;
  fromPage?: number;
  toPage?: number;
  interests: string[];
  style: string;
  depth: string;
};

type Block =
  | { type: 'text'; text: string }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } };

async function call(system: string, content: Block[], maxTokens = 2000): Promise<string> {
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

function parseJSON<T>(raw: string): T {
  const start = raw.search(/[[{]/);
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

const persona = (c: Context) => `You are Coco, a warm clay-figure study buddy inside the Drrys app.
Drrys teaches with evidence-based methods (active recall, elaboration, spaced repetition) without the student having to know them.
Style: ${c.style}. Depth: ${c.depth}. The student enjoys: ${c.interests.join(', ') || 'general topics'} — use ONE of these for analogies when it helps.
Subject: ${c.subject}. Chapter: ${c.chapter}.
Keep language simple, encouraging, and concise. Never invent facts that are not in the lecture material when material is provided.`;

function material(c: Context): Block[] {
  if (!c.pdfBase64) return [];
  return [
    { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: c.pdfBase64 } },
    { type: 'text', text: `Focus on pages ${c.fromPage ?? 1}–${c.toPage ?? 'end'} of the lecture above.` },
  ];
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
Write 3 short active-learning questions, one idea at a time, that make the student EXPLAIN (why/how), prioritising the gaps.
Q3 should ask them to explain it using an analogy from their interests.
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
      text: `Question: ${q.q}\nModel answer: ${q.ideal}\nStudent answer: """${answer}"""
Judge if the student's explanation captures the key idea (be fair, not pedantic).
Return ONLY JSON: {"correct": true|false, "feedback": "1-2 sentences in Coco's voice; if wrong, give the missing piece"}`,
    },
  ], 400);
  return parseJSON<Grade>(raw);
}

export async function makeCards(c: Context, a: Analysis): Promise<FlashCard[]> {
  if (!aiEnabled) return DEMO.cards;
  const raw = await call(persona(c), [
    {
      type: 'text',
      text: `From this session analysis create 4-6 flashcards that lock in what matters most (gaps first).
${JSON.stringify(a)}
Return ONLY JSON: [{"q": "short question", "a": "short answer"}]`,
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
