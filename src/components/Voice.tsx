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
import { File } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { transcribe, voiceEnabled } from '@/lib/ai';
import { liveEnabled, startDictation, type DictationHandle } from '@/lib/live';
import { haptic } from '@/lib/feedback';
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

async function readBase64(uri: string): Promise<string> {
  if (Platform.OS !== 'web') return new File(uri).base64();
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Record → transcribe. `onText` gets what was said (never called for silence). */
export function useVoice(onText: (text: string) => void, onFallback?: () => void) {
  const recorder = useAudioRecorder(SPEECH);
  const rec = useAudioRecorderState(recorder, 150);
  const [state, setState] = useState<VoiceState>('idle');
  const alive = useRef(true);
  // live writing (web): the words being spoken right now, the microphone level and the time
  const streaming = Platform.OS === 'web' && liveEnabled;
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
    if (!voiceEnabled) return onFallback?.(); // no Gemini key: use the keyboard's mic instead
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
              Alert.alert('Live writing stopped', m);
            }
          },
        });
      } catch (e) {
        dict.current = undefined;
        setState('idle');
        Alert.alert('Can’t listen right now', String((e as Error)?.message ?? e));
      }
      return;
    }
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Microphone is off', 'Allow the microphone for Drrys in your phone settings to talk to Coco.');
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
      Alert.alert('Can’t record right now', 'Another app may be using the microphone.');
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
      else Alert.alert('I didn’t catch that', 'Try again a little closer to the mic.');
    } catch {
      if (alive.current) Alert.alert('Coco couldn’t hear that', 'Check your connection and try again — or type it instead.');
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

/** The mic button: pulses with your voice while recording, spins while Coco writes. */
export function MicButton({ voice, size = 50, style }: { voice: ReturnType<typeof useVoice>; size?: number; style?: StyleProp<ViewStyle> }) {
  const { state, level, toggle } = voice;
  const recording = state === 'recording';
  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(recording ? 1.15 + level * 0.45 : 1, { duration: 140 }) }],
    opacity: withTiming(recording ? 1 : 0, { duration: 200 }),
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={recording ? 'Stop recording' : state === 'writing' ? 'Writing down what you said' : 'Talk to Coco'}
      onPress={toggle}
      disabled={state === 'writing'}
      hitSlop={6}
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(229,107,107,0.28)' }, ring]} />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: recording ? C.red : C.teal,
          alignItems: 'center',
          justifyContent: 'center',
          borderBottomWidth: 4,
          borderColor: recording ? '#9B2C2C' : C.shadow,
        }}>
        {state === 'writing' ? <ActivityIndicator color={C.white} /> : <Ionicons name={recording ? 'stop' : 'mic'} size={size * 0.42} color={C.white} />}
      </View>
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
