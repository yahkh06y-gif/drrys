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
// No people, singers or podcasts: Drrys keeps to things that are good for explaining ideas, and that fit
// the values of the students it's made for.
const TYPES = ['tv_show', 'movie', 'brand', 'book'] as const;
type Kind = (typeof TYPES)[number];
const urn = (t: Kind) => `urn:entity:${t}`;

// Safety: anything adult, romantic, or about alcohol, gambling or drugs is dropped before it reaches the app
// (name, tags and age rating are checked). No pictures are sent at all: Qloo can't tell what's in an image.
const BLOCK =
  /\b(porn\w*|erotic\w*|adult (film|video|content|animation)|hentai|ecchi|harem|nsfw|xxx|sex|sexy|sexual\w*|nudity|nude|strip(per|tease| club)|fetish|playboy|onlyfans|smut|seduct\w*|prostitut\w*|romance|romantic|love stor(y|ies)|rom-?com|dating|affair|lgbt\w*|alcohol\w*|beer|wine|whisk(e)?y|vodka|drinking|drunk\w*|bar ?crawl|casino\w*|gambl\w*|poker|betting|drugs?|drug dealing|cocaine|heroin|marijuana|cannabis|weed|stoner)\b/i;
const BLOCK_RATING = /^(nc-?17|x|xxx|r18\+?|ao)$/i;

type Item = { id: string; name: string; type: Kind; tags: string[] };

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
    if ((TYPES as readonly string[]).includes(k)) return k;
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
  return { id: e.entity_id, name, type, tags: tags.slice(0, 12) };
}

const clean = (s: unknown, max = 60) => (typeof s === 'string' ? s.trim().slice(0, max) : '');
const asKind = (t: unknown): Kind | undefined => ((TYPES as readonly string[]).includes(t as string) ? (t as Kind) : undefined);

async function search(query: string, type?: Kind, take = 8): Promise<Item[]> {
  const params: Record<string, string> = { query, take: String(take + 4) };
  params.types = type ? urn(type) : TYPES.map(urn).join(',');
  const r = await qloo('/search', params);
  return (r?.results ?? []).map(slim).filter(Boolean).slice(0, take) as Item[];
}

async function related(ids: string[], type: Kind, take: number): Promise<Item[]> {
  const r = await qloo('/v2/insights', { 'filter.type': urn(type), 'signal.interests.entities': ids.join(','), take: String(take + 3) });
  return (r?.results?.entities ?? []).map(slim).filter(Boolean).slice(0, take) as Item[];
}

// What else a fan of this thing would love: more of the same kind, plus shows or movies (their themes are richest).
const exploreTypes = (t: Kind): Kind[] => [t, t === 'tv_show' ? 'movie' : 'tv_show'];

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
        return json({ items: await search(q, asKind(body.type)) });
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
        const type = asKind(body.type) ?? 'tv_show';
        if (!id) return json({ items: [] });
        // more of the same kind: a team's fans → more teams, a show's fans → more shows…
        return json({ items: await related([id], type, 3) });
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

      default:
        return json({ error: 'unknown action' }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
