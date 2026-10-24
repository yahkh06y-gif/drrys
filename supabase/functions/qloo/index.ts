// Qloo, behind a small server so the API key never ships inside the app.
// The app sends { action, ... } and gets back short, safe lists of things (name, type, picture, tags).
//
// Deploy:  npx supabase functions deploy qloo --no-verify-jwt
// Key:     npx supabase secrets set QLOO_API_KEY=<your key>   (type it in your own terminal; never commit it)
//
// Rules from the Qloo hackathon: GET only, header X-Api-Key, results may be cached on the server but are
// never stored in the public repo. Nothing here is written to disk.

const BASE = 'https://hackathon.api.qloo.com';
const KEY = Deno.env.get('QLOO_API_KEY') ?? '';

// What a student can pick: shows, movies, books and teams (Qloo files sports teams under "brand").
// No singers, actors or podcasts: Drrys keeps to things that are good for explaining ideas, and that fit
// the values of the students it's made for.
const TYPES = ['tv_show', 'movie', 'brand', 'book'] as const;
// Athletes are the only people: the app asks for them by name in its sports lists (search and resolve
// with type "person"). They never come up unasked, and "more like this" for one gives teams, not people.
const KINDS = [...TYPES, 'person'] as const;
type Kind = (typeof KINDS)[number];
const urn = (t: Kind) => `urn:entity:${t}`;

// Safety: anything adult, romantic, or about alcohol, gambling or drugs is dropped before it reaches the app
// together with its picture (name, tags and age rating are checked). No AI is used: pictures come straight
// from Qloo, so the onboarding stays fast and costs nothing.
const BLOCK =
  /\b(porn\w*|erotic\w*|adult (film|video|content|animation)|hentai|ecchi|harem|nsfw|xxx|sex|sexy|sexual\w*|nudity|nude|strip(per|tease| club)|fetish|playboy|onlyfans|smut|seduct\w*|prostitut\w*|romance|romantic|love stor(y|ies)|rom-?com|dating|affair|lgbt\w*|alcohol\w*|beer|wine|whisk(e)?y|vodka|drinking|drunk\w*|bar ?crawl|casino\w*|gambl\w*|poker|betting|drugs?|drug dealing|cocaine|heroin|marijuana|cannabis|weed|stoner|mature|explicit|erotica|softcore|steamy|sensual|lust\w*|kiss\w*|lingerie|bikini|swimsuit|provocative)\b/i;
// 17+/18+ ratings: films (R, NC-17), TV (TV-MA), anime (R - 17+, R+, Rx) and 18 / 18+ anywhere
const BLOCK_RATING = /^\s*(r\b|r\+|rx|nc-?17|tv-?ma|ma\b|x{1,3}\b|ao\b|r-?18|18\+?\b)/i;

type Item = { id: string; name: string; type: Kind; image?: string; tags: string[] };

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

// A small in-memory cache: the same posters are asked for by every new student.
const cache = new Map<string, { at: number; v: unknown }>();
const TTL = 6 * 60 * 60 * 1000;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function qloo(path: string, params: Record<string, string>): Promise<any> {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  // the hackathon key has a rate limit: when Qloo says "slow down" (429), wait a little and try again
  let res = await fetch(url, { headers: { 'X-Api-Key': KEY } });
  for (let i = 0; res.status === 429 && i < 3; i++) {
    await wait(700 * (i + 1));
    res = await fetch(url, { headers: { 'X-Api-Key': KEY } });
  }
  if (!res.ok) throw new Error(`Qloo ${res.status}`);
  const v = await res.json();
  if (cache.size > 2000) cache.clear();
  cache.set(url, { at: Date.now(), v });
  return v;
}

function kindOf(e: any): Kind | undefined {
  const types: string[] = e?.types ?? (e?.subtype ? [e.subtype] : []);
  for (const t of types) {
    const k = String(t).split(':').pop() as Kind;
    if ((KINDS as readonly string[]).includes(k)) return k;
  }
  return undefined;
}

function slim(e: any): Item | undefined {
  const type = kindOf(e);
  const name = typeof e?.name === 'string' ? e.name.trim() : '';
  if (!type || !name || !e?.entity_id) return undefined;
  const tags: string[] = (e.tags ?? []).map((t: any) => (typeof t?.name === 'string' ? t.name : '')).filter(Boolean);
  const p = e.properties ?? {};
  const rating = String(p.content_rating ?? p.age_rating ?? '');
  if (BLOCK.test(name) || tags.some((t) => BLOCK.test(t)) || BLOCK_RATING.test(rating) || p.is_adult === true || p.adult === true) return undefined;
  const image = p.image?.url ?? p.images?.[0]?.url;
  return { id: e.entity_id, name, type, image: typeof image === 'string' && image.startsWith('https://') ? image : undefined, tags: tags.slice(0, 12) };
}

