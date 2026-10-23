// Qloo (taste AI): finds the things a student loves, and what else fans of those things love.
// The app never holds the Qloo key: every call goes through Drrys' server function (supabase/functions/qloo).
// If Qloo can't be reached (offline, or the hackathon key has expired), every call fails quietly: the
// ready-made lists still work, only the "more like this" and the exploring are skipped.
// Pictures come straight from Qloo; the server drops anything adult or unsuitable first. Things without one show an icon.
import { OPTION_ICONS } from '@/art';
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

/* ---------- areas, sub-areas and ready-made lists (names only: ids and pictures come from Qloo at run time) ---------- */

export type CategoryKey = 'sports' | 'movies' | 'shows' | 'books' | 'history';

/** One list the student picks from (a whole area, or one sub-area such as Football). */
export type Shelf = {
  key: string;
  label: string;
  emoji: string;
  /** a clay icon, when there is one (placeholders until the real art arrives) */
  icon?: number;
  /** what "Can't find it? Search…" looks for */
  type: WorldType;
  /** false: Drrys' own list, not from Qloo (history: Qloo has no taste data for it) */
  qloo: boolean;
  starters: { name: string; type: WorldType }[];
};

/** Step 1: the big areas. No music and no celebrities: these are the worlds that make good analogies. */
export const CATEGORIES: { key: CategoryKey; label: string; emoji: string; icon?: number }[] = [
  { key: 'sports', label: 'Sports', emoji: '⚽', icon: OPTION_ICONS['interests:Football'] },
  { key: 'movies', label: 'Movies', emoji: '🎬' },
  { key: 'shows', label: 'Shows & Anime', emoji: '📺', icon: OPTION_ICONS['interests:Anime'] },
  { key: 'books', label: 'Books', emoji: '📚' },
  { key: 'history', label: 'History', emoji: '🏛️' },
];

const team = (name: string) => ({ name, type: 'brand' as const });
const player = (name: string) => ({ name, type: 'person' as const });
const past = (name: string) => ({ name, type: 'history' as const });
const of = (type: WorldType, names: string[]) => names.map((name) => ({ name, type }));

/** Step 2, for the areas that go deeper: a student into sports picks which sports, a student into history
 *  picks which civilisations. Movies, shows and books go straight to their list. Players are men only:
 *  their pictures come straight from Qloo (see supabase/functions/qloo). */
