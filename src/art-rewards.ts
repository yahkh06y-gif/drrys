// Pictures for the end-of-session reward. Drop your own images into assets/art/rewards/ and point to them
// here (e.g. chestClosed: require('../assets/art/rewards/chest-closed.png')); while a slot is empty the app
// shows an emoji instead, so nothing breaks.
import type { ImageSource } from 'expo-image';

export const REWARD_ART: { chestClosed?: ImageSource; chestOpen?: ImageSource } = {
  chestClosed: undefined,
  chestOpen: undefined,
};
