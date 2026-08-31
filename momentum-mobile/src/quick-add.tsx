// Quick Add — mirrors the web app's QuickAddDialog: one sheet, three tabs
// (Task / Note / Diary), exactly the web's fields and toast feedback.

import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import * as data from "./db";
import { useApp, bumpData } from "./store";
import { scheduleSync } from "./sync";
import { toast } from "./toast";
import {
  Btn,
  Chip,
  FieldLabel,
  Input,
  RichTextEditor,
  Segmented,
  Sheet,
  usePalette,
} from "./components/ui";
import { MOODS } from "./theme";
import { dayKey } from "./utils";

type QuickTab = "task" | "note" | "diary";

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const REPEATS = ["none", "daily", "weekdays", "weekly", "monthly"] as const;

export function QuickAddSheet() {
  const { palette } = usePalette();
  const open = useApp((s) => s.quickAddOpen);
  const setOpen = useApp((s) => s.setQuickAddOpen);

  const [tab, setTab] = useState<QuickTab>("task");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [due, setDue] = useState<"none" | "today" | "tomorrow">("today");
  const [repeat, setRepeat] = useState<string>("none");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab("task");
    setTitle("");
    setPriority("medium");
    setDue("today");
    setRepeat("none");
    setContent("");
    setMood(null);
  }, [open]);

  const close = () => setOpen(false);

  const createTask = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    let dueISO: string | null = null;
    if (due !== "none") {
      const d = new Date();
      if (due === "tomorrow") d.setDate(d.getDate() + 1);
      d.setHours(12, 0, 0, 0);
      dueISO = d.toISOString();
    }
    data.saveTodo(null, { title: trimmed, priority, repeat, dueDate: dueISO });
    bumpData();
    scheduleSync();
    toast.success("Task added");
    close();
  };

  const createNote = () => {
    data.saveNote(null, {
      title: title.trim() || "Untitled note",
      content: content.trim(),
    });
    bumpData();
    scheduleSync();
    toast.success("Note saved");
    close();
  };

  const saveDiary = () => {
    if (!content.trim() && !mood) return;
    data.saveJournal({
      date: dayKey(),
      content: content.trim(),
      mood,
    });
    bumpData();
    scheduleSync();
    toast.success("Diary saved");
    close();
  };

  const canSave =
    tab === "task"
      ? !!title.trim()
      : tab === "note"
        ? !!(title.trim() || content.trim())
        : !!(content.trim() || mood);

  return (
    <Sheet
      visible={open}
      onClose={close}
      title="Quick add"
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Btn
            label="Cancel"
            variant="ghost"
            onPress={close}
            style={{ flex: 1 }}
          />
          <Btn
            label={
              tab === "task"
                ? "Add task"
                : tab === "note"
                  ? "Save note"
                  : "Save entry"
            }
            icon="checkmark"
            disabled={!canSave}
            onPress={
              tab === "task"
                ? createTask
                : tab === "note"
                  ? createNote
                  : saveDiary
            }
            style={{ flex: 2 }}
          />
        </View>
      }
    >
      <Segmented
        value={tab}
        onChange={(k) => setTab(k as QuickTab)}
        options={[
          { key: "task", label: "Task" },
          { key: "note", label: "Note" },
          { key: "diary", label: "Diary" },
        ]}
      />

      {tab !== "diary" ? (
        <>
          <FieldLabel>
            {tab === "task" ? "What needs doing?" : "Note title"}
          </FieldLabel>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder={
              tab === "task" ? "e.g. Finish the report" : "e.g. Book ideas"
            }
            autoFocus
            returnKeyType="done"
            onSubmitEditing={tab === "task" ? createTask : undefined}
          />
        </>
      ) : null}

      {tab === "task" ? (
        <>
          <FieldLabel>Priority</FieldLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {PRIORITIES.map((p) => (
              <Chip
                key={p}
                label={p[0].toUpperCase() + p.slice(1)}
                active={priority === p}
                onPress={() => setPriority(p)}
              />
            ))}
          </View>

          <FieldLabel>Due</FieldLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {(["today", "tomorrow", "none"] as const).map((d) => (
              <Chip
                key={d}
                label={
                  d === "none" ? "Someday" : d[0].toUpperCase() + d.slice(1)
                }
                active={due === d}
                onPress={() => setDue(d)}
              />
            ))}
          </View>

          <FieldLabel>Repeat</FieldLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {REPEATS.map((r) => (
              <Chip
                key={r}
                label={r === "none" ? "Never" : r[0].toUpperCase() + r.slice(1)}
                active={repeat === r}
                onPress={() => setRepeat(r)}
              />
            ))}
          </View>
        </>
      ) : null}

      {tab === "note" ? (
        <>
          <FieldLabel>Content</FieldLabel>
          <RichTextEditor
            value={content}
            onChangeText={setContent}
            placeholder="Write freely…"
            minHeight={140}
          />
        </>
      ) : null}

      {tab === "diary" ? (
        <>
          <FieldLabel>How was your day?</FieldLabel>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            {MOODS.map((m) => (
              <Pressable
                key={m.key}
                onPress={() => setMood(mood === m.key ? null : m.key)}
                style={{
                  width: 56,
                  height: 64,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor:
                    mood === m.key ? palette.primary : palette.border,
                  backgroundColor:
                    mood === m.key ? palette.primarySoft : palette.card,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
                <Text
                  style={{ fontSize: 10, color: palette.textDim, marginTop: 3 }}
                >
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <FieldLabel>Today's entry</FieldLabel>
          <RichTextEditor
            value={content}
            onChangeText={setContent}
            placeholder="What happened today? What are you grateful for?"
            minHeight={140}
          />
        </>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 16,
          gap: 6,
        }}
      >
        <Ionicons name="flash-outline" size={13} color={palette.textFaint} />
        <Text style={{ color: palette.textFaint, fontSize: 11.5 }}>
          Everything saves on this device — syncs when you're signed in.
        </Text>
      </View>
    </Sheet>
  );
}
