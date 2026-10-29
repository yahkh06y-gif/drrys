/**
 * Pictures for memory hooks, made by the YouCam API (youcam-image-v2). Used ONLY for this: when a student
 * has written a hook and taps "Make a picture", the hook becomes a clay-style picture that matches the app.
 * One picture costs 1 credit, whatever the number of reference images.
 *
 * Words only: text-to-image (the hook, turned into a scene by the AI). There is no "Coco in it" any more: the
 * reference-picture upload failed on phones ("Cannot determine file type") and the option confused students.
 * The API is asynchronous: start a task, then poll it until it is "success" (or "error").
 * Key: YOUCAM_API_KEY, a Supabase secret: every YouCam call goes through Drrys' server function
 * (supabase/functions/ai), so the key never ships in the app. EXPO_PUBLIC_PICTURES=0 hides "Make a picture".
 */
import { Platform } from 'react-native';

import { cloudEnabled, fetchFunction } from '@/lib/cloud';
import { shrinkImage } from '@/lib/shrink';
import { saveSketch } from '@/lib/sketch';

// the server knows YouCam's addresses: 'text' = words only
const KIND = 'text';
const youcam = (body: Record<string, unknown>) => fetchFunction('ai', { action: 'youcam', ...body });
const SIZE = '1472*1104'; // 4:3; the allowed sizes are 1664*928, 1472*1104, 1328*1328, 1104*1472, 928*1664

export const youcamEnabled = cloudEnabled && process.env.EXPO_PUBLIC_PICTURES !== '0';

const STYLE = 'A 3D clay-animation illustration: soft rounded plasticine shapes, pastel teal, green, orange and cream, soft studio light, clean simple background, friendly and playful, no text or letters.';
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n).trimEnd() : s);

export type PictureRequest = {
  hook: string;
  q: string;
  a: string;
  /** what the picture shows, in words (the hook, turned into a scene by the AI) */
  scene?: string;
};

// The prompt may be 800 characters at most, so it is kept short (and cut). If it is still refused: one minimal retry.
function buildPrompt(p: PictureRequest, minimal = false) {
  const scene = p.scene || p.hook || p.a;
  if (minimal) return cut(`${STYLE} Scene: ${cut(scene, 150)}.`, 600);
  return cut(`${STYLE} Show exactly this scene: ${cut(scene, 330)} (a memory picture for: ${cut(p.a, 90)}).`, 790);
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
export async function makeHookPicture(p: PictureRequest): Promise<string> {
  if (!youcamEnabled) throw new Error('Pictures are turned off');
  const begin = (minimal: boolean) => youcam({ step: 'start', kind: KIND, task: { model: 'youcam-image-v2', prompt: buildPrompt(p, minimal), size: SIZE } });
  let start = await begin(false);
  let started = await start.json().catch(() => undefined);
  if (start.status === 400 && /prompt is longer/i.test(String(started?.error))) {
    start = await begin(true); // still too long for the maker: try again with a minimal prompt
    started = await start.json().catch(() => undefined);
  }
  const id: string | undefined = started?.data?.task_id;
  if (!start.ok || !id) throw new Error(`YouCam could not start (${start.status}): ${JSON.stringify(started ?? {}).slice(0, 160)}`);
  // YouCam normally needs about 20 seconds: wait up to ~100 seconds, and say what the last answer was
  let last = 'none';
  for (let i = 0; i < 36; i++) {
    await sleep(i < 10 ? 2000 : 3000);
    const res = await youcam({ step: 'status', kind: KIND, id });
    const body = await res.json().catch(() => undefined);
    if (!res.ok) throw new Error(`YouCam status ${res.status}: ${JSON.stringify(body ?? {}).slice(0, 160)}`);
    const st = String(body?.data?.task_status ?? '');
    last = JSON.stringify(body?.data ?? body ?? {}).slice(0, 220);
    if (/^(success|succeeded|completed|done)$/i.test(st)) {
      const url = findUrl(body?.data);
      if (!url) throw new Error(`YouCam finished but no picture link was found: ${JSON.stringify(body?.data ?? {}).slice(0, 120)}`);
      return url;
    }
    if (/^(error|failed|fail)$/i.test(st)) throw new Error(`YouCam task failed: ${JSON.stringify(body?.data ?? {}).slice(0, 160)}`);
  }
  throw new Error(`YouCam took too long. Last answer: ${last} (task ${id})`);
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
    // web: the picture is kept inside the saved state (localStorage, ~5 MB), so it is saved small
    if (Platform.OS === 'web') return await shrinkImage(URL.createObjectURL(await res.blob()));
    const b64 = toBase64(await res.arrayBuffer());
    return (await saveSketch(cardId, b64)) ?? url;
  } catch {
    return url;
  }
}
