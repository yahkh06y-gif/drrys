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
  trunk: require('../assets/art/tree/trunk.png'),
  branches: [
    require('../assets/art/tree/branch-1.png'),
    require('../assets/art/tree/branch-2.png'),
    require('../assets/art/tree/branch-3.png'),
    require('../assets/art/tree/branch-4.png'),
    require('../assets/art/tree/branch-5.png'),
  ],
  clouds: [
    require('../assets/art/tree/cloud-1.png'),
    require('../assets/art/tree/cloud-2.png'),
    require('../assets/art/tree/cloud-3.png'),
  ],
};

// Blender canvas is 2160×3840 (9:16), fixed camera. Values are fractions of that canvas,
// measured from each branch render's alpha bounds. x = canopy centre, top = canopy top,
// (jx, jy) = where the canopy meets its arm — the canopy grows out of that point.
// Chapter N grows branch-N.
export const BRANCH_ANCHORS = [
  { x: 0.299, top: 0.455, jx: 0.348, jy: 0.529, l: 0.217, r: 0.381, cy: 0.501, side: 'left' },
  { x: 0.297, top: 0.332, jx: 0.354, jy: 0.417, l: 0.201, r: 0.392, cy: 0.385, side: 'left' },
  { x: 0.496, top: 0.258, jx: 0.496, jy: 0.385, l: 0.383, r: 0.612, cy: 0.321, side: 'top' },
  { x: 0.703, top: 0.333, jx: 0.648, jy: 0.416, l: 0.611, r: 0.797, cy: 0.386, side: 'right' },
  { x: 0.72, top: 0.467, jx: 0.673, jy: 0.536, l: 0.642, r: 0.798, cy: 0.51, side: 'right' },
] as const;
export const TREE_ASPECT = 9 / 16;

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
