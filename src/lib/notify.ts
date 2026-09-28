// Daily "water your tree" reminder.
// expo-notifications crashes on import inside Expo Go on Android (SDK 53+), so the module is
// loaded lazily and skipped there. In a development/production build it works normally.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

type N = typeof import('expo-notifications');

const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const remindersSupported = Platform.OS !== 'web' && !(inExpoGo && Platform.OS === 'android');

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

const LINES = [
  { title: 'Coco 🌱', body: 'Your tree is thirsty! A 5-minute recall keeps it growing.' },
  { title: 'Coco 🔔', body: 'Quick 2-minute recall before tonight’s memory fades?' },
  { title: 'Coco 🍃', body: 'One idea at a time. Ready for today’s session?' },
];

export async function enableReminders(hour = 19, minute = 0): Promise<boolean> {
  const Notifications = load();
  if (!Notifications) return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return false;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('daily', { name: 'Daily reminder', importance: Notifications.AndroidImportance.DEFAULT });
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    const line = LINES[new Date().getDay() % LINES.length];
    await Notifications.scheduleNotificationAsync({
      content: line,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'daily' },
    });
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