const clean = (s: unknown, max = 60) => (typeof s === 'string' ? s.trim().slice(0, max) : '');
const asKind = (t: unknown): Kind | undefined => ((KINDS as readonly string[]).includes(t as string) ? (t as Kind) : undefined);

async function search(query: string, type?: Kind | Kind[], take = 8): Promise<Item[]> {
  const params: Record<string, string> = { query, take: String(take + 4) };
  params.types = (type ? [type].flat() : TYPES).map(urn).join(',');
  const r = await qloo('/search', params);
  return (r?.results ?? []).map(slim).filter(Boolean).slice(0, take) as Item[];
}

// Age ratings Qloo filters by itself: films up to PG-13, TV up to TV-14 (unrated ones are left out too).
const SAFE_RATINGS: Partial<Record<Kind, string>> = { movie: 'G,PG,PG-13', tv_show: 'TV-Y,TV-Y7,TV-G,TV-PG,TV-14' };
const rated = (type: Kind): Record<string, string> => (SAFE_RATINGS[type] ? { 'filter.content_rating': SAFE_RATINGS[type]! } : {});

async function related(ids: string[], type: Kind, take: number): Promise<Item[]> {
  const r = await qloo('/v2/insights', { 'filter.type': urn(type), 'signal.interests.entities': ids.join(','), ...rated(type), take: String(take + 3) });
  return (r?.results?.entities ?? []).map(slim).filter(Boolean).slice(0, take) as Item[];
}

// What else a fan of this thing would love: more of the same kind, plus shows or movies (their themes are richest).
const exploreTypes = (t: Kind): Kind[] => [t === 'person' ? 'brand' : t, t === 'tv_show' ? 'movie' : 'tv_show'];

/** Run jobs a few at a time (the hackathon key turns away bursts). */
async function pool<T, R>(items: T[], size: number, job: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await job(items[i]);
      }
    }),
  );
  return out;
}

/* ---------- Niches: the student goes from an area (sports, movies…) to a niche (basketball, comedy…) ----------
 * Everything here comes from Qloo itself, not from a list we wrote: the genres Qloo files films, shows and
 * books under; the sports of its sports organisations; the history genres of its books. A niche is offered only when
 * Qloo has suitable things in it, and its cover is the picture of the most popular one. Worked out once per
 * server instance and kept for a few hours.
 * Films, shows and books share one set of genres ("stories"): drama is picked once, and the app then shows
 * drama films, drama shows and drama books, for whichever of the three the student picked.
 * Every niche has a slug (football, drama…) that never changes, so the app can put Coco's own picture on it. */
type Area = 'sports' | 'movies' | 'shows' | 'books' | 'history';
const AREAS: Area[] = ['sports', 'movies', 'shows', 'books', 'history'];
type Section = 'sports' | 'stories' | 'history';
type Niche = { key: string; area: Section; slug: string; label: string; type: Kind; tag?: string; tags?: Partial<Record<Kind, string>>; anchor?: string; cover?: string };

// genres left out on purpose: romance, and the occult (horror, paranormal, supernatural)
const SKIP_GENRE = /romance|horror|paranormal|supernatural/i;
const ATHLETE = 'urn:tag:genre:person:athlete';
const SPORTS_ORG = 'urn:tag:genre:brand:sports_organization';
// how Qloo names a few things, and how a student would
const RENAME: Record<string, string> = { soccer: 'Football', football: 'American football', motorsports: 'Motorsport' };
const nice = (s: string) => {
  const t = s.trim();
  return RENAME[t.toLowerCase()] ?? t.charAt(0).toUpperCase() + t.slice(1);
};
const slugOf = (id: string) => id.slice(id.lastIndexOf(':') + 1).replace(/_/g, '-');

