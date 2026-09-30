// Onboarding shared bits.

/** Questions about the student asked before planting (Coco's hello promises this many). The
 *  "how did you hear about us" question comes after these, at the very end of onboarding. */
export const MAIN_QUESTIONS = 4;

/** Every onboarding screen that shows the progress bar, in order — the bar fills one step per screen. */
const STEPS = ['q0', 'q1', 'q2', 'q3', 'payoff', 'plant', 'signin', 'source', 'reminder'] as const;
export type OnboardingStep = (typeof STEPS)[number];
export const progressOf = (step: OnboardingStep) => (STEPS.indexOf(step) + 1) / STEPS.length;

/** Coco's first taste of personalisation: how memory works (the idea behind Drrys), explained with
 *  whatever the student is into. */
export const INTEREST_EXAMPLES: Record<string, { emoji: string; text: string }> = {
  Football: { emoji: '⚽', text: 'Reviewing right before you forget is like a well-timed pass: hit it at the right moment and the memory travels much further.' },
  Gaming: { emoji: '🎮', text: 'Memory works like XP: every review at the right time levels a fact up, and high-level facts barely decay.' },
  Cars: { emoji: '🏎️', text: 'A fact is like a car battery: a short drive (a quick review) at the right time keeps it charged for much longer.' },
  UFC: { emoji: '🥊', text: 'Recall is like sparring: pulling the answer out yourself, not rereading, is what builds real strength.' },
  Tech: { emoji: '💻', text: 'Your memory is like a cache: facts you fetch at the right intervals get promoted to long-term storage.' },
  Anime: { emoji: '🌀', text: 'It’s a training arc: every time you struggle to recall and win, the power-up sticks for good.' },
  Basketball: { emoji: '🏀', text: 'Spaced reviews are like free-throw practice: a few shots spread over days beat a hundred in one night.' },
  Music: { emoji: '🎵', text: 'Learning is like a song on repeat: hear it again just as it starts to fade, and soon you know every word.' },
};
export const DEFAULT_EXAMPLE = {
  emoji: '🌱',
  text: 'Memory is like a plant: a little water right before it wilts keeps it growing, much better than a flood once a month.',
};
