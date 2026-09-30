// Blender video renders (720×1280, H.264). Each is a full-screen 9:16 shot from the fixed camera.
export const VIDEOS = {
  splash: require('../assets/videos/splash.mp4'), // Coco peeks, teal hill rises (1.2s)
  intro1: require('../assets/videos/intro-1.mp4'), // loop: tree
  intro2: require('../assets/videos/intro-2.mp4'), // loop: Coco + gadgets
  intro3: require('../assets/videos/intro-3.mp4'), // loop: Coco reading
  hello: require('../assets/videos/hello.mp4'), // loop: Coco waves
  agriculture: require('../assets/videos/agriculture.mp4'), // loop: Coco the farmer waves his shovel (sound)
  fallSeed: require('../assets/videos/fall-seed.mp4'), // once: a seed falls and Coco catches it (sound)
  seedOpen: require('../assets/videos/seed-open.mp4'), // once: hands open the glowing seed → cream (sound)
  seedClose: require('../assets/videos/seed-close.mp4'), // once: seed planted, tree grows (10.7s, sound)
  celebrate: require('../assets/videos/celebrate.mp4'), // once: Coco in sunglasses + confetti (sound)
} as const;

export type VideoKey = keyof typeof VIDEOS;

// Clips that carry their own sound design (the rest are silent).
export const VIDEO_SOUND: Partial<Record<VideoKey, true>> = {
  agriculture: true,
  fallSeed: true,
  seedOpen: true,
  seedClose: true,
  celebrate: true,
};

// Edge colours sampled from the renders so UI around/over them blends in.
export const VIDEO_BG: Record<VideoKey, string> = {
  splash: '#2F8476',
  intro1: '#BBE0EF',
  intro2: '#327B78',
  intro3: '#78993B',
  hello: '#F2EEE4',
  agriculture: '#C1DD85',
  fallSeed: '#C1DD85',
  seedOpen: '#95BD65', // first frame is the green backdrop with the hands
  seedClose: '#F2EEE4',
  celebrate: '#F2EADA',
};

// Clip lengths (ms) — used as a safety net so one-shot clips always advance, even if playback fails.
export const VIDEO_MS: Record<VideoKey, number> = {
  splash: 1200,
  intro1: 10000,
  intro2: 10000,
  intro3: 10000,
  hello: 8000,
  agriculture: 6000,
  fallSeed: 4340,
  seedOpen: 4020,
  seedClose: 10750,
  celebrate: 8000,
};