// sub-genres folded into the genre a student knows (one "Fantasy", not Fantasy + High fantasy + Epic fantasy)
const FOLD: Record<string, string> = {
  'high-fantasy': 'fantasy', 'epic-fantasy': 'fantasy', 'urban-fantasy': 'fantasy', 'dark-fantasy': 'fantasy',
  'cozy-mystery': 'mystery', 'detective': 'mystery',
  'science-fiction': 'scifi', 'sci-fi': 'scifi', 'space-opera': 'scifi', 'hard-science-fiction': 'scifi', 'speculative-fiction': 'scifi', 'dystopian': 'scifi',
  'action-adventure': 'adventure', 'action-and-adventure': 'adventure',
  'crime-fiction': 'crime', 'police-procedural': 'crime', 'heist': 'crime',
  'psychological-thriller': 'thriller', 'suspense': 'thriller',
  'animated': 'animation', 'kids': 'family', 'children': 'family', 'childrens': 'family',
  'biographical': 'biography', 'memoir': 'biography', 'military': 'war',
};
const STORY_LABEL: Record<string, string> = { scifi: 'Sci-Fi', family: 'Family', biography: 'Biography', war: 'War' };
// the slugs of Qloo's sports and history tags, as the app's pictures are named
const SPORT_SLUG: Record<string, string> = { soccer: 'football', football: 'american-football', motorsports: 'motorsport' };
const HISTORY_SLUG: Record<string, string> = { history: 'world-history', 'history-of-science': 'science-history' };

// sports Qloo has no tag for, found through their best-known league or event instead
const MORE_SPORTS: { slug: string; label: string; find: string }[] = [
  { slug: 'tennis', label: 'Tennis', find: 'Wimbledon' },
  { slug: 'mma', label: 'MMA', find: 'UFC' },
  { slug: 'boxing', label: 'Boxing', find: 'World Boxing Council' },
  { slug: 'cricket', label: 'Cricket', find: 'Indian Premier League' },
  { slug: 'golf', label: 'Golf', find: 'PGA Tour' },
  { slug: 'volleyball', label: 'Volleyball', find: 'FIVB Volleyball Nations League' },
  { slug: 'cycling', label: 'Cycling', find: 'Tour de France' },
  { slug: 'rugby', label: 'Rugby', find: 'Rugby World Cup' },
  { slug: 'handball', label: 'Handball', find: 'EHF Champions League' },
  { slug: 'table-tennis', label: 'Table tennis', find: 'World Table Tennis' },
  { slug: 'padel', label: 'Padel', find: 'Premier Padel' },
  { slug: 'athletics', label: 'Athletics', find: 'Diamond League' },
];
// sports whose players are mostly pictured without a shirt or in very little: their teams and leagues only
const NO_PEOPLE = new Set(['mma', 'boxing', 'athletics', 'wrestling', 'swimming', 'bodybuilding']);

/** Popular things inside one niche: teams and players for a sport, titles for a genre. */
async function shelf(n: Pick<Niche, 'type' | 'tag' | 'anchor' | 'slug'>, take = 24): Promise<Item[]> {
  if (!n.tag && !n.anchor) return [];
  if (n.anchor) {
    // a sport: its teams (by its tag, or else the leagues its fans love), and the players fans of its
    // best-known team or league love (men only: their photos come without a picture check)
    const half = String(Math.ceil(take / 2) + 3);
    const teams: Record<string, string> = n.tag
      ? { 'filter.type': urn('brand'), 'filter.tags': n.tag, take: half }
      : { 'filter.type': urn('brand'), 'filter.tags': SPORTS_ORG, 'signal.interests.entities': n.anchor, take: half };
    const [t, p] = await Promise.all([
      qloo('/v2/insights', teams),
      NO_PEOPLE.has(n.slug)
        ? undefined
        : qloo('/v2/insights', { 'filter.type': urn('person'), 'filter.tags': ATHLETE, 'filter.gender': 'male', 'signal.interests.entities': n.anchor, take: half }).catch(() => undefined),
    ]);
    const a = ((t?.results?.entities ?? []) as any[]).map(slim).filter(Boolean) as Item[];
    const b = ((p?.results?.entities ?? []) as any[]).map(slim).filter(Boolean) as Item[];
    // teams and players, taking turns
    const out: Item[] = [];
    for (let i = 0; out.length < take && (i < a.length || i < b.length); i++) [a[i], b[i]].forEach((x) => x && out.length < take && out.push(x));
    return out;
  }
  const r = await qloo('/v2/insights', { 'filter.type': urn(n.type), 'filter.tags': n.tag!, ...rated(n.type), take: String(take + 6) });
  return ((r?.results?.entities ?? []) as any[]).map(slim).filter(Boolean).slice(0, take) as Item[];
}

/** The sports Qloo knows, found in the tags of its most popular sports organisations (soccer, basketball…),
 *  most popular first, then the popular ones it has no tag for. Each comes with its best-known team or
 *  league, to find the sport's players. */
