// Every Blender render in one place. Swap files in /assets/art keeping the same names.
const coco = require('../assets/art/coco/classic.png');

// Poses that only exist as videos fall back to the classic standing render.
export const COCO = {
  classic: coco,
  stand: coco,
  hi: coco,
  pointer: coco,
  shovel: coco,
  sunglasses: coco,
  gadgets: coco,
  peek: coco,
  book: coco,
  reading: require('../assets/art/coco/reading.png'),
  bell: require('../assets/art/coco/bell.png'),
  scarf: require('../assets/art/coco/scarf.png'),
  birthday: require('../assets/art/coco/birthday.png'),
  ninja: require('../assets/art/coco/ninja.png'),
};

export const TREE = {
  sky: require('../assets/art/tree/sky-ground.jpg'),
  // the same meadow with no tree — the spot where a new tree gets planted
  empty: require('../assets/art/tree/no-tree.jpg'),
  // the meadow mirrored, so its edges meet the trees on both sides — shown while swiping between them
  between: require('../assets/art/tree/between.jpg'),
  // drifting clouds; box = where each one sits on the canvas, in 1080×1920 pixels
  clouds: [
    { src: require('../assets/art/tree/cloud-1.png'), box: [15, 287, 399, 228] as const },
    { src: require('../assets/art/tree/cloud-2.png'), box: [641, 145, 393, 215] as const },
    { src: require('../assets/art/tree/cloud-3.png'), box: [877, 653, 196, 118] as const },
    { src: require('../assets/art/tree/cloud-4.png'), box: [7, 906, 107, 80] as const },
  ],
};

export type BranchAnchor = {
  x: number; top: number; jx: number; jy: number; l: number; r: number; cy: number;
  side: 'left' | 'right' | 'top';
};
export type TreeStage = { tree: number; branches: number[]; anchors: BranchAnchor[] };

