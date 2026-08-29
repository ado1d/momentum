// Dashboard — the daily cockpit: progress, habits, today's tasks, quick actions.

import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import * as data from "../db";
import { useApp, bumpData } from "../store";
import { scheduleSync } from "../sync";
import {
  Card,
  EmptyState,
  OfflinePill,
  ProgressRing,
  Screen,
  ScreenHeader,
  SectionTitle,
  usePalette,
} from "../components/ui";
import { TaskEditorSheet } from "../components/task-editor";
import { accentColor, PRIORITY_COLORS, type Palette } from "../theme";
import {
  dayKey,
  formatDateLong,
  formatTime,
  greeting,
  minutesToClock,
  relativeDay,
  titleize,
} from "../utils";

export default function DashboardScreen() {
  const { palette } = usePalette();
  const navigation = useNavigation<any>();
  const version = useApp((s) => s.dataVersion);
  const auth = useApp((s) => s.auth);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const model = useMemo(() => {
    const today = dayKey();
    const allActive = data.activeTodos();
    const todayTasks = allActive.filter((t) => t.dueDate && dayKey(t.dueDate) === today);
    const overdue = allActive.filter((t) => t.dueDate && dayKey(t.dueDate) < today);
    const completedToday = data
      .completedTodos(200)
      .filter((t) => t.completedAt && dayKey(t.completedAt) === today);
    const totalToday = todayTasks.length + overdue.length + completedToday.length;
    const doneToday = completedToday.length;
    const habits = data.habits();
    const habitsDone = habits.filter((h) => h.doneToday).length;
    const focusToday = data.focusSessionsForDay(today).reduce((s, f) => s + f.minutes, 0);
    const bestStreak = habits.reduce((m, h) => Math.max(m, h.streak), 0);
    return {
      todayTasks,
      overdue,
      completedToday,
      totalToday,
      doneToday,
      habits,
      habitsDone,
      focusToday,
      bestStreak,
    };
  }, [version]);

  const name = auth?.name?.split(" ")[0] ?? "";

  const complete = (id: string) => {
    data.setTodoCompleted(id, true);
    bumpData();
    scheduleSync();
  };

  return (
    <Screen>
      <ScreenHeader
        title="Momentum"
        subtitle={`${greeting()}${name ? `, ${name}` : ""} · ${formatDateLong()}`}
        right={
          <Pressable
            onPress={() => navigation.navigate("Settings")}
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              backgroundColor: palette.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="settings-outline" size={20} color={palette.primary} />
          </Pressable>
        }
      />
      <OfflinePill />

      {/* Progress hero */}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <ProgressRing
            size={110}
            progress={model.totalToday === 0 ? 0 : model.doneToday / model.totalToday}
            color={palette.primary}
            trackColor={palette.cardAlt}
          >
            <Text style={{ fontSize: 24, fontWeight: "800", color: palette.text }}>
              {model.totalToday === 0 ? "–" : Math.round((model.doneToday / model.totalToday) * 100)}%
            </Text>
            <Text style={{ fontSize: 11, color: palette.textDim }}>today</Text>
          </ProgressRing>
          <View style={{ flex: 1, marginLeft: 18 }}>
            <StatLine icon="checkmark-done-outline" color={palette.primary} text={`${model.doneToday}/${model.totalToday} tasks done`} palette={palette} />
            <StatLine icon="flame-outline" color="#fb923c" text={`${model.habitsDone}/${model.habits.length} habits · best streak ${model.bestStreak}🔥`} palette={palette} />
            <StatLine icon="timer-outline" color="#2dd4bf" text={`${minutesToClock(model.focusToday)} focused today`} palette={palette} />
          </View>
        </View>
      </Card>

      {/* Quick actions */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 4 }}>
        <QuickAction
          icon="add-circle-outline"
          label="New task"
          palette={palette}
          onPress={() => {
            setEditingId(null);
            setEditorOpen(true);
          }}
        />
        <QuickAction icon="timer-outline" label="Focus" palette={palette} onPress={() => navigation.navigate("Focus")} />
        <QuickAction icon="book-outline" label="Journal" palette={palette} onPress={() => navigation.navigate("Diary")} />
        <QuickAction icon="create-outline" label="Note" palette={palette} onPress={() => navigation.navigate("Notes")} />
      </View>

      {/* Habits */}
      <SectionTitle>Today's habits</SectionTitle>
      {model.habits.length === 0 ? (
        <Card>
          <EmptyState icon="repeat-outline" title="No habits yet" hint="Build streaks in the Routine tab." />
        </Card>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
          {model.habits.map((h) => (
            <Pressable
              key={h.id}
              onPress={() => {
                data.toggleHabit(h.id, dayKey());
                bumpData();
                scheduleSync();
              }}
              style={{
                width: 96,
                marginRight: 10,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: h.doneToday ? accentColor(h.color) : palette.border,
                backgroundColor: palette.card,
                alignItems: "center",
                paddingVertical: 14,
              }}
            >
              <Text style={{ fontSize: 26 }}>{h.emoji}</Text>
              <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "600", color: palette.text, marginTop: 6, paddingHorizontal: 6 }}>
                {h.name}
              </Text>
              <Text style={{ fontSize: 11, color: h.doneToday ? accentColor(h.color) : palette.textFaint, marginTop: 2 }}>
                {h.doneToday ? "Done ✓" : `${h.streak}🔥`}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Overdue */}
      {model.overdue.length > 0 ? (
        <>
          <SectionTitle>Overdue</SectionTitle>
          {model.overdue.slice(0, 5).map((t) => (
            <TaskRow key={t.id} todo={t} palette={palette} onPress={complete} overdue />
          ))}
        </>
      ) : null}

      {/* Today */}
      <SectionTitle>Today</SectionTitle>
      {model.todayTasks.length === 0 && model.overdue.length === 0 ? (
        <Card>
          <EmptyState icon="sunny-outline" title="Nothing due today" hint="Add a task or enjoy the calm." />
        </Card>
      ) : (
        model.todayTasks.map((t) => <TaskRow key={t.id} todo={t} palette={palette} onPress={complete} />)
      )}

      {model.completedToday.length > 0 ? (
        <>
          <SectionTitle>Completed today</SectionTitle>
          {model.completedToday.slice(0, 8).map((t) => (
            <TaskRow key={t.id} todo={t} palette={palette} onPress={() => undefined} done />
          ))}
        </>
      ) : null}

      <TaskEditorSheet visible={editorOpen} todoId={editingId} presetDueToday onClose={() => setEditorOpen(false)} />
    </Screen>
  );
}

function StatLine({ icon, color, text, palette }: { icon: keyof typeof Ionicons.glyphMap; color: string; text: string; palette: Palette }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
      <Ionicons name={icon} size={16} color={color} style={{ marginRight: 8 }} />
      <Text style={{ color: palette.textDim, fontSize: 13, fontWeight: "600" }}>{text}</Text>
    </View>
  );
}

