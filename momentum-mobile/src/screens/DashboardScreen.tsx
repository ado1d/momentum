// Dashboard — mirrors the web app's dashboard-view: gradient greeting,
// quote card, 2×2 stat cards, this-week chart, overdue banner, today's
// focus, habit chips, active goals and recent journal.

import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import * as data from "../db";
import { useApp, bumpData } from "../store";
import { scheduleSync } from "../sync";
import {
  Bar,
  Btn,
  Card,
  EmptyNote,
  ProgressRing,
  Screen,
  SectionHeading,
  SeeAll,
  WeekDots,
  usePalette,
} from "../components/ui";
import { TaskEditorSheet } from "../components/task-editor";
import { MOODS, PRIORITY_COLORS, quoteForDay, accentColor, type Palette } from "../theme";
import { dayKey, firstName, formatDateLong, formatTime, greeting, minutesToClock, relativeDay } from "../utils";

export default function DashboardScreen() {
  const { palette } = usePalette();
  const navigation = useNavigation<any>();
  const version = useApp((s) => s.dataVersion);
  const setQuickAddOpen = useApp((s) => s.setQuickAddOpen);
  const auth = useApp((s) => s.auth);
  const who = firstName(auth?.name);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const model = useMemo(
    () => data.dashboardModel(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const quote = quoteForDay(dayKey());
  const today = dayKey();

  const toggleTodo = (id: string, done: boolean) => {
    data.setTodoCompleted(id, done);
    bumpData();
    scheduleSync();
  };

  const toggleHabit = (id: string) => {
    data.toggleHabit(id, dayKey());
    bumpData();
    scheduleSync();
  };

  const addStarterHabits = () => {
    data.saveHabit(null, { name: "Drink 8 glasses of water", emoji: "💧", color: "teal", timeOfDay: "anytime" });
    data.saveHabit(null, { name: "Read 20 minutes", emoji: "📚", color: "amber", timeOfDay: "evening" });
    data.saveHabit(null, { name: "Move your body", emoji: "🏃", color: "rose", timeOfDay: "morning" });
    bumpData();
    scheduleSync();
  };

  const isEmpty =
    model.todosTotal === 0 && model.habitsTotal === 0 && model.activeGoals.length === 0 && model.routineTotal === 0;

  const weekDays = model.habits[0]?.last7Dates ?? [];
  const avgScore = Math.round(model.week.reduce((s, d) => s + d.score, 0) / Math.max(1, model.week.length));

  return (
    <Screen bottomPad={30}>
      {/* Header: greeting + date + score pill */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18, marginTop: 4 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: palette.primary, fontSize: 22, fontWeight: "800", letterSpacing: -0.4 }}>
            {greeting()}{who ? `, ${who}` : ""}
          </Text>
          <Text style={{ color: palette.textDim, fontSize: 13.5, marginTop: 2 }}>{formatDateLong()}</Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: palette.primaryDim,
            backgroundColor: palette.primarySoft,
            paddingHorizontal: 13,
            paddingVertical: 7,
          }}
        >
          <Ionicons name="flash" size={14} color={palette.primary} />
          <Text style={{ color: palette.primary, fontSize: 14.5, fontWeight: "800" }}>{model.score}%</Text>
        </View>
      </View>

      {isEmpty ? (
        <>
          {/* Onboarding card (web OnboardingCard) */}
          <Card style={{ alignItems: "center", paddingVertical: 26 }}>
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 19,
                backgroundColor: palette.primary,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <Ionicons name="flash" size={30} color={palette.onPrimary} />
            </View>
            <Text style={{ color: palette.text, fontSize: 21, fontWeight: "800", letterSpacing: -0.3 }}>
              Welcome to Momentum 👋
            </Text>
            <Text
              style={{
                color: palette.textDim,
                fontSize: 13.5,
                lineHeight: 20,
                textAlign: "center",
                marginTop: 8,
                maxWidth: 300,
              }}
            >
              Track tasks, build habits, and grow toward your goals — one small win at a time.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 18, gap: 8 }}>
              <Btn label="Add your first task" icon="add" onPress={() => setQuickAddOpen(true)} />
              <Btn label="Add starter habits" variant="outline" icon="repeat-outline" onPress={addStarterHabits} />
            </View>
            <Btn
              label="Set a goal"
              variant="ghost"
              icon="flag-outline"
              small
              onPress={() => navigation.navigate("Main", { screen: "Goals" })}
              style={{ marginTop: 4 }}
            />
          </Card>
          <QuoteCard palette={palette} text={quote.text} author={quote.author} />
        </>
      ) : (
        <>
          <QuoteCard palette={palette} text={quote.text} author={quote.author} />

          {/* Stat cards 2×2 */}
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
            <Card style={{ flex: 1, alignItems: "center", paddingVertical: 18 }}>
              <ProgressRing
                size={88}
                progress={model.score / 100}
                thickness={8}
                color={palette.primary}
                trackColor={palette.cardAlt}
              >
                <Text style={{ color: palette.primary, fontSize: 22, fontWeight: "800" }}>{model.score}</Text>
                <Text style={{ color: palette.textDim, fontSize: 10.5, marginTop: -2 }}>Score</Text>
              </ProgressRing>
            </Card>
            <View style={{ flex: 1, gap: 12 }}>
              <StatMini
                palette={palette}
                label="Tasks today"
                icon="list-outline"
                iconColor="#34d399"
                value={`${model.todosDone}`}
                total={`/${model.todosTotal}`}
                pct={model.todosTotal > 0 ? model.todosDone / model.todosTotal : 0}
                barColor="#34d399"
              />
              <StatMini
                palette={palette}
                label="Habits"
                icon="repeat-outline"
                iconColor="#2dd4bf"
                value={`${model.habitsDone}`}
                total={`/${model.habitsTotal}`}
                pct={model.habitsTotal > 0 ? model.habitsDone / model.habitsTotal : 0}
                barColor="#2dd4bf"
              />
            </View>
          </View>
          <Card style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Text style={{ color: palette.text, fontSize: 14, fontWeight: "700" }}>This week</Text>
              </View>
              <Text style={{ color: palette.textDim, fontSize: 11.5 }}>avg {avgScore}% · Last 7 days</Text>
            </View>
            {/* Bar chart */}
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 92, marginTop: 14 }}>
              {model.week.map((d) => {
                const isToday = d.key === today;
                const h = Math.max(4, d.score);
                return (
                  <View key={d.key} style={{ flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center" }}>
                    {isToday ? (
                      <View
                        style={{
                          borderRadius: 999,
                          backgroundColor: palette.primary,
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          marginBottom: 5,
                        }}
                      >
                        <Text style={{ color: palette.onPrimary, fontSize: 9, fontWeight: "800" }}>{d.score}</Text>
                      </View>
                    ) : null}
                    <View
                      style={{
                        width: "100%",
                        borderRadius: 6,
                        height: `${h}%`,
                        backgroundColor: isToday ? palette.primary : d.score > 0 ? palette.primaryDim : palette.cardAlt,
                      }}
                    />
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
              {model.week.map((d) => {
                const dt = new Date(`${d.key}T12:00:00`);
                const letter = ["S", "M", "T", "W", "T", "F", "S"][dt.getDay()];
                return (
                  <Text
                    key={d.key}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      fontSize: 10,
                      fontWeight: "700",
                      color: d.key === today ? palette.primary : palette.textFaint,
                    }}
                  >
                    {letter}
                  </Text>
                );
              })}
            </View>
          </Card>

          {/* Overdue banner */}
          {model.overdueCount > 0 ? (
            <Pressable
              onPress={() => navigation.navigate("Main", { screen: "Tasks" })}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: palette.dangerSoft,
                backgroundColor: palette.dangerSoft,
                paddingHorizontal: 14,
                paddingVertical: 12,
                marginBottom: 12,
              }}
            >
              <Ionicons name="warning" size={19} color={palette.danger} />
              <Text style={{ color: palette.danger, fontSize: 13.5, fontWeight: "700", flex: 1 }}>
                You have {model.overdueCount} overdue task{model.overdueCount === 1 ? "" : "s"}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={palette.danger} />
            </Pressable>
          ) : null}

          {/* Today's focus */}
          <SectionHeading title="Today's focus" action={<SeeAll onPress={() => navigation.navigate("Main", { screen: "Tasks" })} />} />
          {model.upcoming.length === 0 ? (
            <EmptyNote text="Nothing due in the next week — enjoy the breathing room." />
          ) : (
            <Card style={{ paddingVertical: 4, paddingHorizontal: 0 }}>
              {model.upcoming.slice(0, 6).map((t) => (
                <FocusRow
                  key={t.id}
                  todo={t}
                  palette={palette}
                  onToggle={() => toggleTodo(t.id, !t.completed)}
                  onOpen={() => {
                    setEditingId(t.id);
                    setEditorOpen(true);
                  }}
                  isLast={model.upcoming.slice(0, 6).indexOf(t) === Math.min(5, model.upcoming.length - 1)}
                />
              ))}
            </Card>
          )}

          {/* Habits today */}
          <SectionHeading title="Habits today" action={<SeeAll onPress={() => navigation.navigate("Main", { screen: "Routine" })} />} />
          {model.habits.length === 0 ? (
            <EmptyNote text="No habits yet — build momentum with one small daily win." />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 8, paddingBottom: 4 }}
              style={{ marginHorizontal: -16, paddingHorizontal: 16 }}
            >
              {model.habits.map((h) => (
                <Pressable
                  key={h.id}
                  onPress={() => toggleHabit(h.id)}
                  style={{
                    width: 138,
                    marginRight: 10,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: h.doneToday ? accentColor(h.color) : palette.border,
                    backgroundColor: h.doneToday ? `${accentColor(h.color)}18` : palette.card,
                    padding: 12,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 20 }}>{h.emoji}</Text>
                    <View
                      style={{
                        width: 21,
                        height: 21,
                        borderRadius: 999,
                        borderWidth: 2,
                        borderColor: h.doneToday ? palette.primary : palette.border,
                        backgroundColor: h.doneToday ? palette.primary : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {h.doneToday ? <Ionicons name="checkmark" size={12} color={palette.onPrimary} strokeWidth={3} /> : null}
                    </View>
                  </View>
                  <Text style={{ color: palette.text, fontSize: 12.5, fontWeight: "600", marginTop: 8, minHeight: 32, lineHeight: 16 }}>
                    {h.name}
                  </Text>
                  <View style={{ marginTop: 8 }}>
                    <WeekDots days={weekDays} doneSet={new Set(h.last7DoneSet)} size={7} />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Active goals */}
          <SectionHeading title="Active goals" action={<SeeAll onPress={() => navigation.navigate("Main", { screen: "Goals" })} />} />
          {model.activeGoals.length === 0 ? (
            <EmptyNote text="No active goals — set one to give your days direction." />
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 2 }}>
              {model.activeGoals.slice(0, 4).map((g) => {
                const pct = g.target > 0 ? Math.round((g.progress / g.target) * 100) : 0;
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => navigation.navigate("Main", { screen: "Goals" })}
                    style={{
                      width: "48.2%",
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: palette.border,
                      backgroundColor: palette.card,
                      padding: 14,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                      <Text style={{ color: palette.text, fontSize: 13.5, fontWeight: "700", flex: 1 }} numberOfLines={1}>
                        {g.title}
                      </Text>
                      <View
                        style={{
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: palette.border,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ color: palette.textDim, fontSize: 9.5, fontWeight: "600", textTransform: "capitalize" }}>
                          {g.period}
                        </Text>
                      </View>
                    </View>
                    <View style={{ marginTop: 12 }}>
                      <Bar value={g.progress} max={g.target} color={palette.primary} height={7} />
                    </View>
                    <Text style={{ color: palette.textDim, fontSize: 11.5, marginTop: 6 }}>
                      <Text style={{ color: palette.text, fontWeight: "700" }}>{g.progress}</Text>/{g.target}
                      {g.unit ? ` ${g.unit}` : ""} · {pct}%
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Recent journal */}
          <SectionHeading title="Recent journal" action={<SeeAll label="Open diary" onPress={() => navigation.navigate("Diary")} />} />
          {model.recentJournal.length === 0 ? (
            <EmptyNote text="No entries yet — tonight is a good night to write." />
          ) : (
            <Card style={{ paddingVertical: 4, paddingHorizontal: 0 }}>
              {model.recentJournal.map((entry, i) => {
                const mood = MOODS.find((m) => m.key === entry.mood);
                return (
                  <Pressable
                    key={entry.id}
                    onPress={() => navigation.navigate("Diary")}
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: palette.border,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        backgroundColor: palette.cardAlt,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 17 }}>{mood ? mood.emoji : "📖"}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 11 }}>
                      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                        <Text style={{ color: palette.text, fontSize: 13.5, fontWeight: "700" }} numberOfLines={1}>
                          {entry.title || "Journal entry"}
                        </Text>
                        <Text style={{ color: palette.textFaint, fontSize: 11 }}>{relativeDay(entry.date)}</Text>
                      </View>
                      <Text style={{ color: palette.textDim, fontSize: 12, lineHeight: 17, marginTop: 2 }} numberOfLines={2}>
                        {entry.content || "—"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </Card>
          )}

          {/* Focus minutes footer stat */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 18 }}>
            <Ionicons name="timer-outline" size={14} color={palette.primary} />
            <Text style={{ color: palette.textDim, fontSize: 12.5, fontWeight: "600" }}>
              {minutesToClock(model.focusMinutesToday)} focused today
            </Text>
            <Text style={{ color: palette.textFaint }}>·</Text>
            <Pressable onPress={() => navigation.navigate("Focus")}>
              <Text style={{ color: palette.primary, fontSize: 12.5, fontWeight: "700" }}>Start a session</Text>
            </Pressable>
          </View>
        </>
      )}

      <TaskEditorSheet visible={editorOpen} todoId={editingId} onClose={() => setEditorOpen(false)} />
    </Screen>
  );
}

function QuoteCard({ palette, text, author }: { palette: Palette; text: string; author: string }) {
  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            backgroundColor: palette.primarySoft,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Ionicons name="sparkles" size={19} color={palette.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: palette.text, fontSize: 13.5, fontWeight: "500", lineHeight: 20 }}>
            “{text}”
          </Text>
          <Text style={{ color: palette.textDim, fontSize: 12, fontWeight: "600", marginTop: 6 }}>— {author}</Text>
        </View>
      </View>
    </Card>
  );
}

function StatMini({
  palette,
  label,
  icon,
  iconColor,
  value,
  total,
  pct,
  barColor,
}: {
  palette: Palette;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  value: string;
  total: string;
  pct: number;
  barColor: string;
}) {
  return (
    <Card style={{ marginBottom: 0, paddingVertical: 13 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text
          style={{
            color: palette.textDim,
            fontSize: 10.5,
            fontWeight: "700",
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        <Ionicons name={icon} size={15} color={iconColor} />
      </View>
      <Text style={{ color: palette.text, fontSize: 22, fontWeight: "800", marginTop: 6 }}>
        {value}
        <Text style={{ color: palette.textFaint, fontSize: 14, fontWeight: "700" }}>{total}</Text>
      </Text>
      <View style={{ marginTop: 8 }}>
        <Bar value={pct * 100} max={100} color={barColor} height={6} />
      </View>
    </Card>
  );
}

function FocusRow({
  todo,
  palette,
  onToggle,
  onOpen,
  isLast,
}: {
  todo: data.Todo;
  palette: Palette;
  onToggle: () => void;
  onOpen: () => void;
  isLast: boolean;
}) {
  const done = !!todo.completed;
  const due = todo.dueDate ? new Date(todo.dueDate) : null;
  const showTime = due ? due.getHours() + due.getMinutes() > 0 : false;
  const overdue = !done && todo.dueDate ? dayKey(todo.dueDate) < dayKey() : false;
  const subs = data.subtasksOf(todo.id);
  const subsDone = subs.filter((s) => s.completed).length;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderTopWidth: 0,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: palette.border,
      }}
    >
      <Pressable onPress={onToggle} hitSlop={7} style={{ padding: 2 }}>
        <View
          style={{
            width: 23,
            height: 23,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: done ? palette.primary : palette.border,
            backgroundColor: done ? palette.primary : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {done ? <Ionicons name="checkmark" size={14} color={palette.onPrimary} /> : null}
        </View>
      </Pressable>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          backgroundColor: PRIORITY_COLORS[todo.priority] ?? PRIORITY_COLORS.low,
          marginLeft: 10,
        }}
      />
      <Pressable onPress={onOpen} style={{ flex: 1, marginLeft: 9 }}>
        <Text
          numberOfLines={1}
          style={{
            color: done ? palette.textFaint : palette.text,
            fontSize: 14,
            fontWeight: "600",
            textDecorationLine: done ? "line-through" : "none",
          }}
        >
          {todo.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 1 }}>
          {subs.length > 0 ? (
            <Text style={{ color: palette.textDim, fontSize: 11, fontWeight: "600" }}>
              ☑ {subsDone}/{subs.length}
            </Text>
          ) : null}
          {todo.dueDate ? (
            <Text
              style={{
                color: overdue ? palette.danger : palette.textDim,
                fontSize: 11.5,
                fontWeight: "500",
              }}
            >
              {relativeDay(dayKey(todo.dueDate))}
              {showTime ? ` · ${formatTime(todo.dueDate)}` : ""}
            </Text>
          ) : null}
          {todo.repeat !== "none" ? <Ionicons name="repeat" size={11} color={palette.textDim} /> : null}
        </View>
      </Pressable>
    </View>
  );
}