// One Blender tree per chapter count: stage-N/tree.png is a bare tree with N arms and
// stage-N/branch-k.png is the canopy of arm k (Blender files "N tree" / "N k green").
// All share the 2160×3840 (9:16) canvas and camera of sky-ground. Anchor values are fractions of
// that canvas, measured from each canopy's alpha: x = canopy centre, top/cy = top/middle,
// l/r = left/right edge, (jx, jy) = where the canopy meets its arm (it grows from there),
// side = where the chapter label sits.
export const TREE_STAGES: Record<1 | 2 | 3 | 4 | 5, TreeStage> = {
  1: {
    tree: require('../assets/art/tree/stage-1/tree.png'),
    branches: [
      require('../assets/art/tree/stage-1/branch-1.png'),
    ],
    anchors: [
      { x: 0.536, top: 0.317, jx: 0.536, jy: 0.465, l: 0.378, r: 0.694, cy: 0.409, side: 'top' },
    ],
  },
  2: {
    tree: require('../assets/art/tree/stage-2/tree.png'),
    branches: [
      require('../assets/art/tree/stage-2/branch-1.png'),
      require('../assets/art/tree/stage-2/branch-2.png'),
    ],
    anchors: [
      { x: 0.366, top: 0.383, jx: 0.384, jy: 0.48, l: 0.262, r: 0.47, cy: 0.443, side: 'left' },
      { x: 0.623, top: 0.321, jx: 0.622, jy: 0.445, l: 0.492, r: 0.754, cy: 0.397, side: 'right' },
    ],
  },
  3: {
    tree: require('../assets/art/tree/stage-3/tree.png'),
    branches: [
      require('../assets/art/tree/stage-3/branch-1.png'),
      require('../assets/art/tree/stage-3/branch-2.png'),
      require('../assets/art/tree/stage-3/branch-3.png'),
    ],
    anchors: [
      { x: 0.312, top: 0.425, jx: 0.352, jy: 0.494, l: 0.225, r: 0.399, cy: 0.475, side: 'left' },
      { x: 0.502, top: 0.327, jx: 0.503, jy: 0.438, l: 0.393, r: 0.612, cy: 0.39, side: 'top' },
      { x: 0.661, top: 0.443, jx: 0.643, jy: 0.511, l: 0.58, r: 0.743, cy: 0.49, side: 'right' },
    ],
  },
  4: {
    tree: require('../assets/art/tree/stage-4/tree.png'),
    branches: [
      require('../assets/art/tree/stage-4/branch-1.png'),
      require('../assets/art/tree/stage-4/branch-2.png'),
      require('../assets/art/tree/stage-4/branch-3.png'),
      require('../assets/art/tree/stage-4/branch-4.png'),
    ],
    anchors: [
      { x: 0.304, top: 0.467, jx: 0.337, jy: 0.528, l: 0.223, r: 0.385, cy: 0.513, side: 'left' },
      { x: 0.3, top: 0.341, jx: 0.343, jy: 0.434, l: 0.205, r: 0.394, cy: 0.396, side: 'left' },
      { x: 0.501, top: 0.263, jx: 0.502, jy: 0.381, l: 0.388, r: 0.615, cy: 0.33, side: 'top' },
      { x: 0.703, top: 0.391, jx: 0.675, jy: 0.478, l: 0.611, r: 0.795, cy: 0.443, side: 'right' },
    ],
  },
  5: {
    tree: require('../assets/art/tree/stage-5/tree.png'),
    branches: [
      require('../assets/art/tree/stage-5/branch-1.png'),
      require('../assets/art/tree/stage-5/branch-2.png'),
      require('../assets/art/tree/stage-5/branch-3.png'),
      require('../assets/art/tree/stage-5/branch-4.png'),
      require('../assets/art/tree/stage-5/branch-5.png'),
    ],
    anchors: [
      { x: 0.294, top: 0.472, jx: 0.329, jy: 0.536, l: 0.208, r: 0.381, cy: 0.52, side: 'left' },
      { x: 0.293, top: 0.344, jx: 0.332, jy: 0.435, l: 0.194, r: 0.392, cy: 0.401, side: 'left' },
      { x: 0.501, top: 0.263, jx: 0.503, jy: 0.38, l: 0.388, r: 0.615, cy: 0.33, side: 'top' },
      { x: 0.72, top: 0.341, jx: 0.693, jy: 0.439, l: 0.622, r: 0.818, cy: 0.398, side: 'right' },
      { x: 0.736, top: 0.484, jx: 0.701, jy: 0.554, l: 0.655, r: 0.818, cy: 0.53, side: 'right' },
    ],
  },
};
// Coco on the lawn next to the tree: animated WebPs with transparency, cut from Blender renders on the same
// 2160×3840 camera. Each clip's box = where its crop sits on that canvas, in 1080×1920 pixels.
// Every clip starts/ends in the same standing pose, so they chain seamlessly.
//   fall / fallHard: Coco drops in when you arrive at a tree: a random normal fall, or the hard fall
//   when you're flipping through the trees fast.
//   idle: plays after landing, then a new random one; calm 1 and 1.1 most often, lively 4 least
// Set COCO_ON_TREE to false to take him off the tree.
export const COCO_ON_TREE = true;
export type CocoClip = { src: number; box: [number, number, number, number]; ms: number; weight?: number };
const COCO_BOX: CocoClip['box'] = [637, 1050, 233, 338]; // the same crop for every clip, so he never shifts
export const COCO_TREE = {
  fall: [
    { src: require('../assets/art/coco/tree-v2-fall-1.webp'), box: COCO_BOX, ms: 1633, weight: 70 },
    { src: require('../assets/art/coco/tree-v2-fall-2.webp'), box: COCO_BOX, ms: 1666, weight: 30 },
  ] as CocoClip[],
  fallHard: { src: require('../assets/art/coco/tree-v2-fall-hard.webp'), box: COCO_BOX, ms: 1733 } as CocoClip,
  // after a full session: Coco waters the tree, puts the can away and settles into the idle pose
  water: { src: require('../assets/art/coco/tree-water.webp'), box: [590, 1220, 370, 200], ms: 4000 } as CocoClip,
  idle: [
    { src: require('../assets/art/coco/tree-v2-idle-1.webp'), box: COCO_BOX, ms: 9499, weight: 30 },
    { src: require('../assets/art/coco/tree-v2-idle-1-1.webp'), box: COCO_BOX, ms: 9332, weight: 30 },
    { src: require('../assets/art/coco/tree-v2-idle-2.webp'), box: COCO_BOX, ms: 9766, weight: 20 },
    { src: require('../assets/art/coco/tree-v2-idle-3.webp'), box: COCO_BOX, ms: 9932, weight: 12 },
    { src: require('../assets/art/coco/tree-v2-idle-4.webp'), box: COCO_BOX, ms: 9399, weight: 8 },
  ] as CocoClip[],
};