function QuickAction({ icon, label, palette, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; palette: Palette; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: palette.card,
          borderColor: palette.border,
          borderWidth: 1,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 9,
          marginRight: 8,
          marginBottom: 8,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons name={icon} size={15} color={palette.primary} style={{ marginRight: 6 }} />
      <Text style={{ color: palette.text, fontSize: 13, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

function TaskRow({
  todo,
  palette,
  onPress,
  done,
  overdue,
}: {
  todo: data.Todo;
  palette: Palette;
  onPress: (id: string) => void;
  done?: boolean;
  overdue?: boolean;
}) {
  const due = todo.dueDate ? new Date(todo.dueDate) : null;
  const showTime = due ? due.getHours() + due.getMinutes() > 0 : false;
  return (
    <Pressable
      onPress={() => onPress(todo.id)}
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
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: done ? palette.primary : PRIORITY_COLORS[todo.priority] ?? palette.textFaint,
          backgroundColor: done ? palette.primary : "transparent",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        {done ? <Ionicons name="checkmark" size={16} color={palette.onPrimary} /> : null}
      </View>
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
        <Text style={{ fontSize: 12, color: overdue ? palette.danger : palette.textFaint, marginTop: 1 }}>
          {overdue
            ? `Overdue · ${relativeDay(dayKey(todo.dueDate ?? ""))}${showTime ? ` ${formatTime(todo.dueDate)}` : ""}`
            : showTime
              ? formatTime(todo.dueDate)
              : titleize(todo.category)}
        </Text>
      </View>
      <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: PRIORITY_COLORS[todo.priority], marginLeft: 8 }} />
    </Pressable>
  );
}
