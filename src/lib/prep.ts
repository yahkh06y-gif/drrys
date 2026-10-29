// Session step 2, in the background. The student only waits for the analysis (lib/ai: analyseSession); while
// they read it, the questions (with their pictures) and the flashcards are written here, and they land in the
// session as soon as they are ready. The questions page and the flashcards page wait for them only if the
// student gets there first. If the app was closed in between, they are simply asked for again.
import { analyseSession, planQuestions, timed, writeCards, writeQuestions, type Lesson } from './ai';
import { attachPictures } from './figures';
import { sessionContext } from './session';
import { useApp } from '@/store';

const running = new Map<string, { questions: Promise<void>; cards: Promise<void> }>();

const keyOf = () => useApp.getState().session?.analyzedFor ?? '';
/** Still the same session and analysis this work was started for. */
const current = (key: string) => !!key && keyOf() === key;

/** Where the analysis is: 1 = the lecture file is ready, 2 = Coco's answer is in. */
export type AnalyseStep = 1 | 2;

/** Step 1: the analysis. Kept on the session; the background step starts right away.
 *  `onStep` is told when each real part is done, so the screen shows real progress. */
export async function analyse(key: string, onStep?: (step: AnalyseStep) => void): Promise<void> {
  const st = useApp.getState();
  const t0 = Date.now();
  const ctx = await timed('lecture file ready', () => sessionContext());
  onStep?.(1);
  const lesson = await analyseSession(ctx, st.session!.recall);
  onStep?.(2);
  console.log(`[timing] analysis screen total · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  // a fresh analysis: forget the questions, answers and cards of an earlier attempt
  st.patchSession({ analysis: lesson.analysis, map: lesson.map, analyzedFor: key, questions: undefined, draftCards: undefined, answers: [], correct: 0, newCardIds: [], gapCards: [], results: [], qIndex: 0 });
  running.delete(key);
  prepare();
}

/** Start (or join) the background step for the current analysis. */
function prepare() {
  const key = keyOf();
  const s = useApp.getState().session;
  if (!s?.analysis || !key) return undefined;
  let job = running.get(key);
  if (job) return job;
  const lesson: Lesson = { analysis: s.analysis, map: s.map ?? [] };
  const ctx = sessionContext();
  const questions = s.questions
    ? Promise.resolve()
    : (async () => {
        const c = await ctx;
        const t0 = Date.now();
        const qs = await attachPictures(c, await writeQuestions(c, lesson, planQuestions(lesson.map, lesson.analysis)));
        console.log(`[timing] questions ready (written + pictures) · ${((Date.now() - t0) / 1000).toFixed(1)}s · ${qs.length} questions`);
        if (current(key)) useApp.getState().patchSession({ questions: qs });
      })();
  const cards = s.draftCards
    ? Promise.resolve()
    : (async () => {
        const c = await ctx;
        const made = await writeCards(c, lesson);
        if (current(key)) useApp.getState().patchSession({ draftCards: made });
      })();
  job = { questions, cards };
  running.set(key, job);
  // a failed part can be asked for again (the page that needs it shows a retry)
  questions.catch(() => running.get(key) === job && running.delete(key));
  cards.catch(() => {});
  return job;
}

/** Wait for the questions (started now if nothing is writing them). Throws if they could not be written. */
export async function questionsReady(): Promise<void> {
  if (useApp.getState().session?.questions) return;
  await prepare()?.questions;
}

/** Wait for the flashcards. Never throws: without them the flashcards page makes its own. */
export async function cardsReady(): Promise<void> {
  if (useApp.getState().session?.draftCards) return;
  try {
    await prepare()?.cards;
  } catch {}
}