export const TREE_MAX_BRANCHES = 5;
export const TREE_ASPECT = 9 / 16;
// the meadow is taller than the tree canvas: same top, more lawn below, so it reaches the tab bar on any phone
export const SCENE_ASPECT = 2160 / 4600;

// Clay icons for onboarding answers, keyed "<question>:<option label>". Any option without an icon
// simply shows its label; add more here as the renders arrive (interest:…, goal:…).
export const OPTION_ICONS: Record<string, number> = {
  'field:IT': require('../assets/art/onboarding/icons/field-it.png'),
  'field:Science': require('../assets/art/onboarding/icons/field-science.png'),
  'field:Business': require('../assets/art/onboarding/icons/field-business.png'),
  'field:Medicine': require('../assets/art/onboarding/icons/field-medicine.png'),
  'field:Art': require('../assets/art/onboarding/icons/field-art.png'),
  'field:Engineering': require('../assets/art/onboarding/icons/field-engineering.png'),
  'field:Law': require('../assets/art/onboarding/icons/field-law.png'),
  'field:Other': require('../assets/art/onboarding/icons/field-other.png'),
  'goal:Prepare for an exam': require('../assets/art/onboarding/icons/goal-exam.png'),
  'goal:Study during semester': require('../assets/art/onboarding/icons/goal-semester.png'),
  'goal:Keep knowledge for long': require('../assets/art/onboarding/icons/goal-longterm.png'),
  'goal:Learn a skill / certificate': require('../assets/art/onboarding/icons/goal-skill.png'),
  'goal:I am not sure yet': require('../assets/art/onboarding/icons/goal-unsure.png'),
  'interests:Gaming': require('../assets/art/onboarding/icons/interest-gaming.png'),
  'interests:Football': require('../assets/art/onboarding/icons/interest-football.png'),
  'interests:Cars': require('../assets/art/onboarding/icons/interest-cars.png'),
  'interests:UFC': require('../assets/art/onboarding/icons/interest-ufc.png'),
  'interests:Tech': require('../assets/art/onboarding/icons/interest-tech.png'),
  'interests:Basketball': require('../assets/art/onboarding/icons/interest-basketball.png'),
  'interests:Music': require('../assets/art/onboarding/icons/interest-music.png'),
  'interests:Anime': require('../assets/art/onboarding/icons/interest-anime.png'),
};

// Clay icons (Blender) for the subject-insight cards under the tree.
export const STAT_ICONS = {
  fire: require('../assets/art/stats/fire.png'),
  cards: require('../assets/art/stats/cards.png'),
  target: require('../assets/art/stats/target.png'),
  clock: require('../assets/art/stats/clock.png'),
  water: require('../assets/art/stats/water.png'), // flashcard day (watering)
  book: require('../assets/art/stats/book.png'), // lecture day (full session)
};

// Wide hero renders (with their own backdrop) used on the recall-review cards.
export const HERO = {
  celebrate: require('../assets/art/hero/celebrate.jpg'),
  magnifier: require('../assets/art/hero/magnifier.jpg'),
  trash: require('../assets/art/hero/trash.jpg'),
};

export const ONBOARD = {
  tree: require('../assets/art/onboarding/tree.png'),
};

export const ICONS = {
  coco: require('../assets/art/icons/tab-coco.png'),
  tree: require('../assets/art/icons/tab-tree.png'),
  profile: require('../assets/art/icons/tab-profile.png'),
};
