// Demo session used when no Claude API key is configured. Content mirrors the Figma prototype.
import type { ActiveQuestion, Analysis, FlashCard } from './ai';

const analysis: Analysis = {
  summary: 'Your neural roots anchored 3 core ideas deeply on the first try.',
  nailed: [
    { title: 'Glycolysis in Cytoplasm', detail: 'Generated 2 net ATP and 2 NADH molecules before oxygen entry.', tag: 'Strong Recall' },
    { title: 'Mitochondrial Matrix', detail: 'Correctly identified the Krebs cycle site inside the inner matrix.', tag: 'Exact Match' },
    { title: 'Electron Carriers (NADH)', detail: 'Accurately recalled their role in shuttle transfers.', tag: 'Firmly Grasped' },
  ],
  forgotten: [
    {
      title: 'Substrate-Level Phosphorylation',
      detail: 'Occurs during both Glycolysis & the Citric Acid Cycle before the main electron transport chain.',
      tag: 'Missed',
      page: 'p.5',
    },
    {
      title: 'ATP Synthase Rotor Mechanism',
      detail: 'The proton gradient powers the physical turbine rotation across the inner membrane, mechanically generating ATP units.',
      tag: 'Missed',
      page: 'p.8',
    },
  ],
  corrections: [
    {
      concept: 'Electron Transport Chain',
      youSaid: 'Oxygen directly produces the ATP energy.',
      truth: 'Oxygen acts as the final electron acceptor forming H₂O; the proton gradient across ATP synthase actually drives ATP creation.',
      formula: 'O₂ + 4e⁻ + 4H⁺ → 2H₂O',
    },
  ],
  keywords: ['glucose breaking into pyruvate', 'mitochondrial matrix', 'Krebs cycle'],
};

const questions: ActiveQuestion[] = [
  {
    q: 'First, what is the mitochondrion’s main job?',
    hint: 'Think about what the cell needs to spend on everything it does.',
    ideal: 'It converts energy from food (glucose) into ATP through cellular respiration.',
  },
  {
    q: 'Good. Why does oxygen matter at the end of the electron transport chain?',
    hint: 'What happens to the electrons once they reach the end of the line?',
    ideal: 'Oxygen accepts the electrons at the end of the chain (forming water), so the chain keeps flowing and ATP synthase keeps making ATP.',
  },
  {
    q: 'Explain ATP synthase like a football play: what is the ball, and what makes the team score?',
    hint: 'Protons flowing through the “turbine” are the key.',
    ideal: 'Protons rushing back through ATP synthase spin it like a turbine; that motion bonds ADP + P into ATP.',
  },
];

const cards: FlashCard[] = [
  { q: 'Why is oxygen essential at the end of the electron transport chain?', a: 'It is the final electron acceptor, forming water so the chain keeps running.' },
  { q: 'Where does glycolysis happen?', a: 'In the cytoplasm — it yields 2 net ATP and 2 NADH.' },
  { q: 'What powers ATP synthase?', a: 'The proton (H⁺) gradient across the inner mitochondrial membrane.' },
  { q: 'What is substrate-level phosphorylation?', a: 'Direct ATP formation during glycolysis and the Krebs cycle, without the ETC.' },
  { q: 'Where does the Krebs cycle take place?', a: 'In the mitochondrial matrix.' },
];

export const DEMO = {
  analysis,
  questions,
  cards,
  goodFeedback: 'Yes! That’s exactly the idea — you explained it in your own words. 🌱',
  tryFeedback: 'Close! Try adding the “why” — what would break if that step didn’t happen?',
  chat: [
    'Hey! What should we explore today? 🌿',
    'Great question. Think of it like a relay race — the energy gets passed along step by step.',
    'Want me to turn that into a quick 2-minute recall so it sticks?',
    'Nice! Your tree grows every time you explain things in your own words.',
  ],
  recallExample:
    'We started with glucose breaking into pyruvate in the cytoplasm, which yields 2 ATP and NADH. Then pyruvate enters the mitochondrial matrix for CoA formation, driving the Krebs cycle... and oxygen directly produces the ATP energy.',
};
