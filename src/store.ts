import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Analysis, ActiveQuestion } from '@/lib/ai';

export type Material = { id: string; name: string; uri: string; size?: number; mime?: string };
export type Chapter = { id: string; title: string; materials: Material[]; mastery: number; sessions: number };
export type Subject = {
  id: string;
  name: string;
  days: number[]; // lecture weekdays (0 = Sunday)
  chapters: Chapter[];
  createdAt: number;
  doneOn?: string; // YYYY-MM-DD of the last day this tree's daily session was finished
  doneDays?: string[]; // recent days it was watered (for the week strip)
  // course-wide files: they help Coco aim at the exam, but don't add branches to the tree
  syllabus?: Material;
  pastPapers?: Material[];
  stats?: Stats; // this tree's own progress (streak, accuracy, time, XP)
};

export type Card = {
  id: string;
  subjectId: string;
  chapterId: string;
  q: string;
  a: string;
  ease: number; // SM-2 ease factor
  interval: number; // days
  reps: number;
  due: number; // epoch ms
};

export type Rating = 'forgot' | 'hard' | 'good' | 'easy';

export type Outfit = 'classic' | 'scarf' | 'birthday' | 'ninja';
export type CocoStyle = 'friendly' | 'calm' | 'direct' | 'playful';
export type Depth = 'quick' | 'balanced' | 'deep';

export type Profile = {
  name: string;
  email: string;
  field?: string;
  subfield?: string;
  source?: string;
  goal?: string[] | string; // multi-select; older installs stored a single string
  interests: string[];
  signedIn: boolean;
  reminders: boolean;
  reminderHour?: number; // when Coco's daily reminder comes (default 19:00)
  uid?: string; // signed-in account (Supabase cloud backup)
  lastUid?: string; // the account that last signed out on this phone
};

export type SessionDraft = {
  subjectId: string;
  chapterId: string;
  materialId?: string;
  fromPage: number;
  toPage: number;
  recall: string;
  analysis?: Analysis;
  questions?: ActiveQuestion[];
  answers: string[];
  newCardIds: string[];
  draftCards?: { q: string; a: string }[]; // made together with the analysis, added to the deck at the end
  gapCards?: { q: string; a: string }[]; // from active learning: one card per thing the student didn't get
  startedAt: number;
  correct: number;
  result?: { xp: number; minutes: number; accuracy: number }; // set once scored, so it's never counted twice
};

export type Together = {
  code: string | null; // my invite code
  friends: number; // invited friends who finished their first session
  pending: number; // invited, not studied yet
  invited: boolean; // I joined with someone's invite code
  squad: { code: string; leader: boolean; members: { name: string; me: boolean }[] } | null;
};

export type Stats = {
  xp: number;
  minutes: number;
  quizCorrect: number;
  quizTotal: number;
  studyDays: string[]; // YYYY-MM-DD
};

