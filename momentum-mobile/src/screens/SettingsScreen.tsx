// Settings — account (Google sign-in / sync), appearance, notifications
// (daily check-in + automatic data reminders), backups, developer contact.

import React, { useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import DateTimePicker from "@react-native-community/datetimepicker";

import { exportJSON, importJSON } from "../db";
import { useApp, bumpData, DEFAULT_SERVER_URL } from "../store";
import { signInWithGoogle, signOut } from "../auth";
import { syncNow } from "../sync";
import { toast } from "../toast";
import {
  Btn,
  Card,
  Chip,
  Input,
  OfflinePill,
  SectionHeading,
  StackHeader,
  Toggle,
  UserAvatar,
  usePalette,
} from "../components/ui";
import type { ThemeMode } from "../theme";
import {
  scheduleDailyReminder,
  sendTestNotification,
  ensureNotificationPermission,
  syncDataReminders,
  countDataReminders,
} from "../notifications";

const DEVELOPER = {
  name: "Ayman Chowdhury",
  email: "aaymanchowdhury@gmail.com",
  github: "github.com/ado1d",
  githubUrl: "https://github.com/ado1d",
  photo: require("../../assets/developer.jpg"),
};

export default function SettingsScreen() {
  const { palette } = usePalette();
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const [serverDraft, setServerDraft] = useState<string | null>(null);
  const [showReminderTime, setShowReminderTime] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [reminderCount, setReminderCount] = useState(() => countDataReminders());

  const doSignIn = async () => {
    setBusy(true);
    const res = await signInWithGoogle();
    setBusy(false);
    setLastMessage(res.message);
    if (res.ok) {
      const syncRes = await syncNow(true);
      setLastMessage(syncRes.message);
      app.refreshPending();
    }
  };

  const doSync = async () => {
    const res = await syncNow(true);
    setLastMessage(res.message);
    app.refreshPending();
  };

  const doExport = async () => {
    try {
      const json = exportJSON();
      const name = `momentum-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const path = `${FileSystem.cacheDirectory}${name}`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: "application/json", dialogTitle: "Export Momentum data" });
      } else {
        Alert.alert("Export ready", `Saved to ${path}`);
      }
    } catch {
      Alert.alert("Export failed", "Something went wrong writing the backup.");
    }
  };

  const doImport = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: "application/json" });
      if (picked.canceled || picked.assets.length === 0) return;
      const asset = picked.assets[0];
      const content = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const res = importJSON(content);
      Alert.alert(res.ok ? "Import complete" : "Import failed", res.message);
      if (res.ok) {
        bumpData();
        void syncNow(false);
      }
    } catch {
      Alert.alert("Import failed", "Could not read that file.");
    }
  };

  const toggleAutoReminders = async (v: boolean) => {
    if (v) {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        Alert.alert("Permission needed", "Allow notifications for Momentum in system settings first.");
        return;
      }
    }
    app.setAutoReminders(v);
    const summary = await syncDataReminders();
    setReminderCount(countDataReminders());
    if (v) {
      toast.success(
        summary.scheduled > 0
          ? `${summary.scheduled} reminder${summary.scheduled === 1 ? "" : "s"} scheduled`
          : "Auto reminders on — add times to routine blocks & tasks",
      );
    } else {
      toast.info("Automatic reminders turned off");
    }
  };

  const reminderDate = new Date();
  reminderDate.setHours(app.reminderHour, app.reminderMinute, 0, 0);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <StackHeader title="Settings" subtitle="Make Momentum yours" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
      <OfflinePill />

      {/* Account */}
      <SectionHeading title="Account" />
      <Card>
        {app.auth ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <UserAvatar uri={app.auth.image} name={app.auth.name} email={app.auth.email} size={52} />
              <View style={{ flex: 1, marginLeft: 13 }}>
                <Text style={{ fontSize: 15.5, fontWeight: "700", color: palette.text }} numberOfLines={1}>
                  {app.auth.name ?? "Signed in"}
                </Text>
                <Text style={{ fontSize: 12.5, color: palette.textDim, marginTop: 1 }} numberOfLines={1}>
                  {app.auth.email}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <Btn label="Sign out" variant="ghost" icon="log-out-outline" small onPress={() => { signOut(); setLastMessage("Signed out — data stays on this device"); }} style={{ flex: 1 }} />
              <Btn label="Sync now" icon="cloud-upload-outline" small onPress={doSync} disabled={app.syncing} style={{ flex: 1 }} />
            </View>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 14, color: palette.text, fontWeight: "600" }}>Work locally, sync anywhere</Text>
            <Text style={{ fontSize: 12.5, color: palette.textDim, marginTop: 4, lineHeight: 18 }}>
              Everything works offline. Sign in with Google to sync your tasks, habits, notes and diary
              with the Momentum web app — they stay in sync both ways.
            </Text>
            <View style={{ marginTop: 14 }}>
              <Btn
                label={busy ? "Opening Google…" : "Continue with Google"}
                icon="logo-google"
                onPress={doSignIn}
                disabled={busy}
              />
            </View>
          </>
        )}

        {app.auth ? (
          <View style={{ marginTop: 12 }}>
            <SyncStatusRow />
          </View>
        ) : null}
        {lastMessage ? (
          <Text style={{ fontSize: 12, color: palette.primary, marginTop: 10 }}>{lastMessage}</Text>
        ) : null}
      </Card>

      {/* Appearance */}
      <SectionHeading title="Appearance" />
      <Card>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {(["system", "light", "dark"] as ThemeMode[]).map((m) => (
            <Chip
              key={m}
              label={m === "system" ? "Auto" : m === "light" ? "☀️ Light" : "🌙 Dark"}
              active={app.theme === m}
              onPress={() => app.setTheme(m)}
            />
          ))}
        </View>
      </Card>

      {/* Notifications */}
      <SectionHeading title="Notifications" />
      <Card>
        {/* Automatic data reminders */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontSize: 14.5, fontWeight: "600", color: palette.text }}>Automatic reminders</Text>
            <Text style={{ fontSize: 12, color: palette.textDim, marginTop: 2, lineHeight: 17 }}>
              Routine blocks remind you at their time, habits at their reminder time, tasks at their set reminder.
            </Text>
            {app.autoReminders ? (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 7 }}>
                <Ionicons name="notifications" size={12} color={palette.primary} />
                <Text style={{ fontSize: 11.5, fontWeight: "700", color: palette.primary, marginLeft: 4 }}>
                  {reminderCount.scheduled > 0
                    ? `${reminderCount.scheduled} scheduled · ${reminderCount.routine} routine · ${reminderCount.habits} habits · ${reminderCount.tasks} tasks`
                    : "None yet — add a time to a routine block or habit"}
                </Text>
              </View>
            ) : null}
          </View>
          <Toggle value={app.autoReminders} onChange={(v) => void toggleAutoReminders(v)} />
        </View>

        <View style={{ height: 1, backgroundColor: palette.border, marginVertical: 14 }} />

        {/* Daily check-in */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontSize: 14.5, fontWeight: "600", color: palette.text }}>Daily check-in</Text>
            <Text style={{ fontSize: 12, color: palette.textDim, marginTop: 2 }}>
              {app.reminderEnabled
                ? `Every day at ${String(app.reminderHour).padStart(2, "0")}:${String(app.reminderMinute).padStart(2, "0")}`
                : "A gentle nudge at a set time"}
            </Text>
          </View>
          <Toggle
            value={app.reminderEnabled}
            onChange={async (v) => {
              if (v) {
                const granted = await ensureNotificationPermission();
                if (!granted) {
                  Alert.alert("Permission needed", "Allow notifications for Momentum in system settings first.");
                  return;
                }
              }
              app.setReminder(v);
              await scheduleDailyReminder();
            }}
          />
        </View>
        {app.reminderEnabled ? (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <Btn
              label="Change time"
              variant="ghost"
              small
              icon="time-outline"
              onPress={() => setShowReminderTime(true)}
              style={{ flex: 1 }}
            />
            <Btn label="Test" variant="ghost" small icon="notifications-outline" onPress={() => void sendTestNotification()} style={{ flex: 1 }} />
          </View>
        ) : null}
        {showReminderTime ? (
          <DateTimePicker
            value={reminderDate}
            mode="time"
            display="default"
            is24Hour={false}
            onChange={async (_e, d) => {
              setShowReminderTime(false);
              if (d) {
                app.setReminder(true, d.getHours(), d.getMinutes());
                await scheduleDailyReminder();
              }
            }}
          />
        ) : null}
      </Card>

      {/* Data */}
      <SectionHeading title="Your data" />
      <Card>
        <Text style={{ fontSize: 12.5, color: palette.textDim, lineHeight: 18, marginBottom: 12 }}>
          Your data lives in this device's local database — it works with zero network. Export a JSON
          backup any time, or import one to restore.
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Btn label="Export backup" variant="ghost" small icon="download-outline" onPress={doExport} style={{ flex: 1 }} />
          <Btn label="Import" variant="ghost" small icon="cloud-upload-outline" onPress={doImport} style={{ flex: 1 }} />
        </View>
      </Card>

      {/* Server (advanced) */}
      <SectionHeading title="Server" />
      <Card>
        <Text style={{ fontSize: 12.5, color: palette.textDim, marginBottom: 10 }}>
          The backend used for Google sign-in and sync. Point it at your own deployment if you forked
          the web app.
        </Text>
        <Input
          value={serverDraft ?? app.serverUrl}
          onChangeText={setServerDraft}
          placeholder={DEFAULT_SERVER_URL}
          keyboardType="default"
          darkBg
        />
        {serverDraft !== null && serverDraft !== app.serverUrl ? (
          <View style={{ marginTop: 10 }}>
            <Btn
              label="Save server URL"
              small
              icon="server-outline"
              onPress={() => {
                app.setServerUrl(serverDraft);
                setServerDraft(null);
                setLastMessage("Server updated");
              }}
            />
          </View>
        ) : null}
      </Card>

      {/* Developer */}
      <SectionHeading title="Developer" />
      <Card style={{ alignItems: undefined }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Image
            source={DEVELOPER.photo}
            style={{
              width: 62,
              height: 62,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: palette.primary,
            }}
            accessible
            accessibilityLabel="Portrait of Ayman Chowdhury"
          />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: palette.text }}>{DEVELOPER.name}</Text>
            <Text style={{ fontSize: 12, color: palette.textDim, marginTop: 2 }}>
              Creator & developer of Momentum
            </Text>
            <View
              style={{
                alignSelf: "flex-start",
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 999,
                backgroundColor: palette.primarySoft,
                paddingHorizontal: 9,
                paddingVertical: 3,
                marginTop: 7,
              }}
            >
              <Ionicons name="heart" size={11} color={palette.primary} />
              <Text style={{ fontSize: 10.5, fontWeight: "700", color: palette.primary, marginLeft: 4 }}>
                Built with care
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: palette.border, marginVertical: 13 }} />

        <ContactRow
          icon="mail-outline"
          label="Email"
          value={DEVELOPER.email}
          onPress={() => void Linking.openURL(`mailto:${DEVELOPER.email}`).catch(() => undefined)}
        />
        <ContactRow
          icon="logo-github"
          label="GitHub"
          value={DEVELOPER.github}
          onPress={() => void Linking.openURL(DEVELOPER.githubUrl).catch(() => undefined)}
          last
        />
      </Card>

      <Text style={{ textAlign: "center", color: palette.textFaint, fontSize: 12, marginTop: 20, marginBottom: 8 }}>
        Momentum v1.2.0 · offline-first · your data, your device
      </Text>
      </ScrollView>
    </View>
  );
}

function ContactRow({
  icon,
  label,
  value,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
  last?: boolean;
}) {
  const { palette } = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 10,
        },
        !last && { borderBottomWidth: 1, borderBottomColor: palette.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          backgroundColor: palette.cardAlt,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={16} color={palette.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 11 }}>
        <Text style={{ fontSize: 10.5, fontWeight: "700", color: palette.textFaint, letterSpacing: 0.5 }}>
          {label.toUpperCase()}
        </Text>
        <Text style={{ fontSize: 13.5, fontWeight: "600", color: palette.text, marginTop: 1 }}>{value}</Text>
      </View>
      <Ionicons name="open-outline" size={15} color={palette.textFaint} />
    </Pressable>
  );
}

function SyncStatusRow() {
  const app = useApp();
  const { palette } = usePalette();
  const last = app.lastSyncAt ? new Date(app.lastSyncAt) : null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Ionicons
        name={app.syncing ? "sync" : app.pending > 0 ? "cloud-upload-outline" : "cloud-done-outline"}
        size={15}
        color={app.pending > 0 ? palette.warn : palette.primary}
        style={{ marginRight: 8 }}
      />
      <Text style={{ fontSize: 12.5, color: palette.textDim, flex: 1 }}>
        {app.syncing
          ? "Syncing…"
          : app.pending > 0
            ? `${app.pending} change${app.pending === 1 ? "" : "s"} waiting to sync`
            : last
              ? `Last synced ${last.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
              : "Not synced yet"}
      </Text>
    </View>
  );
}
