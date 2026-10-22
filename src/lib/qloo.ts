// Qloo (taste AI): finds the things a student loves, and what else fans of those things love.
// The app never holds the Qloo key: every call goes through Drrys' server function (supabase/functions/qloo).
// If Qloo can't be reached (offline, or the hackathon key has expired), every call fails quietly: the
// ready-made lists still work, only the "more like this" and the exploring are skipped.
// No pictures are shown anywhere: Qloo can't say what's in an image, so Drrys shows names and icons only.
import { callFunction } from '@/lib/cloud';
import type { WorldItem, WorldType } from '@/store';

const ask = <T>(body: unknown, timeoutMs?: number) => callFunction<T>('qloo', body, timeoutMs);

/** "Can't find it? Search…" */
export async function searchWorld(query: string, type?: WorldType): Promise<WorldItem[]> {
  const r = await ask<{ items: WorldItem[] }>({ action: 'search', query, type }, 10000);
  return r.items ?? [];
}

/** The ready-made names, turned into real Qloo things (ids and themes). Same order as asked;
 *  null where Qloo had no match. */
export async function resolveStarters(items: { name: string; type: WorldType }[]): Promise<(WorldItem | null)[]> {
  const r = await ask<{ items: (WorldItem | null)[] }>({ action: 'resolve', items }, 30000);
  return items.map((_, i) => r.items?.[i] ?? null);
}

/** Three things close to one the student just picked (the grid learns as they pick). */
export async function relatedTo(item: WorldItem): Promise<WorldItem[]> {
  if (!item.id) return [];
  const r = await ask<{ items: WorldItem[] }>({ action: 'related', id: item.id, type: item.type }, 8000);
  return r.items ?? [];
}

/** For each pick, what else its fans love, plus the themes (tags) of the student's whole world. */
export async function exploreWorld(picks: WorldItem[]): Promise<{ groups: { from: string; items: WorldItem[] }[]; tags: string[] }> {
  const withIds = picks.filter((p) => p.id).map((p) => ({ id: p.id, type: p.type, tags: p.tags ?? [] }));
  if (!withIds.length) return { groups: [], tags: [] };
  const r = await ask<{ groups: { from: string; items: WorldItem[] }[]; tags: string[] }>({ action: 'explore', picks: withIds }, 40000);
  return { groups: r.groups ?? [], tags: r.tags ?? [] };
}

/* ---------- the categories and ready-made lists (names only: ids and themes come from Qloo at run time) ---------- */

export type CategoryKey = 'sports' | 'movies' | 'shows' | 'books' | 'islamic';

/** First the student picks whole areas, then things inside them. No music and no celebrities: these are the
 *  worlds that make good analogies. "Islamic history" is Drrys' own list (Qloo has no taste data for it). */
export const CATEGORIES: { key: CategoryKey; label: string; emoji: string; type: WorldType; qloo: boolean }[] = [
  { key: 'sports', label: 'Sports', emoji: '⚽', type: 'brand', qloo: true },
  { key: 'movies', label: 'Movies', emoji: '🎬', type: 'movie', qloo: true },
  { key: 'shows', label: 'Shows & Anime', emoji: '📺', type: 'tv_show', qloo: true },
  { key: 'books', label: 'Books', emoji: '📚', type: 'book', qloo: true },
  { key: 'islamic', label: 'Islamic history', emoji: '🕌', type: 'history', qloo: false },
];
export const categoryOf = (t: WorldType) => CATEGORIES.find((c) => c.type === t);

export const STARTERS: Record<CategoryKey, string[]> = {
  sports: ['Real Madrid', 'FC Barcelona', 'Liverpool F.C.', 'Manchester City', 'Al Hilal', 'Al Ahly', 'Al-Faisaly', 'Bayern Munich', 'Formula 1', 'NBA', 'Paris Saint-Germain', 'Juventus'],
  movies: ['The Message', 'Lion of the Desert', 'Interstellar', 'Spirited Away', 'Toy Story', 'Finding Nemo', 'Up', 'Ratatouille', 'Kung Fu Panda', 'How to Train Your Dragon', 'Inception', 'The Lion King'],
  shows: ['One Piece', 'Captain Tsubasa', 'Detective Conan', 'Attack on Titan', 'Naruto', 'Hunter x Hunter', 'Resurrection: Ertugrul', 'Omar', 'Avatar: The Last Airbender', 'Planet Earth', 'Sherlock', 'Haikyu!!'],
  books: ['Atomic Habits', 'The Sealed Nectar', "Don't Be Sad", 'The 7 Habits of Highly Effective People', 'Rich Dad Poor Dad', 'The Little Prince', 'Thinking, Fast and Slow', 'The Adventures of Sherlock Holmes', '1984', 'Deep Work', 'The Muqaddimah', "Man's Search for Meaning"],
  islamic: [
    'Khalid ibn al-Walid',
    'Umar ibn al-Khattab',
    'Abu Bakr al-Siddiq',
    'Ali ibn Abi Talib',
    'Salah al-Din al-Ayyubi',
    'Muhammad al-Fatih',
    'The Battle of Badr',
    'The Battle of Yarmouk',
    'The Hijra',
    'Building the Prophet’s Mosque',
    'The House of Wisdom',
    'Ibn al-Haytham',
  ],
};

/** Shown on every card instead of a picture. */
export const TYPE_EMOJI: Record<WorldType, string> = { tv_show: '📺', movie: '🎬', artist: '🎵', brand: '⚽', book: '📚', person: '🌟', podcast: '🎙️', history: '🕌' };

export const TYPE_LABEL: Record<WorldType, string> = { tv_show: 'Show', movie: 'Movie', artist: 'Music', brand: 'Sports team', book: 'Book', person: 'Person', podcast: 'Podcast', history: 'Islamic history' };

/** Coco's quick reaction to a pick (written by hand, no AI, so it's instant). */
const COMMENTS: Record<WorldType, string[]> = {
  tv_show: ['{n}? Great taste.', '{n}! Respect.', 'Ooh, {n}. Good one.'],
  movie: ['{n}? A classic.', '{n}! Great pick.', 'I like {n} too.'],
  artist: ['{n}? Nice.'],
  brand: ['{n}! Let’s go!', '{n} fan? Nice.', '{n}! Great choice.'],
  book: ['A reader! {n} is a great one.', '{n}? Smart pick.'],
  person: ['{n}? Nice.'],
  podcast: ['{n}? Good listen.'],
  history: ['{n}: there’s so much to learn from it.', 'Great choice. {n} has a lot to teach us.'],
};
export function cocoComment(item: WorldItem, nth: number) {
  const list = COMMENTS[item.type] ?? COMMENTS.tv_show;
  return list[nth % list.length].replace('{n}', item.name);
}
