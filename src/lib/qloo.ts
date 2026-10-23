// Qloo (taste AI): finds the things a student loves, and what else fans of those things love.
// The app never holds the Qloo key: every call goes through Drrys' server function (supabase/functions/qloo).
// If Qloo can't be reached (offline, or the hackathon key has expired), the calls fail: the world step offers
// to try again or skip, and "more like this" and the exploring are skipped.
// Pictures come straight from Qloo; the server drops anything adult or unsuitable first. Things without one show an icon.
import { OPTION_ICONS } from '@/art';
import { callFunction } from '@/lib/cloud';
import type { WorldItem, WorldType } from '@/store';

const ask = <T>(body: unknown, timeoutMs?: number) => callFunction<T>('qloo', body, timeoutMs);

/** "Can't find it? Search…" */
export async function searchWorld(query: string, type?: WorldType | 'sports'): Promise<WorldItem[]> {
  const r = await ask<{ items: WorldItem[] }>({ action: 'search', query, type }, 10000);
  return r.items ?? [];
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

/* ---------- areas and niches: the student goes from wide (sports) to narrow (basketball) to things (the Lakers) ---------- */

export type CategoryKey = 'sports' | 'movies' | 'shows' | 'books' | 'history';

/** Step 1: the big areas. No music and no celebrities: these are the worlds that make good analogies.
 *  Icons are placeholders until the real art arrives. */
export const CATEGORIES: { key: CategoryKey; label: string; emoji: string; icon?: number }[] = [
  { key: 'sports', label: 'Sports', emoji: '⚽', icon: OPTION_ICONS['interests:Football'] },
  { key: 'movies', label: 'Movies', emoji: '🎬' },
  { key: 'shows', label: 'Shows & Anime', emoji: '📺', icon: OPTION_ICONS['interests:Anime'] },
  { key: 'books', label: 'Books', emoji: '📚' },
  { key: 'history', label: 'History', emoji: '🏛️' },
];

/** Step 2: a niche inside an area (basketball, comedy, history of science…). They come from Qloo itself
 *  (see supabase/functions/qloo, "Niches"); only Islamic history is Drrys' own, because Qloo has no data for it. */
export type Niche = { key: string; area: CategoryKey; label: string; type: WorldType; tag?: string; anchor?: string; cover?: string; local?: WorldItem[] };

const ISLAMIC: Niche = {
  key: 'islamic',
  area: 'history',
  label: 'Islamic history',
  type: 'history',
  local: [
    'Khalid ibn al-Walid',
    'Umar ibn al-Khattab',
    'Abu Bakr al-Siddiq',
    'Ali ibn Abi Talib',
    'Salah al-Din al-Ayyubi',
    'Muhammad al-Fatih',
    'Tariq ibn Ziyad',
    'The Battle of Badr',
    'The Battle of Yarmouk',
    'The Hijra',
    'Building the Prophet’s Mosque',
    'The House of Wisdom',
    'Ibn al-Haytham',
    'Al-Andalus',
  ].map((name) => ({ name, type: 'history' as const })),
};

/** The niches inside the areas picked, in the order the areas were picked. */
export async function nichesFor(areas: CategoryKey[]): Promise<Niche[]> {
  const r = await ask<{ niches: Niche[] }>({ action: 'niches', areas }, 30000);
  const found = r.niches ?? [];
  return areas.flatMap((a) => [...(a === 'history' ? [ISLAMIC] : []), ...found.filter((n) => n.area === a)]);
}

/** Step 3: the popular things inside one niche (teams and players, or titles). */
export async function shelfOf(n: Niche): Promise<WorldItem[]> {
  if (n.local) return n.local;
  const r = await ask<{ items: WorldItem[] }>({ action: 'shelf', type: n.type, tag: n.tag, anchor: n.anchor }, 15000);
  return r.items ?? [];
}

/** Shown on a card when there's no picture. */
export const TYPE_EMOJI: Record<WorldType, string> = { tv_show: '📺', movie: '🎬', artist: '🎵', brand: '🏆', book: '📚', person: '🏅', podcast: '🎙️', history: '🏛️' };

export const TYPE_LABEL: Record<WorldType, string> = { tv_show: 'Show', movie: 'Movie', artist: 'Music', brand: 'Sports team', book: 'Book', person: 'Athlete', podcast: 'Podcast', history: 'History' };

/** Coco's quick reaction to a pick (written by hand, no AI, so it's instant). */
const COMMENTS: Record<WorldType, string[]> = {
  tv_show: ['{n}? Great taste.', '{n}! Respect.', 'Ooh, {n}. Good one.'],
  movie: ['{n}? A classic.', '{n}! Great pick.', 'I like {n} too.'],
  artist: ['{n}? Nice.'],
  brand: ['{n}! Let’s go!', '{n} fan? Nice.', '{n}! Great choice.'],
  book: ['A reader! {n} is a great one.', '{n}? Smart pick.'],
  person: ['{n}! A legend.', '{n} fan? Nice.'],
  podcast: ['{n}? Good listen.'],
  history: ['{n}: there’s so much to learn from it.', 'Great choice. {n} has a lot to teach us.'],
};
export function cocoComment(item: WorldItem, nth: number) {
  const list = COMMENTS[item.type] ?? COMMENTS.tv_show;
  return list[nth % list.length].replace('{n}', item.name);
}
