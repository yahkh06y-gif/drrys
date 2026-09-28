import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Analysis, ActiveQuestion } from '@/lib/ai';

export type Material = { id: string; name: string; uri: string; size?: number; mime?: string };
export type Chapter = { id: string; title: string; materials: Material[]; mastery: number; sessions: number };
export type Subject = { id: string; name: string; days: number[]; chapters: Chapter[]; createdAt: number };

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
  goal?: string;
  interests: string[];
  signedIn: boolean;
  reminders: boolean;
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
  startedAt: number;
  correct: number;
};

type Stats = {
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
  sound: boolean;
  session?: SessionDraft;

  set: (p: Partial<State>) => void;
  setProfile: (p: Partial<Profile>) => void;
  addSubject: (s: Omit<Subject, 'id' | 'createdAt'>) => string;
  updateSubject: (id: string, s: Partial<Subject>) => void;
  startSession: (subjectId: string, chapterId: string) => void;
  patchSession: (p: Partial<SessionDraft>) => void;
  addCards: (cards: Omit<Card, 'id' | 'ease' | 'interval' | 'reps' | 'due'>[]) => string[];
  rateCard: (id: string, r: Rating) => void;
  finishSession: () => { xp: number; minutes: number; accuracy: number };
  buyOutfit: (o: Outfit, cost: number) => boolean;
  reset: () => void;
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const today = (d = new Date()) => d.toISOString().slice(0, 10);

const initial = {
  onboarded: false,
  profile: { name: '', email: '', interests: [], signedIn: false, reminders: false } as Profile,
  subjects: [] as Subject[],
  activeSubjectId: undefined as string | undefined,
  cards: [] as Card[],
  stats: { xp: 0, minutes: 0, quizCorrect: 0, quizTotal: 0, studyDays: [] } as Stats,
  coco: { outfit: 'classic' as Outfit, owned: ['classic', 'scarf'] as Outfit[], style: 'friendly' as CocoStyle, depth: 'balanced' as Depth, memory: true },
  isPro: false,
  sound: true,
  session: undefined as SessionDraft | undefined,
};

const DAY = 86_400_000;

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

      startSession: (subjectId, chapterId) =>
        set({
          session: {
            subjectId,
            chapterId,
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
            const due = interval === 0 ? Date.now() + 10 * 60_000 : Date.now() + interval * DAY;
            return { ...c, ease, interval, reps, due };
          }),
        });
      },

      finishSession: () => {
        const s = get().session;
        const st = get().stats;
        if (!s) return { xp: 0, minutes: 0, accuracy: 0 };
        const minutes = Math.max(1, Math.round((Date.now() - s.startedAt) / 60_000));
        const total = s.questions?.length ?? 0;
        const accuracy = total ? Math.round((s.correct / total) * 100) : 100;
        const xp = 10 + s.correct * 5 + (s.analysis?.nailed.length ?? 0) * 2;
        const days = st.studyDays.includes(today()) ? st.studyDays : [...st.studyDays, today()];
        // grow the chapter branch
        const subjects = get().subjects.map((sub) =>
          sub.id !== s.subjectId
            ? sub
            : {
                ...sub,
                chapters: sub.chapters.map((ch) =>
                  ch.id !== s.chapterId
                    ? ch
                    : { ...ch, sessions: ch.sessions + 1, mastery: Math.min(1, ch.mastery + 0.18 + accuracy / 1000) },
                ),
              },
        );
        set({
          subjects,
          stats: {
            xp: st.xp + xp,
            minutes: st.minutes + minutes,
            quizCorrect: st.quizCorrect + s.correct,
            quizTotal: st.quizTotal + total,
            studyDays: days,
          },
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