export const SUBS: Partial<Record<CategoryKey, Shelf[]>> = {
  sports: [
    {
      key: 'football',
      label: 'Football',
      emoji: '⚽',
      icon: OPTION_ICONS['interests:Football'],
      type: 'brand',
      qloo: true,
      starters: [
        ...['Real Madrid', 'FC Barcelona', 'Liverpool F.C.', 'Manchester City', 'Al Hilal', 'Al Ahly', 'Al-Faisaly', 'Bayern Munich', 'Paris Saint-Germain', 'Juventus'].map(team),
        ...['Cristiano Ronaldo', 'Lionel Messi', 'Mohamed Salah', 'Karim Benzema', 'Kylian Mbappé', 'Erling Haaland', 'Achraf Hakimi', 'Riyad Mahrez'].map(player),
      ],
    },
    {
      key: 'basketball',
      label: 'Basketball',
      emoji: '🏀',
      icon: OPTION_ICONS['interests:Basketball'],
      type: 'brand',
      qloo: true,
      starters: [
        ...['NBA', 'Los Angeles Lakers', 'Golden State Warriors', 'Chicago Bulls', 'Boston Celtics'].map(team),
        ...['LeBron James', 'Stephen Curry', 'Michael Jordan', 'Kobe Bryant', 'Giannis Antetokounmpo'].map(player),
      ],
    },
    {
      key: 'tennis',
      label: 'Tennis',
      emoji: '🎾',
      type: 'person',
      qloo: true,
      starters: [...['Wimbledon', 'Roland Garros'].map(team), ...['Rafael Nadal', 'Roger Federer', 'Novak Djokovic', 'Carlos Alcaraz'].map(player)],
    },
    {
      key: 'ufc',
      label: 'UFC & MMA',
      emoji: '🥊',
      icon: OPTION_ICONS['interests:UFC'],
      type: 'person',
      qloo: true,
      starters: [team('UFC'), ...['Khabib Nurmagomedov', 'Islam Makhachev', 'Khamzat Chimaev', 'Belal Muhammad'].map(player)],
    },
    {
      key: 'f1',
      label: 'Formula 1',
      emoji: '🏎️',
      icon: OPTION_ICONS['interests:Cars'],
      type: 'brand',
      qloo: true,
      starters: [
        ...['Formula 1', 'Scuderia Ferrari', 'Mercedes-AMG Petronas', 'Red Bull Racing', 'McLaren'].map(team),
        ...['Lewis Hamilton', 'Max Verstappen', 'Charles Leclerc', 'Fernando Alonso'].map(player),
      ],
    },
  ],
  history: [
    {
      key: 'islamic',
      label: 'Islamic history',
      emoji: '🕌',
      type: 'history',
      qloo: false,
      starters: [
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
      ].map(past),
    },
    { key: 'andalus', label: 'Al-Andalus', emoji: '🏰', type: 'history', qloo: false, starters: ['Tariq ibn Ziyad', 'Abd al-Rahman I', 'Córdoba', 'The Alhambra', 'Ibn Rushd', 'Abbas ibn Firnas', 'Al-Zahrawi'].map(past) },
    { key: 'ottoman', label: 'The Ottomans', emoji: '🕌', type: 'history', qloo: false, starters: ['Osman I', 'The Conquest of Constantinople', 'Suleiman the Magnificent', 'Mimar Sinan', 'The Hejaz Railway'].map(past) },
    { key: 'mesopotamia', label: 'Mesopotamia', emoji: '🏺', type: 'history', qloo: false, starters: ['Hammurabi’s Code', 'Cuneiform writing', 'Babylon', 'The Epic of Gilgamesh', 'The Hanging Gardens'].map(past) },
    { key: 'egypt', label: 'Ancient Egypt', emoji: '🐫', type: 'history', qloo: false, starters: ['The Pyramids of Giza', 'Ramesses II', 'Tutankhamun', 'Hieroglyphs', 'Imhotep', 'The Nile'].map(past) },
    { key: 'greece', label: 'Ancient Greece', emoji: '🏛️', type: 'history', qloo: false, starters: ['Socrates', 'Plato', 'Aristotle', 'Archimedes', 'Pythagoras', 'Alexander the Great', 'The first Olympics'].map(past) },
    { key: 'rome', label: 'The Roman Empire', emoji: '🛡️', type: 'history', qloo: false, starters: ['Julius Caesar', 'Augustus', 'The Colosseum', 'Roman roads', 'Roman law', 'Hannibal'].map(past) },
    { key: 'persia', label: 'Ancient Persia', emoji: '👑', type: 'history', qloo: false, starters: ['Cyrus the Great', 'Darius I', 'Persepolis', 'The Royal Road'].map(past) },
    { key: 'china', label: 'Ancient China', emoji: '🐉', type: 'history', qloo: false, starters: ['The Great Wall', 'Confucius', 'Sun Tzu', 'The Silk Road', 'The invention of paper', 'The Terracotta Army'].map(past) },
  ],
};

/** Areas without sub-areas are one list each. */
const WHOLE: Record<Exclude<CategoryKey, 'sports' | 'history'>, Shelf> = {
  movies: {
    key: 'movies',
    label: 'Movies',
    emoji: '🎬',
    type: 'movie',
    qloo: true,
    starters: of('movie', ['The Message', 'Lion of the Desert', 'Interstellar', 'Spirited Away', 'Toy Story', 'Finding Nemo', 'Up', 'Ratatouille', 'Kung Fu Panda', 'How to Train Your Dragon', 'Inception', 'The Lion King']),
  },
  shows: {
    key: 'shows',
    label: 'Shows & Anime',
    emoji: '📺',
    type: 'tv_show',
    qloo: true,
    starters: of('tv_show', ['One Piece', 'Captain Tsubasa', 'Detective Conan', 'Attack on Titan', 'Naruto', 'Hunter x Hunter', 'Resurrection: Ertugrul', 'Omar', 'Avatar: The Last Airbender', 'Planet Earth', 'Sherlock', 'Haikyu!!']),
  },
  books: {
    key: 'books',
    label: 'Books',
    emoji: '📚',
    type: 'book',
    qloo: true,
    starters: of('book', ['Atomic Habits', 'The Sealed Nectar', "Don't Be Sad", 'The 7 Habits of Highly Effective People', 'Rich Dad Poor Dad', 'The Little Prince', 'Thinking, Fast and Slow', 'The Adventures of Sherlock Holmes', '1984', 'Deep Work', 'The Muqaddimah', "Man's Search for Meaning"]),
  },
};

/** The lists to pick from, for the areas and sub-areas chosen (an area with sub-areas but none chosen: all of them). */
export function shelvesFor(areas: CategoryKey[], subs: string[]): Shelf[] {
  return areas.flatMap((a) => {
    const deeper = SUBS[a];
    if (!deeper) return [WHOLE[a as keyof typeof WHOLE]];
    const chosen = deeper.filter((s) => subs.includes(s.key));
    return chosen.length ? chosen : deeper;
  });
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
