// Pictures for the end-of-session reward pages. Drop your own images into assets/art/rewards/ and point to
// them here (e.g. chestClosed: require('../assets/art/rewards/chest-closed.png')); while a slot is empty the
// app shows a simple icon instead, so nothing breaks.
import type { ImageSource } from 'expo-image';

export const REWARD_ART: { chestClosed?: ImageSource; chestOpen?: ImageSource; streak?: ImageSource; branch?: ImageSource } = {
  chestClosed: undefined, // gift page, before opening
  chestOpen: undefined, // gift page, after opening
  streak: undefined, // streak page, the big picture on top
  branch: undefined, // streak page, next to the growth bar
};
