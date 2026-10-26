/**
 * Pictures for memory hooks, made by the YouCam API (youcam-image-v2). Used ONLY for this: when a student
 * has written a hook and taps "Make a picture", the hook becomes a clay-style picture that matches the app.
 * One picture costs 1 credit, whatever the number of reference images.
 *
 * Two ways to make a picture:
 *  - words only: text-to-image (the hook, turned into a scene by the AI);
 *  - with Coco: Coco's picture (bundled in the app) is uploaded as the reference (image-to-image).
 * The API is asynchronous: start a task, then poll it until it is "success" (or "error").
 * Key: YOUCAM_API_KEY, a Supabase secret: every YouCam call goes through Drrys' server function
 * (supabase/functions/ai), so the key never ships in the app. EXPO_PUBLIC_PICTURES=0 hides "Make a picture".
 */
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import * as Legacy from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { cloudEnabled, fetchFunction } from '@/lib/cloud';
import { shrinkImage } from '@/lib/shrink';
import { saveSketch } from '@/lib/sketch';

// the server knows YouCam's addresses: 'text' = words only (no reference picture needed), 'image' = with a
// reference picture (Coco)
type Kind = 'text' | 'image';
const youcam = (body: Record<string, unknown>) => fetchFunction('ai', { action: 'youcam', ...body });
const SIZE = '1472*1104'; // 4:3; the allowed sizes are 1664*928, 1472*1104, 1328*1328, 1104*1472, 928*1664

export const youcamEnabled = cloudEnabled && process.env.EXPO_PUBLIC_PICTURES !== '0';

/** The picture could not be uploaded to YouCam (so it cannot be used as a reference). */
export class UploadError extends Error {}

const STYLE = 'A 3D clay-animation illustration: soft rounded plasticine shapes, pastel teal, green, orange and cream, soft studio light, clean simple background, friendly and playful, no text or letters.';
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n).trimEnd() : s);

export type PictureRequest = {
  hook: string;
  q: string;
  a: string;
  withCoco: boolean;
  /** what the picture shows, in words (the hook, turned into a scene by the AI) */
  scene?: string;
};

// The prompt may be 800 characters at most, so it is kept short (and cut). If it is still refused: one minimal retry.
function buildPrompt(p: PictureRequest, withCoco: boolean, minimal = false) {
  const coco = withCoco ? ' Add Coco, the small beige clay creature from Image 1, looking exactly like in that image.' : '';
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
  let body: any;
  try {
    const res = await youcam({ step: 'file', files: [{ content_type: contentType, file_name: fileName, file_size: bytes.byteLength }] });
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
    if (Platform.OS === 'web') {
      const put = await fetch(req.url, { method: req.method || 'PUT', headers: h, body: bytes as unknown as BodyInit });
      if (!put.ok) throw new Error(`${put.status}`);
    } else {
      // on a phone a raw byte array is not sent reliably by fetch (YouCam then says "Cannot determine file type"):
      // the bytes are written to a small file and sent as a real binary upload
      const tmp = new File(Paths.cache, `yc-${Date.now().toString(36)}-${fileName}`);
      tmp.write(toBase64(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer), { encoding: 'base64' });
      try {
        const r = await Legacy.uploadAsync(req.url, tmp.uri, { httpMethod: (req.method || 'PUT') as 'PUT', uploadType: Legacy.FileSystemUploadType.BINARY_CONTENT, headers: h });
        if (r.status < 200 || r.status >= 300) throw new Error(`${r.status}`);
      } finally {
        try {
          tmp.delete();
        } catch {}
      }
    }
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
  if (!youcamEnabled) throw new Error('Pictures are turned off');
  // reference picture: Coco's (when "Coco in it" is on)
  const ids: string[] = [];
  let coco = p.withCoco;
  if (coco) {
    try {
      ids.push(await cocoFileId());
    } catch {
      coco = false; // Coco's picture could not be sent: the picture is made without him rather than not at all
    }
  }
  const kind: Kind = ids.length ? 'image' : 'text';
  const begin = (minimal: boolean) =>
    youcam({ step: 'start', kind, task: { ...(ids.length ? { src_file_ids: ids } : {}), model: 'youcam-image-v2', prompt: buildPrompt(p, coco, minimal), size: SIZE } });
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
    const res = await youcam({ step: 'status', kind, id });
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
