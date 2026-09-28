// Sounds + haptics. Every tap in Drrys should feel tactile, like pressing clay.
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

export function play(name: Sfx) {
  if (!useApp.getState().sound) return;
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

export const tap = (s: Sfx = 'tap') => {
  play(s);
  haptic('light');
};
