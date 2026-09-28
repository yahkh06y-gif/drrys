// Blender video renders (720×1280, H.264, silent). Each is a full-screen 9:16 shot from the fixed camera.
export const VIDEOS = {
  splash: require('../assets/videos/splash.mp4'), // Coco peeks, teal hill rises (1.2s)
  introEnter: require('../assets/videos/intro-enter.mp4'), // zoom out into the first intro circle (1.45s)
  intro1: require('../assets/videos/intro-1.mp4'), // loop: tree
  intro2: require('../assets/videos/intro-2.mp4'), // loop: Coco + gadgets
  intro3: require('../assets/videos/intro-3.mp4'), // loop: Coco reading
  hello: require('../assets/videos/hello.mp4'), // loop: Coco waves
  plant: require('../assets/videos/plant.mp4'), // loop: Coco with shovel catches the seed
  seedOpen: require('../assets/videos/seed-open.mp4'), // once: hands open the glowing seed → cream
  seedClose: require('../assets/videos/seed-close.mp4'), // once: seed planted, tree grows (18s)
  celebrate: require('../assets/videos/celebrate.mp4'), // loop: Coco in sunglasses + confetti
} as const;

export type VideoKey = keyof typeof VIDEOS;

// Edge colours sampled from the renders so UI around/over them blends in.
export const VIDEO_BG: Record<VideoKey, string> = {
  splash: '#2F8476',
  introEnter: '#BEE6F2',
  intro1: '#BCE1F0',
  intro2: '#327B78',
  intro3: '#79993C',
  hello: '#F2EEE4',
  plant: '#C1DD85',
  seedOpen: '#F4EEE0',
  seedClose: '#F2EEE4',
  celebrate: '#F2EADA',
};

// Clip lengths (ms) — used as a safety net so one-shot clips always advance, even if playback fails.
export const VIDEO_MS: Record<VideoKey, number> = {
  splash: 1200,
  introEnter: 1450,
  intro1: 10000,
  intro2: 10000,
  intro3: 10000,
  hello: 8000,
  plant: 4340,
  seedOpen: 4020,
  seedClose: 18020,
  celebrate: 8000,
};
