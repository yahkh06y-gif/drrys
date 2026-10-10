// Sounds + haptics. Every tap feels tactile (a light haptic), but sound is saved for the moments that
// matter — a right or wrong answer, finishing a review, a purchase, watering the tree — the way the best
// apps do it. Routine UI (taps, selections, page flips) is silent.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useApp } from '@/store';

const SOURCES = {
  tap: require('../../assets/sounds/tap.wav'),
  select: require('../../assets/sounds/select.wav'),
  success: require('../../assets/sounds/success.wav'),
  wrong: require('../../assets/sounds/wrong.wav'),
  grow: require('../../assets/sounds/grow.wav'),
  flip: require('../../assets/sounds/flip.wav'),
  celebrate: require('../../assets/sounds/celebrate.wav'),
  water: require('../../assets/sounds/water.m4a'), // from the Blender watering render
  // the answer sounds (recorded for Drrys): right · wrong · half right
  right: require('../../assets/sounds/right.mp3'),
  miss: require('../../assets/sounds/miss.mp3'),
  half: require('../../assets/sounds/half.mp3'),
} as const;

export type Sfx = keyof typeof SOURCES;

const players: Partial<Record<Sfx, AudioPlayer>> = {};
let ready = false;

export async function initAudio() {
  if (ready) return;
  ready = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
  } catch {}
}

/** Routine UI sounds: kept as names so call sites stay readable, but they make no sound. */
const SILENT: ReadonlySet<Sfx> = new Set<Sfx>(['tap', 'select', 'flip']);

export function play(name: Sfx) {
  if (!useApp.getState().sound || SILENT.has(name)) return;
  try {
    let p = players[name];
    if (!p) {
      p = createAudioPlayer(SOURCES[name]);
      players[name] = p;
    }
    p.seekTo(0);
    p.play();
  } catch {}
}

export function haptic(kind: 'light' | 'medium' | 'success' | 'error' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (kind === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
}

/** Button press: a light haptic only (the `s` hint is kept for call sites, but buttons are silent). */
export const tap = (_s: Sfx = 'tap') => {
  haptic('light');
};
