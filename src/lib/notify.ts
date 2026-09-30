// Daily "water your tree" reminder from Coco.
// Instead of one fixed daily notification, the next 7 days are planned from the student's own data:
//  - lecture day → "Full session on Biology today"; other days → "6 flashcards are waiting"
//  - a streak on the line gets mentioned; a day that's already done gets no reminder at all
// The plan is rebuilt whenever the app opens or the student finishes something.
// expo-notifications crashes on import inside Expo Go on Android (SDK 53+), so the module is loaded
// lazily and skipped there. In a development/production build (the APK) it works normally.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { AppState, Platform } from 'react-native';

import { isDue, streak, today, useApp } from '@/store';

type N = typeof import('expo-notifications');

const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const remindersSupported = Platform.OS !== 'web' && !(inExpoGo && Platform.OS === 'android');

export const REMINDER_HOURS = [8, 13, 17, 19, 21];
export const DEFAULT_HOUR = 19;
export const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;

let mod: N | null = null;
function load(): N | null {
  if (!remindersSupported) return null;
  if (!mod) {
    mod = require('expo-notifications') as N;
    mod.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
  }
  return mod;
}

/** Ask for permission and switch reminders on. Returns whether they're on. */
export async function enableReminders(): Promise<boolean> {
  const Notifications = load();
  if (!Notifications) return false;
  try {
    // Android 13+: the channel must exist BEFORE asking, or the permission prompt never shows
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('daily', { name: 'Daily reminder', importance: Notifications.AndroidImportance.HIGH });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return false;
    useApp.getState().setProfile({ reminders: true });
    await syncReminders();
    return true;
  } catch {
    return false;
  }
}

export async function disableReminders() {
  const Notifications = load();
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}

/** What Coco says on a given day (undefined = nothing to say). */
function lineFor(day: Date) {
  const s = useApp.getState();
  const key = today(day);
  const isToday = key === today();
  const lecture = s.subjects.filter((x) => x.days.includes(day.getDay()) && x.doneOn !== key);
  // studied today and no lecture session still waiting: nothing to remind
  if (isToday && !lecture.length && s.stats.studyDays.includes(key)) return undefined;
  const due = s.cards.filter((c) => isDue(c, day.getTime())).length;
  const run = isToday ? streak(s.stats.studyDays) : 0;

  let title = 'Coco 🌱';
  let body: string;
  if (lecture.length) {
    title = 'Coco 📖';
    const names = lecture.map((x) => x.name).slice(0, 2).join(' & ');
    body = `Lecture day! A full session on ${names} keeps it fresh. About 15 minutes.`;
  } else if (due > 0) {
    title = 'Coco 💧';
    body = `${due} ${due === 1 ? 'flashcard is' : 'flashcards are'} waiting for you. About ${Math.max(2, Math.ceil(due / 2))} minutes.`;
  } else if (s.subjects.length) {
    body = 'Your tree misses you. Say hi and study ahead a little?';
  } else {
    body = 'Plant your first tree: pick a subject and grow what you know.';
  }
  if (run >= 2) {
    title = `🔥 ${run}-day streak`;
    body = `Don’t let it break! ${body}`;
  }
  return { title, body };
}

let syncing: Promise<void> | undefined;
/** Rebuild the next 7 days of reminders from the student's data. */
export function syncReminders(): Promise<void> {
  const Notifications = load();
  const s = useApp.getState();
  if (!Notifications || !s.profile.reminders) return Promise.resolve();
  const run = async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      const hour = s.profile.reminderHour ?? DEFAULT_HOUR;
      const now = Date.now();
      for (let k = 0; k < 7; k++) {
        const d = new Date();
        d.setDate(d.getDate() + k);
        d.setHours(hour, 0, 0, 0);
        if (d.getTime() <= now + 60_000) continue;
        const line = lineFor(d);
        if (!line) continue;
        await Notifications.scheduleNotificationAsync({
          content: line,
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: d, channelId: 'daily' },
        });
      }
    } catch {
      // try again on the next change
    }
  };
  syncing = (syncing ?? Promise.resolve()).then(run);
  return syncing;
}

let started = false;
/** Keep the plan up to date: on app open, when returning to the app, and after studying. */
export function startReminderSync() {
  if (started || !remindersSupported) return;
  started = true;
  syncReminders();
  AppState.addEventListener('change', (a) => a === 'active' && syncReminders());
  let last = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  useApp.subscribe((s) => {
    const key = JSON.stringify([s.profile.reminders, s.profile.reminderHour, s.stats.studyDays.length, s.subjects.map((x) => [x.name, x.days, x.doneOn]), s.cards.length]);
    if (key === last) return;
    last = key;
    clearTimeout(timer);
    timer = setTimeout(syncReminders, 2000);
  });
}
