// Tasks — mirrors the web app's tasks-view: All/Today/Upcoming/Completed
// tabs, grouped task rows (checkbox · priority dot · title · checklist ·
// due label), full editor sheet, "N done today · N overdue" subtitle.

import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import * as data from "../db";
import { useApp, bumpData } from "../store";
import { scheduleSync } from "../sync";
import { toast } from "../toast";
import {
  EmptyState,
  Fab,
  OfflinePill,
  Screen,
  SectionHeading,
  Segmented,
  usePalette,
} from "../components/ui";
import { TaskEditorSheet } from "../components/task-editor";
import { PRIORITY_COLORS, type Palette } from "../theme";
import { dayKey, formatTime, relativeDay, titleize } from "../utils";

type Filter = "all" | "today" | "upcoming" | "completed";

export default function TasksScreen() {
  const { palette } = usePalette();
  const version = useApp((s) => s.dataVersion);
  const [filter, setFilter] = useState<Filter>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const buckets = useMemo(() => {
    const today = dayKey();
    const active = data.activeTodos();
    const done = data.completedTodos(300);
    return {
      today: active.filter((t) => t.dueDate && dayKey(t.dueDate) === today),
      overdue: active.filter((t) => t.dueDate && dayKey(t.dueDate) < today),
      upcoming: active.filter((t) => !t.dueDate || dayKey(t.dueDate) > today),
      all: active,
      done,
      doneToday: done.filter((t) => t.completedAt && dayKey(t.completedAt) === today),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const toggle = (id: string, done: boolean) => {
    data.setTodoCompleted(id, done);
    bumpData();
    scheduleSync();
    if (done) toast.success("Task completed 🎉");
  };

  const rows =
    filter === "all"
      ? buckets.all
      : filter === "today"
        ? [...buckets.overdue, ...buckets.today]
        : filter === "upcoming"
          ? buckets.upcoming
          : buckets.done;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        <View style={{ paddingTop: 8, paddingBottom: 14 }}>
          <Text style={{ color: palette.text, fontSize: 23, fontWeight: "800", letterSpacing: -0.4 }}>Tasks</Text>
          <Text style={{ color: palette.textDim, fontSize: 13.5, marginTop: 3 }}>
            {buckets.doneToday.length} done today · {buckets.overdue.length} overdue
          </Text>
        </View>
        <OfflinePill />

        <Segmented
          value={filter}
          onChange={(k) => setFilter(k as Filter)}
          options={[
            { key: "all", label: "All" },
            { key: "today", label: "Today" },
            { key: "upcoming", label: "Upcoming" },
            { key: "completed", label: "Done" },
          ]}
        />

        <View style={{ marginTop: 8 }} />

        {filter === "today" && buckets.overdue.length > 0 ? (
          <>
            <SectionHeading title={`Overdue · ${buckets.overdue.length}`} />
            {buckets.overdue.map((t) => (
              <TaskRow
                key={t.id}
                todo={t}
                palette={palette}
                overdue
                onToggle={() => toggle(t.id, !t.completed)}
                onOpen={() => {
                  setEditingId(t.id);
                  setEditorOpen(true);
                }}
              />
            ))}
            {buckets.today.length > 0 ? <SectionHeading title="Today" /> : null}
          </>
        ) : null}

        {rows.length === 0 ? (
          <View
            style={{
              borderRadius: 18,
              borderWidth: 1,
              borderColor: palette.border,
              backgroundColor: palette.card,
              marginTop: 8,
            }}
          >
            <EmptyState
              icon={filter === "completed" ? "checkmark-done-outline" : "checkbox-outline"}
              title={
                filter === "completed"
                  ? "Nothing completed yet"
                  : filter === "today"
                    ? "Nothing due today"
                    : filter === "upcoming"
                      ? "Nothing upcoming"
                      : "No tasks yet"
              }
              hint="Tap + to capture something."
            />
          </View>
        ) : (
          rows.map((t) => (
            <TaskRow
              key={t.id}
              todo={t}
              palette={palette}
              overdue={filter === "today" ? false : !t.completed && !!t.dueDate && dayKey(t.dueDate) < dayKey()}
              onToggle={() => toggle(t.id, !t.completed)}
              onOpen={() => {
                setEditingId(t.id);
                setEditorOpen(true);
              }}
            />
          ))
        )}
      </ScrollView>

      <Fab
        onPress={() => {
          setEditingId(null);
          setEditorOpen(true);
        }}
      />
      <TaskEditorSheet visible={editorOpen} todoId={editingId} onClose={() => setEditorOpen(false)} />
    </View>
  );
}

function TaskRow({
  todo,
  palette,
  overdue,
  onToggle,
  onOpen,
}: {
  todo: data.Todo;
  palette: Palette;
  overdue: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const done = !!todo.completed;
  const due = todo.dueDate ? new Date(todo.dueDate) : null;
  const showTime = due ? due.getHours() + due.getMinutes() > 0 : false;
  const subs = data.subtasksOf(todo.id);
  const subsDone = subs.filter((s) => s.completed).length;
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: palette.card,
          borderColor: palette.border,
          borderWidth: 1,
          borderRadius: 16,
          paddingHorizontal: 13,
          paddingVertical: 12,
          marginBottom: 8,
        },
        pressed && { opacity: 0.82 },
      ]}
    >
      <Pressable onPress={onToggle} hitSlop={8} style={{ padding: 2 }}>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: done ? palette.primary : palette.border,
            backgroundColor: done ? palette.primary : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {done ? <Ionicons name="checkmark" size={15} color={palette.onPrimary} /> : null}
        </View>
      </Pressable>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          backgroundColor: done ? palette.textFaint : PRIORITY_COLORS[todo.priority] ?? palette.textFaint,
          marginLeft: 10,
        }}
      />
      <View style={{ flex: 1, marginLeft: 9 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 14.5,
            fontWeight: "600",
            color: done ? palette.textFaint : palette.text,
            textDecorationLine: done ? "line-through" : "none",
          }}
        >
          {todo.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
          {todo.dueDate ? (
            <Text
              style={{
                fontSize: 11.5,
                fontWeight: "500",
                color: overdue && !done ? palette.danger : palette.textDim,
              }}
            >
              {relativeDay(dayKey(todo.dueDate))}
              {showTime ? ` · ${formatTime(todo.dueDate)}` : ""}
            </Text>
          ) : (
            <Text style={{ fontSize: 11.5, color: palette.textFaint }}>No date</Text>
          )}
          {subs.length > 0 ? (
            <Text style={{ fontSize: 11, fontWeight: "600", color: palette.textDim }}>
              ☑ {subsDone}/{subs.length}
            </Text>
          ) : null}
          {todo.repeat !== "none" ? <Ionicons name="repeat" size={11} color={palette.textDim} /> : null}
          {todo.notes ? <Ionicons name="document-text-outline" size={11} color={palette.textFaint} /> : null}
          <View
            style={{
              borderRadius: 999,
              backgroundColor: palette.cardAlt,
              paddingHorizontal: 8,
              paddingVertical: 2,
              marginLeft: "auto",
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "600", color: palette.textDim }}>
              {titleize(todo.category)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
