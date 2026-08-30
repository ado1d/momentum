// Settings — account (Google sign-in / sync), appearance, reminders, backups.

import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

import { db, exportJSON, importJSON } from "../db";
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
  usePalette,
} from "../components/ui";
import type { ThemeMode } from "../theme";
import { scheduleDailyReminder, sendTestNotification, ensureNotificationPermission } from "../notifications";
import DateTimePicker from "@react-native-community/datetimepicker";

export default function SettingsScreen() {
  const { palette } = usePalette();
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const [serverDraft, setServerDraft] = useState<string | null>(null);
  const [showReminderTime, setShowReminderTime] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

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

  const initial = (app.auth?.name ?? app.auth?.email ?? "?")[0].toUpperCase();
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
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 999,
                  backgroundColor: palette.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 20, fontWeight: "800", color: palette.primary }}>{initial}</Text>
              </View>
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
      <SectionHeading title="Daily reminder" />
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontSize: 14.5, fontWeight: "600", color: palette.text }}>Reminder notification</Text>
            <Text style={{ fontSize: 12, color: palette.textDim, marginTop: 2 }}>
              {app.reminderEnabled
                ? `Every day at ${String(app.reminderHour).padStart(2, "0")}:${String(app.reminderMinute).padStart(2, "0")}`
                : "Off"}
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

      <Text style={{ textAlign: "center", color: palette.textFaint, fontSize: 12, marginTop: 20, marginBottom: 8 }}>
        Momentum v1.1.0 · offline-first · your data, your device
      </Text>
      </ScrollView>
    </View>
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
