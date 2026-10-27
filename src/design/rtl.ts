// Right-to-left helpers. Drrys is used by Arabic speakers: lectures, recalls, flashcards and Coco's answers
// are often in Arabic even while the app's own words are English. Two rules make both work:
//   1. Layout: use start/end, never left/right (marginStart, paddingEnd, start: 0, borderStartWidth…).
//      flexDirection 'row' already follows the app direction, so a row flips by itself in an RTL app.
//   2. Text the student or the AI wrote: let it pick its own direction with dirOf() (T and Field do it
//      for you with the `auto` prop), so an Arabic flashcard reads right-to-left inside an English screen.
import type { Ionicons } from '@expo/vector-icons';
import { I18nManager, type TextStyle } from 'react-native';

/** true when the whole app is laid out right-to-left */
export const isRTL = I18nManager.isRTL;

// Arabic, Hebrew, Syriac, Thaana, N'Ko and the Arabic presentation forms
const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const LTR_CHAR = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/;

/**
 * The direction of a piece of text: whichever script has more letters in it. (Lecture notes often start
 * with an English term, "ATP هو مصدر الطاقة", and should still read right-to-left.)
 */
export function dirOf(text: unknown): 'rtl' | 'ltr' | undefined {
  if (typeof text !== 'string') return undefined;
  let rtl = 0;
  let ltr = 0;
  for (const ch of text) {
    if (RTL_CHAR.test(ch)) rtl++;
    else if (LTR_CHAR.test(ch)) ltr++;
  }
  return rtl + ltr === 0 ? undefined : rtl >= ltr ? 'rtl' : 'ltr';
}

/** Text style that makes a string read in its own direction (empty when the text has no letters). */
export function autoDir(text: unknown): TextStyle {
  const d = dirOf(text);
  if (!d) return {};
  // React Native swaps left and right in an RTL app, so 'left' means "the start of the app's direction":
  // text that runs with the app starts at 'left', text that runs against it starts at 'right'.
  return { writingDirection: d, textAlign: d === (isRTL ? 'rtl' : 'ltr') ? 'left' : 'right' };
}

type Icon = keyof typeof Ionicons.glyphMap;
const MIRROR: Partial<Record<Icon, Icon>> = {
  'chevron-forward': 'chevron-back',
  'chevron-back': 'chevron-forward',
  'arrow-forward': 'arrow-back',
  'arrow-back': 'arrow-forward',
  'caret-forward': 'caret-back',
  'caret-back': 'caret-forward',
};

/** Icons that point "forward" or "back" point the other way in an RTL app. */
export function dirIcon(name: Icon): Icon {
  return isRTL ? (MIRROR[name] ?? name) : name;
}
