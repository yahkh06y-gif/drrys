// Demo session used when no Claude API key is configured. Content mirrors the Figma prototype.
import type { ActiveQuestion, Analysis, FlashCard, GroupCheck } from './ai';

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
      why: 'A classic exam question: “where is ATP made without oxygen?”',
      page: 'p.5',
    },
    {
      title: 'ATP Synthase Rotor Mechanism',
      detail: 'The proton gradient powers the physical turbine rotation across the inner membrane, mechanically generating ATP units.',
      tag: 'Missed',
      why: 'It links the proton gradient to actual ATP, which is the point of the whole chain.',
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
    kind: 'conceptual',
    q: 'First, what is the mitochondrion’s main job?',
    hint: 'Think about what the cell needs to spend on everything it does.',
    ideal: 'It converts energy from food (glucose) into ATP through cellular respiration.',
  },
  {
    kind: 'procedural',
    format: 'order',
    q: 'Put the stages of cellular respiration in the order they happen.',
    hint: 'Follow the glucose: where does it start, and where do the electrons end up?',
    ideal: 'Glucose is split in the cytoplasm first, then the products are processed in the mitochondrion, and the electron transport chain comes last because it needs their electrons.',
    steps: ['Glycolysis (cytoplasm)', 'Pyruvate oxidation', 'Krebs cycle (matrix)', 'Electron transport chain'],
  },
  {
    kind: 'conceptual',
    format: 'match',
    q: 'Connect each structure to what it does.',
    hint: 'Think location first, then function.',
    ideal: 'Each structure has one job in the chain, from splitting glucose to turning the proton flow into ATP.',
    pairs: [
      { left: 'Cytoplasm', right: 'Glycolysis' },
      { left: 'Matrix', right: 'Krebs cycle' },
      { left: 'Inner membrane', right: 'Electron transport chain' },
      { left: 'ATP synthase', right: 'Makes ATP from the proton flow' },
    ],
  },
  {
    kind: 'evidence',
    format: 'sort',
    q: 'Sort these into “makes ATP directly” and “makes ATP through the proton gradient”.',
    hint: 'Ask: is a proton gradient involved at all?',
    ideal: 'Substrate-level phosphorylation moves a phosphate straight onto ADP; the chain instead builds a gradient that ATP synthase spends.',
    buckets: [
      { name: 'Directly', items: ['Glycolysis', 'Krebs cycle step'] },
      { name: 'Via proton gradient', items: ['ATP synthase', 'Electron transport chain'] },
    ],
  },
  {
    kind: 'procedural',
    format: 'work',
    q: 'One glucose gives 2 ATP in glycolysis, 2 in the Krebs cycle and about 26 from the chain. How much ATP is that for 3 glucose molecules? Show your working.',
    hint: 'Add up one glucose first, then multiply.',
    ideal: 'One glucose: 2 + 2 + 26 = 30 ATP. Three glucose: 3 × 30 = 90 ATP.',
  },
  {
    kind: 'analogous',
    q: 'Explain ATP synthase like a turbine. Where does the comparison fit, and where does it break?',
    hint: 'Protons flowing through the “turbine” are the key.',
    ideal: 'Protons rushing back through ATP synthase spin it like a turbine, and that motion bonds ADP + P into ATP. It breaks because the “water” is a charge gradient made by the cell itself, not a natural flow.',
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
  hooks: [
    'O₂ is the “last seat on the bus”: if nobody takes it, the bus can’t move.',
    'Oxygen = Operation Clean-up: it takes the leftover electrons away so the line keeps moving.',
    'Final Acceptor = F.A. → “Fresh Air” keeps the chain breathing.',
  ],
  groupCheck: (names: string[]): GroupCheck => ({
    groups: names.map((name) => ({ name, ok: true, note: 'Nice — these ideas really do belong together.' })),
    overall: 'You found the connections yourself, and that is what makes them stick.',
  }),
  levelUp: (c: { q: string; a: string }): FlashCard => ({
    q: `A friend says they understand this but can’t use it. Give one new example that shows it in action: ${c.q}`,
    a: `Any new example that applies the same idea, built on: ${c.a}`,
  }),
  goodFeedback: 'Yes! That’s exactly the idea — you explained it in your own words.',
  tryFeedback: 'Close! Try adding the “why” — what would break if that step didn’t happen?',
  chat: [
    'Hey! What should we explore today?',
    'Great question. Think of it like a relay race — the energy gets passed along step by step.',
    'Want me to turn that into a quick 2-minute recall so it sticks?',
    'Nice! Your tree grows every time you explain things in your own words.',
  ],
  recallExample:
    'We started with glucose breaking into pyruvate in the cytoplasm, which yields 2 ATP and NADH. Then pyruvate enters the mitochondrial matrix for CoA formation, driving the Krebs cycle... and oxygen directly produces the ATP energy.',
};
