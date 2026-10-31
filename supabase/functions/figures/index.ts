// Pictures for Coco's questions: cuts a diagram, table or picture out of a page of the student's lecture PDF.
// The app sends the PDF pages of the session (the same file Coco read) and, for each question that needs a
// picture, the page and the box around the picture (Gemini's box: [top, left, bottom, right], 0–1000 of the page).
// Each one comes back as a JPEG (base64). No AI key is used here and nothing is stored.
//
// Deploy:  npx supabase functions deploy figures --no-verify-jwt
//
// The pages are drawn with MuPDF (WebAssembly, AGPL like Drrys). Its 10 MB engine is downloaded once per cold start
// from the npm CDN instead of being bundled, so the function stays small.

const MUPDF = '1.28.1';
const MAX_BODY = 40 * 1024 * 1024; // the lecture pages as base64, like functions/ai
const MAX_CROPS = 12;
const OUT_WIDTH = 1100; // pixels across the cut-out picture (sharp on a phone, small to send)
const PAD = 0.03; // a little room around the box (part of the page)

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

// deno-lint-ignore no-explicit-any
let engine: Promise<any> | undefined;
function mupdf() {
  engine ??= (async () => {
    const res = await fetch(Deno.env.get('MUPDF_WASM_URL') || `https://cdn.jsdelivr.net/npm/mupdf@${MUPDF}/dist/mupdf-wasm.wasm`);
    if (!res.ok) throw new Error(`could not load the PDF engine (${res.status})`);
    // the engine reads its options from here when it starts: hand it the downloaded WebAssembly
    (globalThis as Record<string, unknown>)['$libmupdf_wasm_Module'] = { wasmBinary: new Uint8Array(await res.arrayBuffer()) };
    return await import('npm:mupdf@1.28.1'); // a plain string, so the deploy bundles it (keep it the same as MUPDF)
  })().catch((e) => {
    engine = undefined; // try again on the next request
    throw e;
  });
  return engine;
}

const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
function toB64(u: Uint8Array) {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

/** The box as a part of the page (0–1), padded and kept on the page. A missing, broken or tiny box means the whole page. */
function area(box: unknown): [number, number, number, number] {
  const b = Array.isArray(box) ? box.map(Number) : [];
  if (b.length !== 4 || b.some((v) => !Number.isFinite(v))) return [0, 0, 1, 1];
  let [top, left, bottom, right] = b.map((v) => Math.max(0, Math.min(1000, v)) / 1000);
  if (bottom < top) [top, bottom] = [bottom, top];
  if (right < left) [left, right] = [right, left];
  if (bottom - top < 0.04 || right - left < 0.04) return [0, 0, 1, 1];
  return [Math.max(0, top - PAD), Math.max(0, left - PAD), Math.min(1, bottom + PAD), Math.min(1, right + PAD)];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return json({ error: 'too big' }, 413);
  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  const crops = (Array.isArray(body?.crops) ? body.crops : []).slice(0, MAX_CROPS);
  if (typeof body?.pdf !== 'string' || !crops.length) return json({ error: 'send { pdf, crops: [{ page, box }] }' }, 400);
  try {
    const m = await mupdf();
    const doc = m.Document.openDocument(fromB64(body.pdf), 'application/pdf');
    const pages = doc.countPages();
    const images = crops.map((c: { page?: unknown; box?: unknown }) => {
      const n = Math.floor(Number(c?.page));
      if (!(n >= 1 && n <= pages)) return null;
      try {
        const page = doc.loadPage(n - 1);
        const [x0, y0, x1, y1] = page.getBounds();
        const [top, left, bottom, right] = area(c.box);
        const r = [x0 + (x1 - x0) * left, y0 + (y1 - y0) * top, x0 + (x1 - x0) * right, y0 + (y1 - y0) * bottom];
        const s = Math.max(1, Math.min(4, OUT_WIDTH / (r[2] - r[0])));
        const pix = new m.Pixmap(m.ColorSpace.DeviceRGB, [Math.floor(r[0] * s), Math.floor(r[1] * s), Math.ceil(r[2] * s), Math.ceil(r[3] * s)], false);
        pix.clear(255);
        const dev = new m.DrawDevice(m.Matrix.identity, pix);
        page.run(dev, m.Matrix.scale(s, s));
        dev.close();
        const out = { data: toB64(pix.asJPEG(85)), width: pix.getWidth(), height: pix.getHeight() };
        pix.destroy?.();
        page.destroy?.();
        return out;
      } catch {
        return null; // this one picture failed: the others still come back
      }
    });
    doc.destroy?.();
    return json({ images });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e).slice(0, 200) }, 502);
  }
});
