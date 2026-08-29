// Local notifications — a gentle daily reminder. Everything else works
// without notification permission; this is purely opt-in.

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useApp } from "./store";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const CHANNEL_ID = "momentum-reminders";

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true },
  });
  return asked.granted;
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Daily reminder",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180, 90, 180],
      lightColor: "#2dd4a8",
    });
  }
}

export async function scheduleDailyReminder(): Promise<boolean> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const { reminderEnabled, reminderHour, reminderMinute } = useApp.getState();
  if (!reminderEnabled) return false;
  const granted = await ensureNotificationPermission();
  if (!granted) return false;
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Momentum ✦",
      body: "Time to check in — knock out a task or keep a streak alive.",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: reminderHour,
      minute: reminderMinute,
      channelId: CHANNEL_ID,
    },
  });
  return true;
}

export async function sendTestNotification(): Promise<void> {
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Momentum ✦",
      body: "Notifications are working 🎉",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      channelId: CHANNEL_ID,
    },
  });
}
