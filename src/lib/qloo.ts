// Qloo (taste AI): finds the things a student loves, and what else fans of those things love.
// The app never holds the Qloo key: every call goes through Drrys' server function (supabase/functions/qloo).
// If Qloo can't be reached (offline, or the hackathon key has expired), every call fails quietly and the
// onboarding falls back to simple interest tiles.
import { callFunction } from '@/lib/cloud';
import type { WorldItem, WorldType } from '@/store';

const ask = <T>(body: unknown, timeoutMs?: number) => callFunction<T>('qloo', body, timeoutMs);

/** "Can't find it? Search…" */
export async function searchWorld(query: string, type?: WorldType): Promise<WorldItem[]> {
  const r = await ask<{ items: WorldItem[] }>({ action: 'search', query, type }, 10000);
  return r.items ?? [];
}

/** The ready-made posters, turned into real Qloo things (with pictures). Same order as asked;
 *  null where Qloo had no match. */
export async function resolveStarters(items: { name: string; type: WorldType }[]): Promise<(WorldItem | null)[]> {
  const r = await ask<{ items: (WorldItem | null)[] }>({ action: 'resolve', items }, 20000);
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
  const r = await ask<{ groups: { from: string; items: WorldItem[] }[]; tags: string[] }>({ action: 'explore', picks: withIds }, 25000);
  return { groups: r.groups ?? [], tags: r.tags ?? [] };
}

/* ---------- the ready-made posters (names only: pictures and ids come from Qloo at run time) ---------- */

export const WORLD_TABS: { key: 'all' | WorldType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'tv_show', label: 'Shows & Anime' },
  { key: 'movie', label: 'Movies' },
  { key: 'artist', label: 'Music' },
  { key: 'brand', label: 'Teams & Brands' },
  { key: 'book', label: 'Books' },
];

/** Arabic and global favourites, mixed so the first screen already feels like "my world". */
export const STARTERS: { name: string; type: WorldType }[] = [
  { name: 'One Piece', type: 'tv_show' },
  { name: 'Fairuz', type: 'artist' },
  { name: 'Real Madrid', type: 'brand' },
  { name: 'Interstellar', type: 'movie' },
  { name: 'Attack on Titan', type: 'tv_show' },
  { name: 'Amr Diab', type: 'artist' },
  { name: 'Minecraft', type: 'brand' },
  { name: 'Breaking Bad', type: 'tv_show' },
  { name: 'Taylor Swift', type: 'artist' },
  { name: 'Spirited Away', type: 'movie' },
  { name: 'FC Barcelona', type: 'brand' },
  { name: 'Bab Al-Hara', type: 'tv_show' },
  { name: 'Umm Kulthum', type: 'artist' },
  { name: 'The Dark Knight', type: 'movie' },
  { name: 'Naruto', type: 'tv_show' },
  { name: 'Wegz', type: 'artist' },
  { name: 'Harry Potter and the Philosopher\'s Stone', type: 'book' },
  { name: 'Stranger Things', type: 'tv_show' },
  { name: 'Coldplay', type: 'artist' },
  { name: 'Spider-Man: Into the Spider-Verse', type: 'movie' },
  { name: 'PlayStation', type: 'brand' },
  { name: 'Demon Slayer', type: 'tv_show' },
  { name: 'BTS', type: 'artist' },
  { name: 'Inception', type: 'movie' },
  { name: 'The Alchemist', type: 'book' },
  { name: 'Friends', type: 'tv_show' },
  { name: 'Drake', type: 'artist' },
  { name: 'Formula 1', type: 'brand' },
  { name: 'Toy Story', type: 'movie' },
  { name: 'Atomic Habits', type: 'book' },
  { name: 'Squid Game', type: 'tv_show' },
  { name: 'Nike', type: 'brand' },
  { name: 'The Little Prince', type: 'book' },
  { name: 'Avengers: Endgame', type: 'movie' },
  { name: 'Sherlock', type: 'tv_show' },
  { name: '1984', type: 'book' },
];

/** Shown on a poster that has no picture. */
export const TYPE_EMOJI: Record<WorldType, string> = { tv_show: '📺', movie: '🎬', artist: '🎵', brand: '⭐', book: '📚', person: '🌟', podcast: '🎙️' };

export const TYPE_LABEL: Record<WorldType, string> = { tv_show: 'Show', movie: 'Movie', artist: 'Music', brand: 'Team / brand', book: 'Book', person: 'Person', podcast: 'Podcast' };

/** Coco's quick reaction to a pick (written by hand, no AI, so it's instant). */
const COMMENTS: Record<WorldType, string[]> = {
  tv_show: ['{n}? You have great taste.', '{n}! Respect.', 'Ooh, {n}. Good one.'],
  movie: ['{n}? A classic.', '{n}! Great pick.', 'I love {n} too.'],
  artist: ['{n}? Classy.', '{n} on repeat? Same.', 'Good ears! {n}.'],
  brand: ['{n}! Let’s go!', '{n} fan? Nice.', '{n}! Great choice.'],
  book: ['A reader! {n} is a great one.', '{n}? Smart pick.'],
  person: ['{n}? Nice.', 'Big {n} fan? Love it.'],
  podcast: ['{n}? Good listen.'],
};
export function cocoComment(item: WorldItem, nth: number) {
  const list = COMMENTS[item.type] ?? COMMENTS.tv_show;
  return list[nth % list.length].replace('{n}', item.name);
}

/** If Qloo can't be reached: the simple interest tiles from before (they still feed Coco's analogies). */
export const FALLBACK_INTERESTS = ['Gaming', 'Football', 'Cars', 'UFC', 'Tech', 'Anime', 'Basketball', 'Music'];
