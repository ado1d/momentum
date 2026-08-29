// Focus — Pomodoro-style deep work timer with session history.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import * as data from "../db";
import { useApp, bumpData } from "../store";
import { scheduleSync } from "../sync";
import {
  Bar,
  Btn,
  Card,
  Chip,
  EmptyState,
  FieldLabel,
  Input,
  OfflinePill,
  ProgressRing,
  Screen,
  ScreenHeader,
  SectionTitle,
  Sheet,
  usePalette,
} from "../components/ui";
import { dayKey, formatClock, formatTime, minutesToClock } from "../utils";

const PRESETS = [25, 45, 50, 15];

export default function FocusScreen() {
  const { palette } = usePalette();
  const version = useApp((s) => s.dataVersion);
  const [minutes, setMinutes] = useState(25);
  const [label, setLabel] = useState("");
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(25 * 60);
  const [saveOpen, setSaveOpen] = useState(false);
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [linkedTaskId, setLinkedTaskId] = useState<string | null>(null);
  const endRef = useRef<number>(0);
  const startedAtRef = useRef<string>(new Date().toISOString());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        setRunning(false);
        setSaveOpen(true);
      }
    }, 500);
    return () => clearInterval(id);
  }, [running]);

  const todaySessions = useMemo(
    () => data.focusSessionsForDay(dayKey()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
  const todayMinutes = todaySessions.reduce((s, f) => s + f.minutes, 0);
  const weekMinutes = useMemo(
    () => data.statsForDays(7).reduce((s, d) => s + d.focusMinutes, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
  const activeTasks = useMemo(
    () => data.activeTodos().slice(0, 30),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
  const linkedTask = linkedTaskId ? data.getTodo(linkedTaskId) : null;

  const start = () => {
    startedAtRef.current = new Date().toISOString();
    endRef.current = Date.now() + remaining * 1000;
    setRunning(true);
  };
  const pause = () => {
    setRunning(false);
  };
  const reset = () => {
    setRunning(false);
    setRemaining(minutes * 60);
  };
  const setPreset = (m: number) => {
    setMinutes(m);
    setRunning(false);
    setRemaining(m * 60);
  };

  const confirmSave = () => {
    const elapsed = minutes * 60 - remaining;
    const worked = Math.max(1, Math.round(elapsed / 60));
    data.saveFocusSession(worked, label.trim() || linkedTask?.title || null, linkedTaskId, startedAtRef.current);
    bumpData();
    scheduleSync();
    setSaveOpen(false);
    setLabel("");
    setLinkedTaskId(null);
    setRemaining(minutes * 60);
  };

  const progress = minutes * 60 === 0 ? 0 : 1 - remaining / (minutes * 60);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScreenHeader title="Focus" subtitle="Deep work, one session at a time" />
      <OfflinePill />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <Card style={{ alignItems: "center", paddingVertical: 26 }}>
          <ProgressRing size={230} progress={progress} color={palette.primary} trackColor={palette.cardAlt} thickness={10}>
            <Text style={{ fontSize: 52, fontWeight: "800", color: palette.text, fontVariant: ["tabular-nums"], letterSpacing: 2 }}>
              {formatClock(remaining)}
            </Text>
            <Text style={{ fontSize: 12, color: palette.textDim, marginTop: 4 }}>
              {running ? "focusing…" : `${minutes} minute session`}
            </Text>
          </ProgressRing>

          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 20 }}>
            {PRESETS.map((m) => (
              <Chip key={m} label={`${m}m`} active={minutes === m} onPress={() => setPreset(m)} small />
            ))}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 16 }}>
            <Pressable
              onPress={running ? pause : start}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: palette.primary,
                borderRadius: 16,
                paddingHorizontal: 26,
                paddingVertical: 13,
              }}
            >
              <Ionicons name={running ? "pause" : "play"} size={19} color={palette.onPrimary} />
              <Text style={{ color: palette.onPrimary, fontWeight: "800", fontSize: 15, marginLeft: 7 }}>
                {running ? "Pause" : remaining < minutes * 60 ? "Resume" : "Start"}
              </Text>
            </Pressable>
            <Pressable
              onPress={reset}
              style={{ marginLeft: 10, padding: 12, borderRadius: 14, backgroundColor: palette.cardAlt }}
            >
              <Ionicons name="refresh" size={19} color={palette.textDim} />
            </Pressable>
          </View>

          {linkedTask ? (
            <Pressable
              onPress={() => setTaskPickerOpen(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 16,
                borderRadius: 999,
                backgroundColor: palette.primarySoft,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Ionicons name="link" size={12} color={palette.primary} />
              <Text style={{ color: palette.primary, fontSize: 12, fontWeight: "600", marginLeft: 6 }} numberOfLines={1}>
                {linkedTask.title}
              </Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setTaskPickerOpen(true)} style={{ marginTop: 16 }}>
              <Text style={{ color: palette.textFaint, fontSize: 12.5 }}>＋ link a task (optional)</Text>
            </Pressable>
          )}
        </Card>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Card style={{ flex: 1, marginBottom: 0 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: palette.primary }}>{minutesToClock(todayMinutes)}</Text>
            <Text style={{ fontSize: 12, color: palette.textDim, marginTop: 2 }}>today</Text>
          </Card>
          <Card style={{ flex: 1, marginBottom: 0 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: palette.text }}>{minutesToClock(weekMinutes)}</Text>
            <Text style={{ fontSize: 12, color: palette.textDim, marginTop: 2 }}>this week</Text>
          </Card>
        </View>

        <SectionTitle>Today's sessions</SectionTitle>
        {todaySessions.length === 0 ? (
          <Card>
            <EmptyState icon="timer-outline" title="No sessions yet today" hint="Start the timer — even 15 focused minutes counts." />
          </Card>
        ) : (
          todaySessions.map((s) => (
            <Card key={s.id} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontWeight: "700", fontSize: 14 }}>
                    {s.label ?? "Focus session"}
                  </Text>
                  <Text style={{ color: palette.textFaint, fontSize: 12, marginTop: 2 }}>
                    {formatTime(s.endedAt)} · {s.minutes} min
                  </Text>
                </View>
                <Ionicons name="time-outline" size={18} color={palette.primary} />
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Save sheet when timer completes */}
      <Sheet
        visible={saveOpen}
        onClose={() => {
          setSaveOpen(false);
          setRemaining(minutes * 60);
        }}
        title="Session complete 🎉"
        footer={
          <Btn label="Save session" icon="checkmark" onPress={confirmSave} />
        }
      >
        <Text style={{ color: palette.textDim, fontSize: 14, marginBottom: 4 }}>
          Log this session to your history and insights.
        </Text>
        <FieldLabel>What did you focus on? (optional)</FieldLabel>
        <Input value={label} onChangeText={setLabel} placeholder="e.g. Thesis chapter 2" />
        <FieldLabel>Minutes</FieldLabel>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {[5, 10, 15, 25, 45, 50].map((m) => (
            <Chip
              key={m}
              label={`${m}`}
              small
              active={minutes * 60 - remaining >= m * 60 - 30 && minutes * 60 - remaining < (m + 1) * 60 - 30}
              onPress={() => setRemaining(minutes * 60 - m * 60)}
            />
          ))}
        </View>
        <Bar value={minutes * 60 - remaining} max={minutes * 60} color={palette.primary} />
      </Sheet>

      {/* Task picker */}
      <Sheet visible={taskPickerOpen} onClose={() => setTaskPickerOpen(false)} title="Link a task">
        {activeTasks.length === 0 ? (
          <EmptyState icon="checkbox-outline" title="No active tasks" hint="Create a task first to link it here." />
        ) : (
          <>
            <Chip label="No task" active={!linkedTaskId} onPress={() => { setLinkedTaskId(null); setTaskPickerOpen(false); }} />
            {activeTasks.map((t) => (
              <Chip
                key={t.id}
                label={t.title}
                active={linkedTaskId === t.id}
                onPress={() => {
                  setLinkedTaskId(t.id);
                  setTaskPickerOpen(false);
                }}
              />
            ))}
          </>
        )}
      </Sheet>
    </View>
  );
}
