// Voice input: tap the mic, talk, tap again. On the web the words appear on the screen while you talk (Gemini Live
// transcription); in the app Coco writes everything down after you stop (Gemini transcription).
// Works in Arabic, English or a mix. Without a Gemini key the mic falls back to the keyboard's own dictation.
import { Ionicons } from '@expo/vector-icons';
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { alert } from '@/lib/alert';
import { readFileBase64 } from '@/lib/readfile';
import { transcribe, voiceEnabled } from '@/lib/ai';
import { liveEnabled, startDictation, type DictationHandle } from '@/lib/live';
import { haptic } from '@/lib/feedback';
import { color, ease, motion, palette } from '@/design/tokens';
import { C, F } from '@/theme';

// Speech only: mono, 16 kHz, 32 kbps AAC → about 4 KB a second (a 5-minute brain dump ≈ 1.2 MB).
const SPEECH: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.MEDIUM, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
  web: { mimeType: 'audio/webm', bitsPerSecond: 32000 },
};
const MAX_MS = 10 * 60_000; // stop by itself after 10 minutes

export type VoiceState = 'idle' | 'recording' | 'writing';

const readBase64 = readFileBase64;

/** Record → transcribe. `onText` gets what was said (never called for silence). */
export function useVoice(onText: (text: string) => void, onFallback?: () => void) {
  const recorder = useAudioRecorder(SPEECH);
  const rec = useAudioRecorderState(recorder, 150);
  const [state, setState] = useState<VoiceState>('idle');
  const alive = useRef(true);
  // live writing (web): the words being spoken right now, the microphone level and the time
  // word-by-word writing is switched OFF (it did not work well yet): the normal record → transcribe path is used.
  // It can be tried again with EXPO_PUBLIC_LIVE_WRITING=1 in .env, but it is not part of the app for now.
  const streaming = process.env.EXPO_PUBLIC_LIVE_WRITING === '1' && Platform.OS === 'web' && liveEnabled;
  const [live, setLive] = useState('');
  const [streamLevel, setStreamLevel] = useState(0);
  const [streamSecs, setStreamSecs] = useState(0);
  const dict = useRef<DictationHandle | undefined>(undefined);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const start = useCallback(async () => {
    if (!voiceEnabled && !streaming) return onFallback?.(); // no Gemini key: use the keyboard's mic instead
    if (streaming) {
      try {
        setLive('');
        setStreamSecs(0);
        setState('recording');
        dict.current = await startDictation({
          interim: setLive,
          final: (t) => {
            setLive('');
            onTextRef.current(t.trim());
          },
          level: setStreamLevel,
          error: (m) => {
            dict.current = undefined;
            if (alive.current) {
              setState('idle');
              setLive('');
              alert('Live writing stopped', m);
            }
          },
        });
      } catch (e) {
        dict.current = undefined;
        setState('idle');
        alert('Can’t listen right now', String((e as Error)?.message ?? e));
      }
      return;
    }
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      alert('Microphone is off', 'Allow the microphone for Drrys in your phone settings to talk to Coco.');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      haptic('light');
      setState('recording');
    } catch {
      setState('idle');
      alert('Can’t record right now', 'Another app may be using the microphone.');
    }
  }, [recorder, onFallback, streaming]);

  const stop = useCallback(async () => {
    if (state !== 'recording') return;
    setState('writing');
    haptic('medium');
    if (streaming) {
      try {
        await dict.current?.finish();
      } catch {}
      dict.current = undefined;
      if (alive.current) {
        setLive('');
        setStreamLevel(0);
        setState('idle');
      }
      return;
    }
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      const uri = recorder.uri;
      if (!uri) throw new Error('no recording');
      const mime = Platform.OS === 'web' ? 'audio/webm' : 'audio/m4a';
      const text = await transcribe(await readBase64(uri), mime);
      if (!alive.current) return;
      if (text) onText(text);
      else alert('I didn’t catch that', 'Try again a little closer to the mic.');
    } catch {
      if (alive.current) alert('Coco couldn’t hear that', 'Check your connection and try again — or type it instead.');
    }
    if (alive.current) setState('idle');
  }, [state, recorder, onText, streaming]);

  // time while writing live, and a stop before the 10-minute limit of a live connection
  useEffect(() => {
    if (!streaming || state !== 'recording') return;
    const t0 = Date.now();
    const id = setInterval(() => setStreamSecs(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, [streaming, state]);
  useEffect(() => {
    if (streaming && state === 'recording' && streamSecs >= 9 * 60 + 30) stop();
  }, [streaming, state, streamSecs, stop]);
  // safety stop for very long recordings
  useEffect(() => {
    if (!streaming && state === 'recording' && rec.durationMillis >= MAX_MS) stop();
  }, [streaming, state, rec.durationMillis, stop]);
  // leaving the screen while writing live: close the connection
  useEffect(
    () => () => {
      dict.current?.cancel();
    },
    [],
  );

  // leaving the screen mid-recording: just stop, don't transcribe. Only touch the recorder if we started
  // it — by the time this runs the hook may already have released the native recorder, and reading a
  // released object throws (that crashed the app when a session screen was replaced).
  const recRef = useRef(false);
  recRef.current = state === 'recording';
  useEffect(
    () => () => {
      if (!recRef.current) return;
      try {
        recorder.stop().catch(() => {});
      } catch {
        // already released
      }
    },
    [recorder],
  );

  const toggle = () => (state === 'idle' ? start() : state === 'recording' ? stop() : undefined);
  // metering is in dB (about -60 quiet … 0 loud) → 0…1
  const level = streaming ? (state === 'recording' ? streamLevel : 0) : state === 'recording' && rec.metering != null ? Math.max(0, Math.min(1, (rec.metering + 55) / 50)) : 0;
  const seconds = streaming ? (state === 'recording' ? streamSecs : 0) : Math.floor((state === 'recording' ? rec.durationMillis : 0) / 1000);
  // `live`: the words being spoken right now (web). Show them after the text, e.g. with `withLive(text, voice.live)`.
  return { state, seconds, level, toggle, live };
}

/** The text with the words being spoken right now added at the end. */
export const withLive = (text: string, live: string) => (live ? `${text}${text && !/\s$/.test(text) ? ' ' : ''}${live}` : text);

/** The mic button. Idle: it breathes softly, inviting a tap. Recording: it turns red and a soft halo swells
 *  with your voice (the voice lines next to it show what you say, see VoiceWave). Writing: back to green with a spinner while Coco types it up. */
export function MicButton({ voice, size = 50, style }: { voice: ReturnType<typeof useVoice>; size?: number; style?: StyleProp<ViewStyle> }) {
  const { state, level, toggle } = voice;
  const recording = state === 'recording';
  const writing = state === 'writing';
  const reduce = useReducedMotion();
  const edge = Math.max(3, Math.round(size / 18));

  // 0 = green (idle/writing) → 1 = red (recording)
  const hot = useSharedValue(0);
  useEffect(() => {
    hot.value = withTiming(recording ? 1 : 0, { duration: motion.base, easing: ease.inOut });
  }, [recording, hot]);

  // the voice halo follows the mic level, smoothed by a spring so it swells instead of jumping
  const lv = useSharedValue(0);
  useEffect(() => {
    lv.value = reduce ? 0 : withSpring(recording ? level : 0, { damping: 14, stiffness: 180 });
  }, [level, recording, reduce, lv]);

  // idle breathing: a slow 2.6 s in-and-out, only while nothing is happening
  const breath = useSharedValue(0);
  useEffect(() => {
    if (state === 'idle' && !reduce) breath.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }), -1, true);
    else breath.value = withTiming(0, { duration: motion.fast });
    return () => cancelAnimation(breath);
  }, [state, reduce, breath]);

  // press: sinks onto its edge and squeezes a touch; springs back on release
  const down = useSharedValue(0);
  // the icon pops when it changes (mic ↔ stop)
  const pop = useSharedValue(1);
  useEffect(() => {
    pop.value = reduce ? 1 : withSequence(withTiming(0.6, { duration: 90, easing: ease.out }), withSpring(1, motion.spring.bouncy));
  }, [state, reduce, pop]);

  const halo = useAnimatedStyle(() => ({
    opacity: interpolate(hot.value, [0, 1], [interpolate(breath.value, [0, 1], [0.18, 0.32]), 0.32]),
    transform: [{ scale: 1.08 + breath.value * 0.1 * (1 - hot.value) + lv.value * 0.55 * hot.value }],
    backgroundColor: interpolateColor(hot.value, [0, 1], [color.action.primary, palette.berry500]),
  }));
  const body = useAnimatedStyle(() => ({ transform: [{ translateY: down.value * edge }, { scale: 1 - down.value * 0.03 }] }));
  const face = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(hot.value, [0, 1], [color.action.primary, palette.berry500]) }));
  const under = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(hot.value, [0, 1], [color.action.primaryEdge, palette.berry700]) }));
  const icon = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={recording ? 'Stop recording' : writing ? 'Writing down what you said' : 'Talk to Coco'}
      onPress={toggle}
      onPressIn={() => (down.value = withTiming(1, { duration: motion.press, easing: ease.out }))}
      onPressOut={() => (down.value = withSpring(0, motion.spring.press))}
      disabled={writing}
      hitSlop={6}
      style={[{ width: size, height: size + edge, alignItems: 'center', justifyContent: 'flex-start' }, style]}>
      {/* voice halo (behind everything) */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, width: size, height: size, borderRadius: size / 2 }, halo]} />
      {/* the edge it sinks onto */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: edge, width: size, height: size, borderRadius: size / 2 }, under]} />
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }, face, body]}>
        {writing ? (
          <ActivityIndicator color={C.white} />
        ) : (
          <Animated.View style={icon}>
            <Ionicons name={recording ? 'stop' : 'mic'} size={size * (recording ? 0.36 : 0.42)} color={C.white} />
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

/** One line under a mic: what's happening now. */
export function VoiceHint({ voice, idle }: { voice: ReturnType<typeof useVoice>; idle: string }) {
  const t = voice.seconds;
  const text =
    voice.state === 'recording'
      ? `Listening… ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} · tap to stop`
      : voice.state === 'writing'
        ? 'Coco is writing down what you said…'
        : idle;
  return <Text style={{ fontFamily: F.medium, fontSize: 12, color: voice.state === 'recording' ? C.red : C.body, textAlign: 'center' }}>{text}</Text>;
}

/** Voice lines: while you talk, a new line comes in on the right every beat, as tall as your voice is loud,
 *  and the older ones slide left. Quiet moments leave small dots, so you can see your speech as you go. */
export function VoiceWave({ level, active, height = 36, tint = palette.berry500, style }: { level: number; active: boolean; height?: number; tint?: string; style?: StyleProp<ViewStyle> }) {
  const [w, setW] = useState(0);
  const count = Math.max(8, Math.floor((w + GAP) / (BAR + GAP)));
  const [bars, setBars] = useState<number[]>([]);
  const lvl = useRef(level);
  useEffect(() => {
    lvl.current = level;
  }, [level]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      // a little wobble so steady talking still looks alive; silence stays a dot
      const v = lvl.current < 0.06 ? 0 : Math.min(1, lvl.current * (0.7 + Math.random() * 0.45));
      setBars((b) => [...b, v].slice(-count));
    }, TICK);
    return () => {
      clearInterval(id);
      setBars([]);
    };
  }, [active, count]);

  const pad = Array.from({ length: Math.max(0, count - bars.length) }, () => 0);
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ height, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: GAP, overflow: 'hidden' }, style]}>
      {w > 0 && [...pad, ...bars].map((v, i) => <WaveBar key={i} v={v} max={height} tint={tint} />)}
    </View>
  );
}

const BAR = 3;
const GAP = 3;
const TICK = 90;

function WaveBar({ v, max, tint }: { v: number; max: number; tint: string }) {
  const h = useSharedValue(BAR);
  const reduce = useReducedMotion();
  useEffect(() => {
    const to = BAR + v * (max - BAR);
    h.value = reduce ? to : withTiming(to, { duration: TICK, easing: Easing.out(Easing.quad) });
  }, [v, max, reduce, h]);
  const a = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[{ width: BAR, borderRadius: BAR / 2, backgroundColor: tint }, a]} />;
}
