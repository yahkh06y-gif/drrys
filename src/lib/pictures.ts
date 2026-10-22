// The picture check: every picture from Qloo is looked at by the AI before a student sees it.
// Pictures are checked a few at a time, each answer is remembered on the phone, and anything unclear
// (no AI, no network, an unsure answer) stays hidden. Hidden and not-yet-checked look the same.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { checkPictures } from '@/lib/ai';

type Verdict = 'ok' | 'hide';
const verdicts = new Map<string, Verdict>();
const listeners = new Map<string, Set<() => void>>();
const queue: string[] = [];
const STORE = 'drrys-picture-checks';
const BATCH = 6;
let loaded: Promise<void> | undefined;
let running = false;
let timer: ReturnType<typeof setTimeout> | undefined;

// remembered answers: the same posters come up again and again
const load = () =>
  (loaded ??= AsyncStorage.getItem(STORE)
    .then((raw) => {
      const saved = raw ? (JSON.parse(raw) as Record<string, Verdict>) : {};
      Object.entries(saved).forEach(([u, v]) => verdicts.has(u) || verdicts.set(u, v));
    })
    .catch(() => {}));
const save = () => AsyncStorage.setItem(STORE, JSON.stringify(Object.fromEntries([...verdicts].slice(-600)))).catch(() => {});

async function asBase64(uri: string): Promise<{ data: string; mime: 'image/png' | 'image/jpeg' | 'image/webp' } | undefined> {
  const res = await fetch(uri);
  if (!res.ok) return undefined;
  const blob = await res.blob();
  if (blob.size > 4_000_000) return undefined; // too big to send: keep it hidden
  const type = blob.type.includes('png') ? 'image/png' : blob.type.includes('webp') ? 'image/webp' : 'image/jpeg';
  const data = await new Promise<string>((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] ?? '');
    r.onerror = () => fail(r.error);
    r.readAsDataURL(blob);
  });
  return data ? { data, mime: type } : undefined;
}

function decide(uri: string, v: Verdict) {
  verdicts.set(uri, v);
  listeners.get(uri)?.forEach((f) => f());
}

async function run() {
  if (running) return;
  running = true;
  try {
    await load();
    while (queue.length) {
      const batch = queue.splice(0, BATCH).filter((u) => !verdicts.has(u));
      if (!batch.length) continue;
      const got = await Promise.all(batch.map((u) => asBase64(u).catch(() => undefined)));
      const sendable = batch.map((u, i) => ({ u, p: got[i] })).filter((x) => x.p);
      batch.filter((_, i) => !got[i]).forEach((u) => decide(u, 'hide'));
      if (!sendable.length) continue;
      let ok: boolean[];
      try {
        ok = await checkPictures(sendable.map((x) => x.p!));
      } catch {
        ok = sendable.map(() => false);
      }
      sendable.forEach((x, i) => decide(x.u, ok[i] ? 'ok' : 'hide'));
      save();
    }
  } finally {
    running = false;
  }
}

function ask(uri: string) {
  if (verdicts.has(uri) || queue.includes(uri)) return;
  queue.push(uri);
  clearTimeout(timer);
  timer = setTimeout(run, 250); // gather the pictures on screen into batches
}

/** true once this picture has been checked and found suitable. */
export function usePictureOk(uri?: string) {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!uri) return;
    const f = () => bump((n) => n + 1);
    if (!listeners.has(uri)) listeners.set(uri, new Set());
    listeners.get(uri)!.add(f);
    load().then(() => (verdicts.has(uri) ? f() : ask(uri)));
    return () => {
      listeners.get(uri)?.delete(f);
    };
  }, [uri]);
  return !!uri && verdicts.get(uri) === 'ok';
}
