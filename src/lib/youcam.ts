/**
 * Pictures for memory hooks, made by the YouCam API (youcam-image-v2). Used ONLY for this: when a student
 * has written a hook and taps "Make a picture", the hook becomes a clay-style picture that matches the app.
 * One picture costs 1 credit, whatever the number of reference images.
 *
 * Three ways to make a picture:
 *  - words only: text-to-image (the hook, turned into a scene by the AI);
 *  - with the student's sketch: the sketch is uploaded and used as the reference (image-to-image), so the
 *    picture keeps the student's layout; Coco can be a second reference;
 *  - with Coco only: Coco's picture (bundled in the app) is uploaded as the reference.
 * The API is asynchronous: start a task, then poll it until it is "success" (or "error").
 * Key: EXPO_PUBLIC_YOUCAM_API_KEY in .env. Without a key the "Make a picture" option is hidden.
 */
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

import { saveSketch } from '@/lib/sketch';

const KEY = process.env.EXPO_PUBLIC_YOUCAM_API_KEY ?? '';
const API = 'https://yce-api-01.makeupar.com/s2s/v2.0';
const TEXT_TO_IMAGE = `${API}/task/text-to-image/youcam`; // words only (no reference picture needed)
const IMAGE_TO_IMAGE = `${API}/task/image-to-image/youcam`; // with reference pictures (sketch, Coco)
const FILE_API = `${API}/file`; // asks for a place to upload a picture
const SIZE = '1472*1104'; // 4:3; the allowed sizes are 1664*928, 1472*1104, 1328*1328, 1104*1472, 928*1664

export const youcamEnabled = !!KEY;

/** The picture could not be uploaded to YouCam (so it cannot be used as a reference). */
export class UploadError extends Error {}

const STYLE = 'A 3D clay-animation illustration: soft rounded plasticine shapes, pastel teal, green, orange and cream, soft studio light, clean simple background, friendly and playful, no text or letters.';
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n).trimEnd() : s);

export type PictureRequest = {
  hook: string;
  q: string;
  a: string;
  withCoco: boolean;
  /** what the picture shows, in words (from the hook, or from the sketch when the sketch cannot be uploaded) */
  scene?: string;
  /** the student's drawing as base64 PNG: it becomes the reference picture */
  sketch?: string;
};

// The prompt may be 800 characters at most, so it is kept short (and cut). If it is still refused: one minimal retry.
function buildPrompt(p: PictureRequest, refs: { sketch: boolean; coco: boolean }, minimal = false) {
  const coco = refs.coco ? ` Add Coco, the small beige clay creature from Image ${refs.sketch ? 2 : 1}, looking exactly like in that image.` : '';
  if (refs.sketch) {
    const keep = `Turn the hand-drawn sketch in Image 1 into a clay picture. Keep the same objects and the same layout and positions as the sketch; add nothing else.`;
    const what = p.hook ? ` The sketch shows: ${cut(p.hook, minimal ? 100 : 230)}` : '';
    return cut(`${keep} ${STYLE}${what}${coco}`, minimal ? 600 : 790);
  }
  const scene = p.scene || p.hook || p.a;
  if (minimal) return cut(`${STYLE} Scene: ${cut(scene, 150)}.${coco}`, 600);
  return cut(`${STYLE} Show exactly this scene: ${cut(scene, 330)} (a memory picture for: ${cut(p.a, 90)}).${coco}`, 790);
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
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Uploads a picture to YouCam and returns its file id. */
async function uploadImage(bytes: Uint8Array, contentType: string, fileName: string): Promise<string> {
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${KEY}` };
  let body: any;
  try {
    const res = await fetch(FILE_API, { method: 'POST', headers, body: JSON.stringify({ files: [{ content_type: contentType, file_name: fileName, file_size: bytes.byteLength }] }) });
    body = await res.json().catch(() => undefined);
    if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body ?? {}).slice(0, 120)}`);
  } catch (e) {
    throw new UploadError(`YouCam upload could not start: ${String((e as Error)?.message ?? e).slice(0, 140)}`);
  }
  const file = (body?.data?.files ?? body?.files)?.[0];
  const req = file?.requests?.[0];
  if (!file?.file_id || !req?.url) throw new UploadError(`YouCam upload: unexpected answer ${JSON.stringify(body ?? {}).slice(0, 140)}`);
  try {
    const h: Record<string, string> = {};
    for (const [k, v] of Object.entries((req.headers ?? {}) as Record<string, string>)) {
      if (!/^content-length$/i.test(k)) h[k] = String(v); // the device sets the length itself
    }
    if (!Object.keys(h).some((k) => /^content-type$/i.test(k))) h['content-type'] = contentType;
    const put = await fetch(req.url, { method: req.method || 'PUT', headers: h, body: bytes as unknown as BodyInit });
    if (!put.ok) throw new Error(`${put.status}`);
  } catch (e) {
    throw new UploadError(`YouCam upload failed: ${String((e as Error)?.message ?? e).slice(0, 100)}`);
  }
  return file.file_id as string;
}

// Coco's picture ships inside the app; it is uploaded once and its id is kept for a while.
let cocoCache: { id: string; at: number } | undefined;
async function cocoFileId(): Promise<string> {
  if (cocoCache && Date.now() - cocoCache.at < 20 * 60 * 1000) return cocoCache.id;
  const asset = Asset.fromModule(require('../../assets/art/coco/reference.png'));
  if (!asset.localUri) await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const buf = await (await fetch(uri)).arrayBuffer();
  const id = await uploadImage(new Uint8Array(buf), 'image/png', 'coco.png');
  cocoCache = { id, at: Date.now() };
  return id;
}

/** Makes one picture and returns a link to it (temporary: save it with savePicture). */
export async function makeHookPicture(p: PictureRequest): Promise<string> {
  if (!KEY) throw new Error('No YouCam key');
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${KEY}` };
  // reference pictures: the sketch first (Image 1), then Coco
  const ids: string[] = [];
  if (p.sketch) ids.push(await uploadImage(fromBase64(p.sketch), 'image/png', 'sketch.png'));
  if (p.withCoco) ids.push(await cocoFileId());
  const refs = { sketch: !!p.sketch, coco: p.withCoco };
  const base = ids.length ? IMAGE_TO_IMAGE : TEXT_TO_IMAGE;
  const begin = (minimal: boolean) =>
    fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...(ids.length ? { src_file_ids: ids } : {}), model: 'youcam-image-v2', prompt: buildPrompt(p, refs, minimal), size: SIZE }),
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
    const res = await fetch(`${base}/${id}`, { headers });
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
