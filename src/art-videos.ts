// Blender video renders (H.264). Each is a full-screen 9:16 shot from the fixed camera.
// The planting clips (plant*) are 1080×1920; each one starts on the last frame of the one before it.
export const VIDEOS = {
  splash: require('../assets/videos/splash.mp4'), // Coco peeks, teal hill rises (1.2s)
  intro1: require('../assets/videos/intro-1.mp4'), // loop: tree
  intro2: require('../assets/videos/intro-2.mp4'), // loop: Coco + gadgets
  intro3: require('../assets/videos/intro-3.mp4'), // loop: Coco reading
  hello: require('../assets/videos/hello.mp4'), // loop: Coco waves
  plantLoop: require('../assets/videos/plant-loop.mp4'), // loop: the seed waits in the field (behind "Plant now")
  plantOpen: require('../assets/videos/plant-open.mp4'), // once: the seed opens → cream (the subject form)
  plantClose: require('../assets/videos/plant-close.mp4'), // once: cream → the seed closes, back in the field
  plantTree: require('../assets/videos/plant-tree.mp4'), // once: the seed grows into a tree
  celebrate: require('../assets/videos/celebrate.mp4'), // once: Coco in sunglasses + confetti (sound)
  chestIdle: require('../assets/videos/chest-idle.mp4'), // loop: the closed chest wobbles, before it is opened (quiet sound)
} as const;

export type VideoKey = keyof typeof VIDEOS;

// Clips that carry their own sound design (the rest are silent).
export const VIDEO_SOUND: Partial<Record<VideoKey, true>> = {
  plantLoop: true,
  plantOpen: true,
  plantClose: true,
  plantTree: true,
  celebrate: true,
  chestIdle: true,
};

// Clips that should play quieter than the default level (0–1).
export const VIDEO_VOLUME_OF: Partial<Record<VideoKey, number>> = { chestIdle: 0.15 };

// The flat colour the chest page uses behind the chest clip (the clip's own backdrop is exactly this).
export const CHEST_BG = '#17594F';

// Edge colours sampled from the renders so UI around/over them blends in.
export const VIDEO_BG: Record<VideoKey, string> = {
  splash: '#2F8476',
  intro1: '#BBE0EF',
  intro2: '#327B78',
  intro3: '#78993B',
  hello: '#F2EEE4',
  plantLoop: '#799B2C', // the grass
  plantOpen: '#799B2C',
  plantClose: '#F1F1E7', // first frame is the cream page
  plantTree: '#7E9F32',
  celebrate: '#F2EADA',
  chestIdle: '#17594F',
};

// Clip lengths (ms) — used as a safety net so one-shot clips always advance, even if playback fails.
export const VIDEO_MS: Record<VideoKey, number> = {
  splash: 1200,
  intro1: 10000,
  intro2: 10000,
  intro3: 10000,
  hello: 8000,
  plantLoop: 5970,
  plantOpen: 3920,
  plantClose: 3950,
  plantTree: 3920,
  celebrate: 8000,
  chestIdle: 4000,
};
