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

export const youcamEnabled = !!KEY;

const STYLE =
  'A 3D claymation illustration, handmade clay animation look: rounded soft plasticine shapes, soft pastel colours (teal, leaf green, warm orange, cream), gentle studio lighting, a simple clean uncluttered background, friendly and playful. No text, no letters, no numbers in the picture.';

const COCO =
  ' Include Coco as the helper in the scene: the small beige clay character from the reference image (a rounded block-shaped creature with two small round eyes and thin black stick legs). Keep the character looking exactly like the reference.';

function buildPrompt(p: { hook: string; q: string; a: string; withCoco: boolean; scene?: string }) {
  const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);
  return cut(
    `${STYLE} It is a memory aid picture that makes this idea unforgettable${p.hook ? `: "${cut(p.hook, 300)}"` : ''}. The idea: ${cut(p.q, 200)} Answer: ${cut(p.a, 250)}.${p.scene ? ` The student sketched the scene they want, so follow this layout and these objects exactly and add nothing else: ${cut(p.scene, 500)}` : ''}${p.withCoco ? COCO : ''}`,
    1450,
  );
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
  const start = await fetch(BASE, {
    method: 'POST',
    headers,
    body: JSON.stringify({ src_file_urls: p.withCoco ? [COCO_URL] : [], model: 'youcam-image-v2', prompt: buildPrompt(p), size: '1664*928' }),
  });
  const started = await start.json().catch(() => undefined);
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
