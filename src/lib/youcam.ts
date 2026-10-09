/**
 * Pictures for memory hooks, made by the YouCam API (youcam-image-v2). Used ONLY for this: when a student
 * has written a hook and taps "Make a picture", the hook becomes a clay-style picture that matches the app.
 * One picture costs 1 credit, whatever the number of reference images.
 *
 * The API is asynchronous: start a task, then poll it until it is "success" (or "error").
 * Key: EXPO_PUBLIC_YOUCAM_API_KEY in .env. Without a key the "Make a picture" option is hidden.
 */
import { Platform } from 'react-native';

import { saveSketch } from '@/lib/sketch';

const KEY = process.env.EXPO_PUBLIC_YOUCAM_API_KEY ?? '';
const BASE = 'https://yce-api-01.makeupar.com/s2s/v2.0/task/image-to-image/youcam';
// Coco as a reference picture (the API needs a public link; it must be at least 384 px on each side).
// Default: the file in this repo's forgehacks branch on GitHub. Override with EXPO_PUBLIC_YOUCAM_COCO_URL.
const COCO_URL = process.env.EXPO_PUBLIC_YOUCAM_COCO_URL || 'https://raw.githubusercontent.com/yahkh06y-gif/drrys/forgehacks/assets/art/coco/reference.png';

// The image maker works from reference pictures (it needs at least one). The style reference is the app's own
// empty clay world (on the repo's main branch), so every picture comes out in the same look as the app.
const STYLE_URL = process.env.EXPO_PUBLIC_YOUCAM_STYLE_URL || 'https://raw.githubusercontent.com/yahkh06y-gif/drrys/main/assets/art/tree/no-tree.jpg';

export const youcamEnabled = !!KEY;

// The maker refuses long prompts (the limit is not published), so the prompt is kept short: a fixed style line,
// then the hook, the idea, the sketch description. If it is still refused, one retry with a minimal prompt.
const STYLE =
  'New 3D clay-animation illustration: soft rounded plasticine shapes, pastel teal, green, orange and cream, soft studio light, clean simple background, no text or letters. Use the reference image only for the clay style and colours; do not copy its landscape.';
const COCO = ' Include Coco, the small beige clay creature from the first reference image, unchanged. The second image is the style reference.';
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n).trimEnd() : s);

function buildPrompt(p: { hook: string; q: string; a: string; withCoco: boolean; scene?: string }, minimal = false) {
  if (minimal) return cut(`${STYLE} Scene: ${cut(p.hook || p.a, 150)}.${p.withCoco ? COCO : ''}`, 600);
  const idea = `${cut(p.q, 90)} → ${cut(p.a, 110)}`;
  const text = `${STYLE} A memory aid picture${p.hook ? ` for "${cut(p.hook, 160)}"` : ''} (${idea}).${p.scene ? ` Follow this sketch layout exactly and add nothing else: ${cut(p.scene, 220)}` : ''}${p.withCoco ? COCO : ''}`;
  return cut(text, 800);
}

/** First image link found in a task result (the exact field name is not relied on). */
function findUrl(x: unknown, depth = 0): string | undefined {
  if (depth > 5) return undefined;
  if (typeof x === 'string') return /^https?:\/\//i.test(x) ? x : undefined;
  if (Array.isArray(x)) {
    for (const i of x) {
      const r = findUrl(i, depth + 1);
      if (r) return r;
    }
    return undefined;
  }
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    for (const k of ['url', 'download_url', 'image_url', 'results', 'result', 'output']) {
      if (k in o) {
        const r = findUrl(o[k], depth + 1);
        if (r) return r;
      }
    }
    for (const v of Object.values(o)) {
      const r = findUrl(v, depth + 1);
      if (r) return r;
    }
  }
  return undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Makes one picture and returns a link to it (temporary: save it with savePicture). */
export async function makeHookPicture(p: { hook: string; q: string; a: string; withCoco: boolean; scene?: string }): Promise<string> {
  if (!KEY) throw new Error('No YouCam key');
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${KEY}` };
  const begin = (minimal: boolean) =>
    fetch(BASE, {
      method: 'POST',
      headers,
      body: JSON.stringify({ src_file_urls: p.withCoco ? [COCO_URL, STYLE_URL] : [STYLE_URL], model: 'youcam-image-v2', prompt: buildPrompt(p, minimal), size: '1664*928' }),
    });
  let start = await begin(false);
  let started = await start.json().catch(() => undefined);
  if (start.status === 400 && /prompt is longer/i.test(String(started?.error))) {
    start = await begin(true); // still too long for the maker: try again with a minimal prompt
    started = await start.json().catch(() => undefined);
  }
  const id: string | undefined = started?.data?.task_id;
  if (!start.ok || !id) throw new Error(`YouCam could not start (${start.status}): ${JSON.stringify(started ?? {}).slice(0, 160)}`);
  for (let i = 0; i < 75; i++) {
    await sleep(2000);
    const res = await fetch(`${BASE}/${id}`, { headers });
    const body = await res.json().catch(() => undefined);
    if (!res.ok) throw new Error(`YouCam status ${res.status}: ${JSON.stringify(body ?? {}).slice(0, 160)}`);
    const st = body?.data?.task_status;
    if (st === 'success') {
      const url = findUrl(body?.data);
      if (!url) throw new Error('YouCam finished but no picture link was found');
      return url;
    }
    if (st === 'error') throw new Error(`YouCam task failed: ${JSON.stringify(body?.data ?? {}).slice(0, 160)}`);
  }
  throw new Error('YouCam took too long');
}

const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/** The picture link expires, so keep a copy on the device (like a drawing). If that fails, the link is kept as is. */
export async function savePicture(cardId: string, url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const b64 = toBase64(await res.arrayBuffer());
    if (Platform.OS === 'web') return `data:${res.headers.get('content-type') || 'image/png'};base64,${b64}`;
    return (await saveSketch(cardId, b64)) ?? url;
  } catch {
    return url;
  }
}
