/**
 * Writing by voice, live: the student talks and the words appear on the screen while they talk (Gemini Live
 * transcription model, WebSocket). Web only for now. Coco never speaks: this is only the student's voice → text.
 *
 * OFF for now: it needs the Gemini key in the app, and the key now lives only on the server (supabase/functions/ai).
 * To bring it back, the server should hand out short-lived "ephemeral tokens" and the socket should use one.
 */
import { Platform } from 'react-native';

const KEY = ''; // no key in the app any more (see above)
const WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${KEY}`;

export const liveEnabled = Platform.OS === 'web' && KEY.length > 10;

// Runs in the audio thread: turns the microphone (any sample rate) into 16 kHz 16-bit PCM chunks of 40 ms.
const WORKLET = `
class Mic16 extends AudioWorkletProcessor {
  constructor() { super(); this.ratio = sampleRate / 16000; this.t = 0; this.inb = []; this.out = []; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) this.inb.push(ch[i]);
    while (this.t + 1 < this.inb.length) {
      const i0 = Math.floor(this.t), f = this.t - i0;
      this.out.push(this.inb[i0] * (1 - f) + this.inb[i0 + 1] * f);
      this.t += this.ratio;
    }
    const drop = Math.floor(this.t);
    if (drop > 0) { this.inb.splice(0, drop); this.t -= drop; }
    while (this.out.length >= 640) {
      const pcm = new Int16Array(640);
      let sum = 0;
      for (let i = 0; i < 640; i++) {
        const s = Math.max(-1, Math.min(1, this.out[i]));
        sum += s * s;
        pcm[i] = s < 0 ? s * 32768 : s * 32767;
      }
      this.out.splice(0, 640);
      this.port.postMessage({ pcm: pcm.buffer, rms: Math.sqrt(sum / 640) }, [pcm.buffer]);
    }
    return true;
  }
}
registerProcessor('mic16', Mic16);
`;

const toB64 = (buf: ArrayBuffer) => {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 0x4000) s += String.fromCharCode(...b.subarray(i, i + 0x4000));
  return btoa(s);
};

/** Opens the microphone and calls `onChunk` with 40 ms of 16 kHz 16-bit PCM (and its loudness) until closed. */
async function openMic(onChunk: (pcm: ArrayBuffer, rms: number) => void): Promise<{ close: () => void }> {
  const g = globalThis as any;
  let media: MediaStream;
  try {
    media = await g.navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch {
    throw new Error('Coco can’t hear you: allow the microphone for this page, then try again.');
  }
  const AC = g.AudioContext || g.webkitAudioContext;
  const ctx = new AC();
  await ctx.audioWorklet.addModule(g.URL.createObjectURL(new g.Blob([WORKLET], { type: 'application/javascript' })));
  const node = new g.AudioWorkletNode(ctx, 'mic16');
  const src = ctx.createMediaStreamSource(media);
  src.connect(node);
  node.port.onmessage = (e: MessageEvent) => onChunk(e.data.pcm, e.data.rms ?? 0);
  return {
    close: () => {
      try {
        node.disconnect();
        src.disconnect();
      } catch {}
      media.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      ctx.close().catch(() => {});
    },
  };
}

export type DictationEvents = {
  /** the words being spoken right now (not final yet: they can still change) */
  interim: (text: string) => void;
  /** a finished piece of text */
  final: (text: string) => void;
  level: (v: number) => void;
  error: (msg: string) => void;
};
export type DictationHandle = { finish: () => Promise<void>; cancel: () => void };

/**
 * Writing by voice, live: the words appear on the screen while the student is still talking (Gemini Live
 * transcription model, any language). Web only. Sessions of this kind last at most about 10 minutes.
 */
export async function startDictation(ev: DictationEvents): Promise<DictationHandle> {
  if (!liveEnabled) throw new Error('Live writing needs the web version and a Gemini key.');
  const model = process.env.EXPO_PUBLIC_GEMINI_TRANSCRIBE_LIVE_MODEL || 'gemini-3.5-transcribe-live';
  let ready = false;
  let closed = false;
  let pending = ''; // the last interim words, if they never became final
  const sock = new WebSocket(WS_URL);
  const queue: string[] = []; // audio recorded while the socket is still opening
  const send = (o: unknown) => sock.readyState === 1 && sock.send(JSON.stringify(o));
  let onFinalAfterEnd: (() => void) | undefined;

  let mic: { close: () => void } | undefined;
  const shutdown = () => {
    if (closed) return;
    closed = true;
    mic?.close();
    try {
      sock.close();
    } catch {}
  };

  sock.onopen = () =>
    sock.send(
      JSON.stringify({
        setup: {
          model: `models/${model}`,
          generationConfig: { responseModalities: ['TEXT'] },
          inputAudioTranscription: { languageCodes: [] }, // empty: any language, found automatically
        },
      }),
    );
  sock.onmessage = async (m) => {
    let msg: any;
    try {
      msg = JSON.parse(typeof m.data === 'string' ? m.data : await (m.data as Blob).text());
    } catch {
      return;
    }
    if (msg.setupComplete !== undefined && !ready) {
      ready = true;
      queue.splice(0).forEach((x) => sock.send(x));
      return;
    }
    const sc = msg.serverContent;
    if (sc?.interimInputTranscription?.text != null) {
      pending = sc.interimInputTranscription.text;
      ev.interim(pending);
    }
    if (sc?.inputTranscription?.text) {
      pending = '';
      ev.interim('');
      ev.final(sc.inputTranscription.text);
      onFinalAfterEnd?.();
    }
  };
  sock.onerror = () => {};
  sock.onclose = (e) => {
    if (closed) return;
    shutdown();
    ev.error(`The live writing connection closed (${e.code}${e.reason ? `: ${e.reason.slice(0, 160)}` : ''}).`);
  };

  // the socket is already opening: its handlers are set above, so nothing is missed while the microphone starts
  try {
    mic = await openMic((pcm, rms) => {
      ev.level(Math.min(1, rms * 6));
      const m = JSON.stringify({ realtimeInput: { audio: { data: toB64(pcm), mimeType: 'audio/pcm;rate=16000' } } });
      if (ready) sock.send(m);
      else if (queue.length < 100) queue.push(m);
    });
  } catch (e) {
    shutdown();
    throw e;
  }

  return {
    // the student stopped: finish the last sentence, hand over what is left, close
    finish: () =>
      new Promise<void>((done) => {
        if (closed) return done();
        mic?.close();
        send({ realtimeInput: { audioStreamEnd: true } });
        const end = () => {
          if (pending.trim()) ev.final(pending);
          pending = '';
          ev.interim('');
          shutdown();
          done();
        };
        onFinalAfterEnd = () => setTimeout(end, 150);
        setTimeout(end, 1800); // do not wait longer than this for the last words
      }),
    cancel: shutdown,
  };
}