type State = {
  hydrated: boolean;
  onboarded: boolean;
  profile: Profile;
  subjects: Subject[];
  activeSubjectId?: string;
  cards: Card[];
  stats: Stats;
  coco: { outfit: Outfit; owned: Outfit[]; style: CocoStyle; depth: Depth; memory: boolean };
  isPro: boolean;
  together?: Together; // invites + study squad (from the account; refreshed on open)
  sound: boolean;
  session?: SessionDraft;
  coachSeen: boolean; // Coco has explained the daily watering once
  justWatered?: string; // subject whose full session just finished → Coco waters that tree once

  set: (p: Partial<State>) => void;
  setProfile: (p: Partial<Profile>) => void;
  addSubject: (s: Omit<Subject, 'id' | 'createdAt'>) => string;
  updateSubject: (id: string, s: Partial<Subject>) => void;
  removeSubject: (id: string) => void;
  markDone: (subjectId: string) => void;
  logReview: (subjectId: string | undefined, cards: number) => void;
  startSession: (subjectId: string, chapterId: string) => void;
  patchSession: (p: Partial<SessionDraft>) => void;
  addCards: (cards: Omit<Card, 'id' | 'ease' | 'interval' | 'reps' | 'due'>[]) => string[];
  rateCard: (id: string, r: Rating) => void;
  finishSession: () => { xp: number; minutes: number; accuracy: number };
  buyOutfit: (o: Outfit, cost: number) => boolean;
  reset: () => void;
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
// Local calendar day (YYYY-MM-DD) — the user's own "today", not UTC, so it agrees with getDay().
export const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const initial = {
  onboarded: false,
  profile: { name: '', email: '', interests: [], signedIn: false, reminders: false } as Profile,
  subjects: [] as Subject[],
  activeSubjectId: undefined as string | undefined,
  cards: [] as Card[],
  stats: { xp: 0, minutes: 0, quizCorrect: 0, quizTotal: 0, studyDays: [] } as Stats,
  coco: { outfit: 'classic' as Outfit, owned: ['classic', 'scarf'] as Outfit[], style: 'friendly' as CocoStyle, depth: 'balanced' as Depth, memory: true },
  isPro: false,
  together: undefined as Together | undefined,
  sound: true,
  session: undefined as SessionDraft | undefined,
  coachSeen: false,
};

const DAY = 86_400_000;

/** Flashcards are scheduled by calendar day (like Anki): a card due "tomorrow" is due all of tomorrow,
 *  not only after the exact time it was studied. So "due" means: due by the end of that day. */
export const endOfDay = (t = Date.now()) => {
  const d = new Date(t);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};
export const isDue = (c: { due: number }, at = Date.now()) => c.due <= endOfDay(at);

export const EMPTY_STATS: Stats = { xp: 0, minutes: 0, quizCorrect: 0, quizTotal: 0, studyDays: [] };

/** Add a study event to a stats record (and count today as a study day). */
const addStats = (st: Stats | undefined, d: { xp?: number; minutes?: number; correct?: number; total?: number }): Stats => {
  const b = st ?? EMPTY_STATS;
  const t = today();
  return {
    xp: b.xp + (d.xp ?? 0),
    minutes: b.minutes + (d.minutes ?? 0),
    quizCorrect: b.quizCorrect + (d.correct ?? 0),
    quizTotal: b.quizTotal + (d.total ?? 0),
    studyDays: b.studyDays.includes(t) ? b.studyDays : [...b.studyDays, t],
  };
};

/** Mark a tree as watered today (keeps the last three weeks for the week strip). */
const watered = (x: Subject): Subject => {
  const d = today();
  const days = (x.doneDays ?? []).filter((k) => k !== d);
  return { ...x, doneOn: d, doneDays: [...days, d].slice(-21) };
};

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      hydrated: false,
      ...initial,

      set: (p) => set(p),
      setProfile: (p) => set({ profile: { ...get().profile, ...p } }),

      addSubject: (s) => {
        const id = uid();
        set({ subjects: [...get().subjects, { ...s, id, createdAt: Date.now() }], activeSubjectId: id });
        return id;
      },
      updateSubject: (id, s) =>
        set({ subjects: get().subjects.map((x) => (x.id === id ? { ...x, ...s } : x)) }),

      // Today's session for this tree is finished (full session on lecture days, flashcards otherwise).
      markDone: (subjectId) => set({ subjects: get().subjects.map((x) => (x.id === subjectId ? watered(x) : x)) }),

      // A flashcard review: 2 XP a card, counted for the tree it belongs to and for the total.
      logReview: (subjectId, n) => {
        const d = { xp: n * 2 };
        set({
          stats: addStats(get().stats, d),
          subjects: get().subjects.map((x) => (x.id === subjectId ? { ...x, stats: addStats(x.stats, d) } : x)),
        });
      },

      // Cut down a tree: the subject, its flashcards and any unfinished session on it.
      removeSubject: (id) => {
        const { subjects, activeSubjectId, cards, session } = get();
        const i = subjects.findIndex((x) => x.id === id);
        const rest = subjects.filter((x) => x.id !== id);
        const next = activeSubjectId === id ? rest[Math.max(0, i - 1)]?.id : activeSubjectId;
        set({
          subjects: rest,
          activeSubjectId: next,
          cards: cards.filter((c) => c.subjectId !== id),
          session: session?.subjectId === id ? undefined : session,
        });
      },

      startSession: (subjectId, chapterId) =>
        set({
          session: {
            subjectId,
            chapterId,
            // the chapter's latest lecture file is used unless the student picks another (or none)
            materialId: get().subjects.find((x) => x.id === subjectId)?.chapters.find((c) => c.id === chapterId)?.materials.at(-1)?.id,
            fromPage: 1,
            toPage: 10,
            recall: '',
            answers: [],
            newCardIds: [],
            startedAt: Date.now(),
            correct: 0,
          },
        }),
      patchSession: (p) => {
        const s = get().session;
        if (s) set({ session: { ...s, ...p } });
      },

      addCards: (cards) => {
        const now = Date.now();
        const made = cards.map((c) => ({ ...c, id: uid(), ease: 2.5, interval: 0, reps: 0, due: now }));
        set({ cards: [...get().cards, ...made] });
        return made.map((c) => c.id);
      },

      // Lightweight SM-2 spaced repetition.
      rateCard: (id, r) => {
        const q = { forgot: 1, hard: 3, good: 4, easy: 5 }[r];
        set({
          cards: get().cards.map((c) => {
            if (c.id !== id) return c;
            let { ease, interval, reps } = c;
            if (q < 3) {
              reps = 0;
              interval = 0; // see again later today
            } else {
              reps += 1;
              interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(interval * ease);
              if (r === 'easy') interval = Math.round(interval * 1.3);
            }
            ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
            // forgot → again in 10 minutes; otherwise the start of the day `interval` days from now
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const due = interval === 0 ? Date.now() + 10 * 60_000 : start.getTime() + interval * DAY + 60 * 60_000; // +1h: safe across DST
            return { ...c, ease, interval, reps, due };
          }),
        });
      },

      finishSession: () => {
        const s = get().session;
        const st = get().stats;
        if (!s) return { xp: 0, minutes: 0, accuracy: 0 };
        if (s.result) return s.result; // already scored (e.g. the Done screen was opened again)
        const minutes = Math.max(1, Math.round((Date.now() - s.startedAt) / 60_000));
        const total = s.questions?.length ?? 0;
        const accuracy = total ? Math.round((s.correct / total) * 100) : 100;
        const xp = 10 + s.correct * 5 + (s.analysis?.nailed.length ?? 0) * 2;
        const delta = { xp, minutes, correct: s.correct, total };
        // grow the chapter branch
        const subjects = get().subjects.map((sub) =>
          sub.id !== s.subjectId
            ? sub
            : {
                ...watered(sub),
                stats: addStats(sub.stats, delta),
                chapters: sub.chapters.map((ch) =>
                  ch.id !== s.chapterId
                    ? ch
                    : { ...ch, sessions: ch.sessions + 1, mastery: Math.min(1, ch.mastery + 0.18 + accuracy / 1000) },
                ),
              },
        );
        set({
          subjects,
          justWatered: s.subjectId,
          stats: addStats(st, delta),
          session: { ...s, result: { xp, minutes, accuracy } },
        });
        return { xp, minutes, accuracy };
      },

      buyOutfit: (o, cost) => {
        const { coco, stats } = get();
        if (coco.owned.includes(o)) {
          set({ coco: { ...coco, outfit: o } });
          return true;
        }
        if (stats.xp < cost) return false;
        set({ coco: { ...coco, outfit: o, owned: [...coco.owned, o] }, stats: { ...stats, xp: stats.xp - cost } });
        return true;
      },

      reset: () => set({ ...initial }),
    }),
    {
      name: 'drrys-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated, set: _s, ...rest }) => rest as never,
      onRehydrateStorage: () => () => useApp.setState({ hydrated: true }),
    },
  ),
);

export function streak(days: string[]) {
  const set = new Set(days);
  let n = 0;
  const d = new Date();
  if (!set.has(today(d))) d.setDate(d.getDate() - 1); // today not done yet keeps yesterday's streak
  while (set.has(today(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export const activeSubject = (s: State) => s.subjects.find((x) => x.id === s.activeSubjectId) ?? s.subjects[0];
