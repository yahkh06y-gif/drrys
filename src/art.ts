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
  // the same meadow with no tree and no shadow — the spot where a new tree gets planted
  empty: require('../assets/art/tree/no-tree.jpg'),
  // landscape without a tree — shown while swiping between subject trees (coming next)
  between: require('../assets/art/tree/between.jpg'),
  clouds: [
    require('../assets/art/tree/cloud-1.png'),
    require('../assets/art/tree/cloud-2.png'),
    require('../assets/art/tree/cloud-3.png'),
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
      { x: 0.52, top: 0.338, jx: 0.521, jy: 0.466, l: 0.379, r: 0.661, cy: 0.417, side: 'top' },
    ],
  },
  2: {
    tree: require('../assets/art/tree/stage-2/tree.png'),
    branches: [
      require('../assets/art/tree/stage-2/branch-1.png'),
      require('../assets/art/tree/stage-2/branch-2.png'),
    ],
    anchors: [
      { x: 0.37, top: 0.398, jx: 0.385, jy: 0.483, l: 0.278, r: 0.462, cy: 0.45, side: 'left' },
      { x: 0.597, top: 0.342, jx: 0.597, jy: 0.451, l: 0.481, r: 0.714, cy: 0.407, side: 'right' },
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
      { x: 0.288, top: 0.405, jx: 0.332, jy: 0.478, l: 0.197, r: 0.38, cy: 0.457, side: 'left' },
      { x: 0.49, top: 0.303, jx: 0.491, jy: 0.42, l: 0.374, r: 0.607, cy: 0.368, side: 'top' },
      { x: 0.658, top: 0.429, jx: 0.64, jy: 0.495, l: 0.579, r: 0.737, cy: 0.474, side: 'right' },
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
      { x: 0.286, top: 0.448, jx: 0.32, jy: 0.51, l: 0.202, r: 0.37, cy: 0.495, side: 'left' },
      { x: 0.284, top: 0.321, jx: 0.325, jy: 0.411, l: 0.187, r: 0.381, cy: 0.375, side: 'left' },
      { x: 0.49, top: 0.245, jx: 0.491, jy: 0.357, l: 0.374, r: 0.607, cy: 0.31, side: 'top' },
      { x: 0.699, top: 0.369, jx: 0.669, jy: 0.459, l: 0.604, r: 0.794, cy: 0.423, side: 'right' },
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
      { x: 0.299, top: 0.455, jx: 0.348, jy: 0.529, l: 0.217, r: 0.381, cy: 0.501, side: 'left' },
      { x: 0.297, top: 0.332, jx: 0.354, jy: 0.417, l: 0.201, r: 0.392, cy: 0.385, side: 'left' },
      { x: 0.496, top: 0.258, jx: 0.496, jy: 0.385, l: 0.383, r: 0.612, cy: 0.321, side: 'top' },
      { x: 0.703, top: 0.333, jx: 0.648, jy: 0.416, l: 0.611, r: 0.797, cy: 0.386, side: 'right' },
      { x: 0.72, top: 0.467, jx: 0.673, jy: 0.536, l: 0.642, r: 0.798, cy: 0.51, side: 'right' },
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
    { src: require('../assets/art/coco/tree-v2-fall-1.webp'), box: COCO_BOX, ms: 2400, weight: 70 },
    { src: require('../assets/art/coco/tree-v2-fall-2.webp'), box: COCO_BOX, ms: 2500, weight: 30 },
  ] as CocoClip[],
  fallHard: { src: require('../assets/art/coco/tree-v2-fall-hard.webp'), box: COCO_BOX, ms: 2566 } as CocoClip,
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
