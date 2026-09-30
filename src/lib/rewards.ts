// The numbers behind studying together (no imports from cloud/purchases, so there are no require cycles).
import { useApp } from '@/store';

export const SQUAD_SIZE = 4;
export const SQUAD_OFF = 25; // % off Pro for everyone in a full squad
export const MAX_OFF = 50; // streak reward + squad never go past this
export const FRIEND_BRANCHES = 1; // extra branches a free student earns by inviting (max)

// Where friends get Drrys (shared with every code). Swap for the Google Play link once the app is listed.
export const APP_LINK = 'https://github.com/yahkh06y-gif/drrys/releases/latest';

export const squadReady = (t = useApp.getState().together) => (t?.squad?.members.length ?? 0) >= SQUAD_SIZE;
export const friendBranches = (t = useApp.getState().together) => Math.min(FRIEND_BRANCHES, t?.friends ?? 0);