async function sports(): Promise<Niche[]> {
  const r = await qloo('/v2/insights', { 'filter.type': urn('brand'), 'filter.tags': SPORTS_ORG, take: '50' });
  const found = new Map<string, Niche>();
  for (const org of (r?.results?.entities ?? []) as any[]) {
    for (const t of (org?.tags ?? []) as any[]) {
      const id = String(t?.tag_id ?? t?.id ?? '');
      const m = id.match(/^urn:tag:genre:brand:sports_organization:([a-z_]+)$/);
      if (!m || m[1] === 'league_tournament' || !org.entity_id) continue;
      const slug = SPORT_SLUG[slugOf(id)] ?? slugOf(id);
      if (found.has(slug)) continue;
      found.set(slug, { key: `sports:${slug}`, area: 'sports', slug, label: nice(String(t.name ?? m[1])), type: 'brand', tag: id, anchor: org.entity_id });
    }
  }
  const tagged = [...found.values()].slice(0, 10);
  const more = await pool(
    MORE_SPORTS.filter((s) => !found.has(s.slug)),
    3,
    async (s): Promise<Niche | undefined> => {
      const hit = (await search(s.find, 'brand', 1).catch(() => [] as Item[]))[0];
      return hit && { key: `sports:${s.slug}`, area: 'sports', slug: s.slug, label: s.label, type: 'brand', anchor: hit.id };
    },
  );
  return [...tagged, ...(more.filter(Boolean) as Niche[])];
}

/** One set of genres for films, shows and books: each genre once, with the tag it has in each of the three. */
async function stories(): Promise<Niche[]> {
  const kinds: Kind[] = ['movie', 'tv_show', 'book'];
  const lists = await Promise.all(kinds.map((k) => qloo('/v2/tags', { 'filter.parents.types': urn(k), take: '50' }).then((r) => (r?.results?.tags ?? []) as any[])));
  const found = new Map<string, Niche>();
  // anime isn't one of Qloo's genres, but it is one of its sub-genres (of shows)
  found.set('anime', { key: 'stories:anime', area: 'stories', slug: 'anime', label: 'Anime', type: 'tv_show', tags: { tv_show: 'urn:tag:subgenre:qloo:anime' } });
  kinds.forEach((k, i) => {
    for (const t of lists[i]) {
      if (typeof t?.id !== 'string' || typeof t?.name !== 'string' || SKIP_GENRE.test(t.id) || BLOCK.test(t.name)) continue;
      const own = slugOf(t.id);
      const slug = FOLD[own] ?? own;
      const n = found.get(slug) ?? { key: `stories:${slug}`, area: 'stories' as const, slug, label: STORY_LABEL[slug] ?? nice(t.name), type: k, tags: {} };
      // the genre's own tag wins over a folded sub-genre's
      if (!n.tags![k] || own === slug) n.tags![k] = t.id;
      if (own === slug && !STORY_LABEL[slug]) n.label = nice(t.name);
      found.set(slug, n);
    }
  });
  return [...found.values()].slice(0, 18).map((n) => {
    const type = kinds.find((k) => n.tags![k])!;
    return { ...n, type, tag: n.tags![type] };
  });
}

/** Qloo's history genres (history, history of science…): its history lives in books. */
async function historyNiches(): Promise<Niche[]> {
  const r = await qloo('/v2/tags', { 'filter.query': 'history', take: '40' });
  const seen = new Set<string>();
  return ((r?.results?.tags ?? []) as any[])
    .filter((t) => typeof t?.name === 'string' && String(t?.id).startsWith('urn:tag:genre:media:history') && !BLOCK.test(t.name) && !seen.has(t.id) && seen.add(t.id))
    .slice(0, 12)
    .map((t) => {
      const slug = HISTORY_SLUG[slugOf(t.id)] ?? slugOf(t.id);
      return { key: `history:${slug}`, area: 'history' as const, slug, label: nice(t.name), type: 'book' as Kind, tag: t.id };
    });
}

const nicheCache = new Map<Section, { at: number; v: Niche[] }>();

