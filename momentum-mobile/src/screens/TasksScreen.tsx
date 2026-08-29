// Tasks — full todo list with filters, completion toggling and the editor.

import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import * as data from "../db";
import { useApp, bumpData } from "../store";
import { scheduleSync } from "../sync";
import {
  Card,
  EmptyState,
  Fab,
  OfflinePill,
  Screen,
  ScreenHeader,
  Segmented,
  usePalette,
} from "../components/ui";
import { TaskEditorSheet } from "../components/task-editor";
import { PRIORITY_COLORS, type Palette } from "../theme";
import { dayKey, formatTime, relativeDay, titleize } from "../utils";

type Filter = "today" | "upcoming" | "all" | "done";

export default function TasksScreen() {
  const { palette } = usePalette();
  const version = useApp((s) => s.dataVersion);
  const [filter, setFilter] = useState<Filter>("today");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const today = dayKey();
    const active = data.activeTodos();
    const done = data.completedTodos(300);
    return {
      today: active.filter((t) => t.dueDate && dayKey(t.dueDate) === today),
      overdue: active.filter((t) => t.dueDate && dayKey(t.dueDate) < today),
      upcoming: active.filter((t) => !t.dueDate || dayKey(t.dueDate) > today),
      all: active,
      done,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const rows =
    filter === "today"
      ? [...groups.overdue, ...groups.today]
      : filter === "upcoming"
        ? groups.upcoming
        : filter === "all"
          ? groups.all
          : groups.done;

  const overdueIds = new Set(groups.overdue.map((t) => t.id));

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScreenHeader title="Tasks" subtitle={`${groups.all.length} active · ${groups.done.length} done`} />
      <OfflinePill />
      <View style={{ paddingHorizontal: 16 }}>
        <Segmented
          value={filter}
          onChange={(k) => setFilter(k as Filter)}
          options={[
            { key: "today", label: "Today" },
            { key: "upcoming", label: "Upcoming" },
            { key: "all", label: "All" },
            { key: "done", label: "Done" },
          ]}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}>
        {rows.length === 0 ? (
          <Card style={{ marginTop: 8 }}>
            <EmptyState
              icon={filter === "done" ? "checkmark-done-outline" : "checkbox-outline"}
              title={filter === "done" ? "Nothing completed yet" : filter === "today" ? "Nothing due today" : "No tasks here"}
              hint="Tap + to capture something."
            />
          </Card>
        ) : (
          rows.map((t) => (
            <TaskRow
              key={t.id}
              todo={t}
              palette={palette}
              overdue={overdueIds.has(t.id)}
              onToggle={() => {
                data.setTodoCompleted(t.id, !t.completed);
                bumpData();
                scheduleSync();
              }}
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
  const dueLabel = todo.dueDate
    ? `${relativeDay(dayKey(todo.dueDate))}${showTime ? ` · ${formatTime(todo.dueDate)}` : ""}`
    : "No date";
  const subCount = data.subtasksOf(todo.id).length;
  return (
    <Pressable
      onPress={onOpen}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: palette.card,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 8,
      }}
    >
      <Pressable
        onPress={onToggle}
        hitSlop={6}
        style={{
          width: 26,
          height: 26,
          borderRadius: 9,
          borderWidth: 2,
          borderColor: done ? palette.primary : (PRIORITY_COLORS[todo.priority] ?? palette.textFaint),
          backgroundColor: done ? palette.primary : "transparent",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        {done ? <Ionicons name="checkmark" size={17} color={palette.onPrimary} /> : null}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 15,
            fontWeight: "600",
            color: done ? palette.textFaint : palette.text,
            textDecorationLine: done ? "line-through" : "none",
          }}
        >
          {todo.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 12, color: overdue && !done ? palette.danger : palette.textFaint, flexShrink: 1 }}
          >
            {overdue && !done ? `⚠︎ ${dueLabel}` : dueLabel}
          </Text>
          {todo.repeat !== "none" ? (
            <Ionicons name="repeat" size={11} color={palette.textFaint} style={{ marginLeft: 6 }} />
          ) : null}
          {subCount > 0 ? (
            <Text style={{ fontSize: 11, color: palette.textFaint, marginLeft: 6 }}>• {subCount} items</Text>
          ) : null}
          <View
            style={{
              borderRadius: 999,
              backgroundColor: palette.cardAlt,
              paddingHorizontal: 7,
              paddingVertical: 2,
              marginLeft: 8,
            }}
          >
            <Text style={{ fontSize: 10.5, fontWeight: "600", color: palette.textDim }}>{titleize(todo.category)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
