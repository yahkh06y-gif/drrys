// Coco's AI, behind a small server so the AI keys never ship inside the app (same idea as functions/qloo).
// The app sends { action, ... }; this function adds the secret key and passes the request on to Claude,
// Gemini or YouCam. The provider's answer comes back as it is (same status, same body), so the app's
// retry logic (Gemini model chain, YouCam polling) works exactly as before.
//
// Deploy:  npx supabase functions deploy ai --no-verify-jwt
// Keys:    npx supabase secrets set GEMINI_API_KEY=<key> YOUCAM_API_KEY=<key>   (and ANTHROPIC_API_KEY=<key> for Claude)
//          Type them in your own terminal; never commit them.
//
// Only what the app needs is allowed: Claude messages, Gemini generateContent on gemini-* models, and the
// three YouCam calls for memory-hook pictures. Output length is capped so one request can't run up a big bill.
//
// Only Drrys students get in: every request carries the student's login token (an anonymous login for students
// without an account), and each student has a daily cap (DAILY_CALLS, counted in the ai_usage table), so a
// stranger who finds this URL can't spend the AI keys. Turn on "Allow anonymous sign-ins" in Supabase
// (Authentication → Sign In / Providers) or students without an account get "sign in first".

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const CLAUDE_MODEL = Deno.env.get('CLAUDE_MODEL') || 'claude-sonnet-5-5';
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const YOUCAM_KEY = Deno.env.get('YOUCAM_API_KEY') ?? '';

const YOUCAM = 'https://yce-api-01.makeupar.com/s2s/v2.0';
const YOUCAM_TASKS: Record<string, string> = { text: `${YOUCAM}/task/text-to-image/youcam`, image: `${YOUCAM}/task/image-to-image/youcam` };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const DAILY_CALLS = Number(Deno.env.get('AI_DAILY_CALLS')) || 400; // AI calls per student per day

const MAX_BODY = 40 * 1024 * 1024; // a lecture PDF as base64 (Gemini takes up to ~20 MB inline)
const MAX_OUT = 12000; // output tokens per request

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

/** The provider's answer, passed on unchanged (status + body). */
async function relay(res: Response): Promise<Response> {
  return new Response(await res.text(), { status: res.status, headers: { ...cors, 'content-type': res.headers.get('content-type') ?? 'application/json' } });
}

const clamp = (n: unknown, max: number) => Math.max(1, Math.min(max, Math.floor(Number(n) || 1000)));

async function claude(body: any): Promise<Response> {
  if (!ANTHROPIC_KEY) return json({ error: 'Claude is not set up on the server (ANTHROPIC_API_KEY)' }, 503);
  const model = typeof body.model === 'string' && /^claude-[a-z0-9.-]+$/i.test(body.model) ? body.model : CLAUDE_MODEL;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      max_tokens: clamp(body.max_tokens, MAX_OUT),
      system: String(body.system ?? ''),
      messages: [{ role: 'user', content: Array.isArray(body.content) ? body.content : [] }],
    }),
  });
  return relay(res);
}

async function gemini(body: any): Promise<Response> {
  if (!GEMINI_KEY) return json({ error: 'Gemini is not set up on the server (GEMINI_API_KEY)' }, 503);
  const model = String(body.model ?? '');
  if (!/^gemini-[a-z0-9.-]+$/i.test(model)) return json({ error: 'unknown model' }, 400);
  const req = body.request ?? {};
  // only the parts the app uses: no tools, no extra settings
  const generationConfig = { ...(req.generationConfig ?? {}) };
  generationConfig.maxOutputTokens = clamp(generationConfig.maxOutputTokens, MAX_OUT + 2048);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({ systemInstruction: req.systemInstruction, contents: req.contents, generationConfig }),
  });
  return relay(res);
}

async function youcam(body: any): Promise<Response> {
  if (!YOUCAM_KEY) return json({ error: 'YouCam is not set up on the server (YOUCAM_API_KEY)' }, 503);
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${YOUCAM_KEY}` };
  switch (body.step) {
    // asks YouCam for a place to upload one picture (the upload itself goes from the app straight to that link)
    case 'file': {
      const files = (Array.isArray(body.files) ? body.files : []).slice(0, 2);
      return relay(await fetch(`${YOUCAM}/file`, { method: 'POST', headers, body: JSON.stringify({ files }) }));
    }
    // starts making a picture
    case 'start': {
      const url = YOUCAM_TASKS[body.kind];
      if (!url) return json({ error: 'unknown kind' }, 400);
      const t = body.task ?? {};
      const task = {
        ...(Array.isArray(t.src_file_ids) ? { src_file_ids: t.src_file_ids.slice(0, 2).map(String) } : {}),
        model: 'youcam-image-v2',
        prompt: String(t.prompt ?? '').slice(0, 800),
        size: String(t.size ?? ''),
      };
      return relay(await fetch(url, { method: 'POST', headers, body: JSON.stringify(task) }));
    }
    // is the picture ready yet?
    case 'status': {
      const url = YOUCAM_TASKS[body.kind];
      const id = String(body.id ?? '');
      if (!url || !/^[\w-]{1,100}$/.test(id)) return json({ error: 'bad task' }, 400);
      return relay(await fetch(`${url}/${id}`, { headers }));
    }
  }
  return json({ error: 'unknown step' }, 400);
}

/** The student behind the request's login token, or null for a stranger. */
async function student(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? '';
  if (!/^Bearer \S+$/.test(auth) || !SUPABASE_URL || !SERVICE_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { authorization: auth, apikey: SERVICE_KEY } });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null);
  return typeof user?.id === 'string' ? user.id : null;
}

/** Counts one call for today; false once the student is over the daily cap. */
async function withinCap(uid: string): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ai_tick`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ p_user: uid }),
  });
  if (!res.ok) return true; // the counter itself failing shouldn't stop a real student
  return Number(await res.json()) <= DAILY_CALLS;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return json({ error: 'too big' }, 413);
  const uid = await student(req);
  if (!uid) return json({ error: 'sign in first' }, 401);
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  try {
    const costs = body?.action === 'claude' || body?.action === 'gemini' || (body?.action === 'youcam' && body?.step === 'start');
    if (costs && !(await withinCap(uid))) return json({ error: 'daily limit reached, see you tomorrow' }, 403);
    switch (body?.action) {
      // which providers have a key on the server (never the keys themselves)
      case 'status':
        return json({ claude: !!ANTHROPIC_KEY, gemini: !!GEMINI_KEY, youcam: !!YOUCAM_KEY });
      case 'claude':
        return await claude(body);
      case 'gemini':
        return await gemini(body);
      case 'youcam':
        return await youcam(body);
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e).slice(0, 200) }, 502);
  }
});