async function nichesOf(section: Section): Promise<Niche[]> {
  const hit = nicheCache.get(section);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  const found = await (section === 'sports' ? sports() : section === 'stories' ? stories() : historyNiches());
  // keep only niches with suitable things in them; the cover is the most popular one's picture
  // (the same call as the niche's own list later, so that one is already cached)
  const covers = await pool(found, 3, (n) => shelf(n).catch(() => [] as Item[]));
  const v = found.map((n, i) => ({ ...n, cover: covers[i].find((x) => x.image)?.image })).filter((_, i) => covers[i].length > 0);
  if (v.length) nicheCache.set(section, { at: Date.now(), v });
  return v;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!KEY) return json({ error: 'Qloo is not set up on the server' }, 503);
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad request' }, 400);
  }

  try {
    switch (body?.action) {
      // "Can't find it? Search…"
      case 'search': {
        const q = clean(body.query);
        if (q.length < 2) return json({ items: [] });
        // "sports": teams and athletes
        const items = await search(q, body.type === 'sports' ? ['brand', 'person'] : asKind(body.type));
        return json({ items });
      }

      // the ready-made posters: names written in the app, turned into real Qloo things (with pictures)
      case 'resolve': {
        const wanted = (Array.isArray(body.items) ? body.items : []).slice(0, 48);
        const items = await pool(
          wanted,
          3,
          async (w: any) => {
            const name = clean(w?.name);
            if (!name) return null;
            try {
              const type = asKind(w?.type);
              const first = (await search(name, type, 1))[0] ?? (type ? (await search(name, undefined, 1))[0] : undefined);
              return first ?? null;
            } catch {
              return null;
            }
          },
        );
        return json({ items });
      }

      // the grid learns: three things close to what was just picked
      case 'related': {
        const id = clean(body.id, 80);
        const asked = asKind(body.type) ?? 'tv_show';
        const type = asked === 'person' ? 'brand' : asked;
        if (!id) return json({ items: [] });
        // more of the same kind: a team's fans → more teams, a show's fans → more shows… (a player's fans → teams)
        const items = await related([id], type, 3);
        return json({ items });
      }

      // "Coco is exploring your world": for each pick, what else its fans love, and the themes of the whole world
      case 'explore': {
        const picks = (Array.isArray(body.picks) ? body.picks : []).slice(0, 8).filter((p: any) => clean(p?.id, 80));
        const seen = new Set<string>(picks.map((p: any) => p.id));
        const groups: { from: string; items: Item[] }[] = [];
        const tagCount = new Map<string, number>();
        const count = (tags: string[], w: number) => tags.forEach((t) => tagCount.set(t, (tagCount.get(t) ?? 0) + w));
        picks.forEach((p: any) => count(Array.isArray(p.tags) ? p.tags.map((t: unknown) => clean(t, 40)).filter(Boolean) : [], 2));
        // a few at a time, so every pick gets its answer (all at once, most were turned away)
        const lists = await pool(picks, 2, async (p: any) => {
          const types = exploreTypes(asKind(p.type) ?? 'tv_show');
          const per: Item[][] = [];
          for (const t of types) per.push(await related([p.id], t, 2).catch(() => [] as Item[]));
          return { from: p.id as string, per };
        });
        for (const { from, per } of lists) {
          const items: Item[] = [];
          // one of each kind first, then the rest, three in all
          for (let round = 0; round < 2 && items.length < 3; round++)
            for (const list of per) {
              const it = list[round];
              if (it && !seen.has(it.id) && items.length < 3) {
                seen.add(it.id);
                items.push(it);
              }
            }
          items.forEach((it) => (it.type === 'tv_show' || it.type === 'movie') && count(it.tags, 1));
          if (items.length) groups.push({ from, items });
        }
        const tags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).filter((t) => !BLOCK.test(t)).slice(0, 15);
        return json({ groups, tags });
      }

      // step 2 of "Show Coco your world": the niches inside the areas the student picked
      case 'niches': {
        const areas = (Array.isArray(body.areas) ? body.areas : []).filter((a: unknown): a is Area => AREAS.includes(a as Area));
        // films, shows and books share the "stories" genres
        const sections: Section[] = [...new Set<Section>(areas.map((a: Area): Section => (a === 'sports' || a === 'history' ? a : 'stories')))];
        const lists = await pool(sections, 2, (x: Section) => nichesOf(x).catch(() => [] as Niche[]));
        return json({ niches: lists.flat() });
      }

      // step 3: the popular things inside one niche
      case 'shelf': {
        const type = asKind(body.type);
        const tag = clean(body.tag, 120);
        const anchor = clean(body.anchor, 80);
        if (!type || (tag && !tag.startsWith('urn:tag:')) || (!tag && !anchor)) return json({ items: [] });
        return json({ items: await shelf({ type, tag: tag || undefined, anchor: anchor || undefined, slug: clean(body.slug, 40) }) });
      }

      default:
        return json({ error: 'unknown action' }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
