// Routine — habits with streaks + the structured morning/afternoon/evening schedule.

import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

import * as data from "../db";
import { useApp, bumpData } from "../store";
import { scheduleSync } from "../sync";
import { toast } from "../toast";
import {
  Bar,
  Btn,
  Card,
  Chip,
  EmptyState,
  Fab,
  FieldLabel,
  Input,
  OfflinePill,
  SectionHeading,
  Segmented,
  Sheet,
  usePalette,
} from "../components/ui";
import { accentColor, ACCENTS, type Palette } from "../theme";
import { addDaysKey, dayKey, isoWeekday } from "../utils";

const EMOJIS = ["✅", "📚", "🏃", "💧", "🧘", "💪", "🌱", "☀️", "🥗", "😴", "✍️", "🎸", "💻", "🎨", "🧹", "📵"];
const SECTIONS = ["morning", "afternoon", "evening"];
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export default function RoutineScreen() {
  const { palette } = usePalette();
  const version = useApp((s) => s.dataVersion);
  const [tab, setTab] = useState<"habits" | "schedule">("habits");
  const [selectedDay, setSelectedDay] = useState(dayKey());
  const [habitEditor, setHabitEditor] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [routineEditor, setRoutineEditor] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const habits = useMemo(
    () => data.habits(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
  const routineTasks = useMemo(
    () => data.routineForDay(selectedDay),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, selectedDay],
  );

  const doneCount = routineTasks.filter((t) => t.applies && t.done).length;
  const appliesCount = routineTasks.filter((t) => t.applies).length;

  const weekStrip = useMemo(() => {
    const out: { key: string; label: string; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const key = addDaysKey(dayKey(), -i);
      const d = new Date(`${key}T12:00:00`);
      out.push({ key, label: DAY_LABELS[isoWeekday(d) - 1], isToday: i === 0 });
    }
    return out;
  }, []);

  const toggleHabit = (id: string) => {
    data.toggleHabit(id, dayKey());
    bumpData();
    scheduleSync();
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        <View style={{ paddingTop: 8, paddingBottom: 12 }}>
          <Text style={{ color: palette.text, fontSize: 23, fontWeight: "800", letterSpacing: -0.4 }}>Daily Routine</Text>
          <Text style={{ color: palette.textDim, fontSize: 13.5, marginTop: 3 }}>Build consistency, one day at a time</Text>
        </View>
        <OfflinePill />
        <Segmented
          value={tab}
          onChange={(k) => setTab(k as "habits" | "schedule")}
          options={[
            { key: "habits", label: "Habits" },
            { key: "schedule", label: "Daily schedule" },
          ]}
        />
        <View style={{ height: 12 }} />

      {tab === "habits" ? (
        <View>
          {habits.length === 0 ? (
            <Card style={{ marginTop: 4 }}>
              <EmptyState
                icon="repeat-outline"
                title="No habits yet"
                hint="Add your first habit and start a streak today."
                action={<Btn label="Add habit" icon="add" onPress={() => setHabitEditor({ open: true, id: null })} />}
              />
            </Card>
          ) : (
            habits.map((h) => (
              <Card key={h.id}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Pressable
                    onPress={() => toggleHabit(h.id)}
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 15,
                      borderWidth: 2,
                      borderColor: h.doneToday ? accentColor(h.color) : palette.border,
                      backgroundColor: h.doneToday ? accentColor(h.color) : palette.cardAlt,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{h.emoji}</Text>
                  </Pressable>
                  <Pressable style={{ flex: 1, marginLeft: 13 }} onPress={() => setHabitEditor({ open: true, id: h.id })}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={{ fontSize: 15.5, fontWeight: "700", color: palette.text, flex: 1 }} numberOfLines={1}>
                        {h.name}
                      </Text>
                      <Text style={{ fontSize: 13, color: palette.warn, fontWeight: "700" }}>{h.streak}🔥</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: palette.textFaint, marginTop: 2 }}>
                      {h.total} all-time · {titleCase(h.timeOfDay)}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 4, marginTop: 8 }}>
                      {h.last7.map((ok, i) => (
                        <View
                          key={i}
                          style={{
                            flex: 1,
                            height: 9,
                            borderRadius: 4,
                            backgroundColor: ok ? accentColor(h.color) : palette.cardAlt,
                          }}
                        />
                      ))}
                    </View>
                  </Pressable>
                </View>
                {h.doneToday ? (
                  <Text style={{ color: accentColor(h.color), fontSize: 12, fontWeight: "700", marginTop: 10 }}>
                    Done today ✓ — streak safe
                  </Text>
                ) : null}
              </Card>
            ))
          )}
        </View>
      ) : (
        <View>
          {/* Week strip */}
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
            {weekStrip.map((d) => (
              <Pressable
                key={d.key}
                onPress={() => setSelectedDay(d.key)}
                style={{
                  flex: 1,
                  alignItems: "center",
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: d.key === selectedDay ? palette.primary : palette.card,
                  borderColor: d.isToday && d.key !== selectedDay ? palette.primary : palette.border,
                  borderWidth: 1,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: d.key === selectedDay ? palette.onPrimary : palette.textFaint }}>
                  {d.label}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "800", color: d.key === selectedDay ? palette.onPrimary : palette.text, marginTop: 1 }}>
                  {new Date(`${d.key}T12:00:00`).getDate()}
                </Text>
              </Pressable>
            ))}
          </View>

          <Card style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: palette.text, fontSize: 14, fontWeight: "700" }}>
                {doneCount}/{appliesCount} done
              </Text>
              <Text style={{ color: palette.textDim, fontSize: 13 }}>
                {doneCount === appliesCount && appliesCount > 0 ? "Perfect day 🏆" : "Keep going"}
              </Text>
            </View>
            <Bar value={doneCount} max={Math.max(1, appliesCount)} color={palette.primary} />
          </Card>

          {SECTIONS.map((section) => {
            const rows = routineTasks.filter((t) => t.section === section && t.applies);
            if (rows.length === 0) return null;
            return (
              <View key={section}>
                <SectionHeading
                  title={section === "morning" ? "🌅 Morning" : section === "afternoon" ? "🌤 Afternoon" : "🌙 Evening"}
                />
                {rows.map((t) => (
                  <RoutineRow
                    key={t.id}
                    task={t}
                    palette={palette}
                    onToggle={() => {
                      data.toggleRoutineTask(t.id, selectedDay);
                      bumpData();
                      scheduleSync();
                    }}
                    onOpen={() => setRoutineEditor({ open: true, id: t.id })}
                  />
                ))}
              </View>
            );
          })}

          {routineTasks.filter((t) => t.applies).length === 0 ? (
            <Card>
              <EmptyState
                icon="calendar-outline"
                title="Nothing scheduled"
                hint="Design your ideal day — add routine blocks."
                action={<Btn label="Add block" icon="add" onPress={() => setRoutineEditor({ open: true, id: null })} />}
              />
            </Card>
          ) : null}
        </View>
      )}
      </ScrollView>

      <Fab onPress={() => (tab === "habits" ? setHabitEditor({ open: true, id: null }) : setRoutineEditor({ open: true, id: null }))} />

      <HabitEditorSheet
        visible={habitEditor.open}
        habitId={habitEditor.id}
        onClose={() => setHabitEditor({ open: false, id: null })}
      />
      <RoutineEditorSheet
        visible={routineEditor.open}
        taskId={routineEditor.id}
        onClose={() => setRoutineEditor({ open: false, id: null })}
      />
    </View>
  );
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function RoutineRow({
  task,
  palette,
  onToggle,
  onOpen,
}: {
  task: data.RoutineTaskWithDone;
  palette: Palette;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <View
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
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          borderWidth: 2,
          borderColor: task.done ? palette.primary : palette.border,
          backgroundColor: task.done ? palette.primary : "transparent",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        {task.done ? <Ionicons name="checkmark" size={17} color={palette.onPrimary} /> : null}
      </Pressable>
      <Pressable style={{ flex: 1 }} onPress={onOpen}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontSize: 16, marginRight: 8 }}>{task.emoji}</Text>
          <Text style={{ fontSize: 15, fontWeight: "600", color: palette.text, flex: 1 }} numberOfLines={1}>
            {task.name}
          </Text>
          {task.time ? (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="time-outline" size={12} color={palette.textFaint} />
              <Text style={{ fontSize: 12, color: palette.textDim, marginLeft: 3 }}>{task.time}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ fontSize: 11.5, color: palette.textFaint, marginTop: 2 }}>
          {task.days.split(",").length === 7 ? "Every day" : task.days}
        </Text>
      </Pressable>
    </View>
  );
}

// ── Habit editor ─────────────────────────────────────────────

function HabitEditorSheet({ visible, habitId, onClose }: { visible: boolean; habitId: string | null; onClose: () => void }) {
  const { palette } = usePalette();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("✅");
  const [color, setColor] = useState("emerald");
  const [timeOfDay, setTimeOfDay] = useState("anytime");
  const [loaded, setLoaded] = useState<string | null | undefined>(undefined);

  React.useEffect(() => {
    if (!visible) return;
    if (loaded === habitId) return;
    setLoaded(habitId);
    if (habitId) {
      const rows = data.habits(true);
      const h = rows.find((x) => x.id === habitId);
      if (h) {
        setName(h.name);
        setEmoji(h.emoji);
        setColor(h.color);
        setTimeOfDay(h.timeOfDay);
        return;
      }
    }
    setName("");
    setEmoji("✅");
    setColor("emerald");
    setTimeOfDay("anytime");
  }, [visible, habitId, loaded]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    data.saveHabit(habitId, { name: trimmed, emoji, color, timeOfDay });
    bumpData();
    scheduleSync();
    toast.success(habitId ? "Habit updated" : "Habit started — day one of the streak");
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={habitId ? "Edit habit" : "New habit"}
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
          {habitId ? (
            <Btn
              label="Delete"
              variant="danger"
              icon="trash-outline"
              small
              onPress={() => {
                data.softDelete("habits", habitId);
                bumpData();
                scheduleSync();
                onClose();
              }}
              style={{ flex: 1 }}
            />
          ) : null}
          <Btn label={habitId ? "Save habit" : "Start habit"} icon="checkmark" onPress={save} style={{ flex: 2 }} />
        </View>
      }
    >
      <Input value={name} onChangeText={setName} placeholder="e.g. Read 10 pages" autoFocus={!habitId} onSubmitEditing={save} />

      <FieldLabel>Icon</FieldLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {EMOJIS.map((e) => (
          <Pressable
            key={e}
            onPress={() => setEmoji(e)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              marginRight: 8,
              marginBottom: 8,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: emoji === e ? palette.primarySoft : palette.cardAlt,
              borderColor: emoji === e ? palette.primary : palette.border,
              borderWidth: 1,
            }}
          >
            <Text style={{ fontSize: 20 }}>{e}</Text>
          </Pressable>
        ))}
      </View>

      <FieldLabel>Color</FieldLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {Object.entries(ACCENTS).map(([key, hex]) => (
          <Pressable
            key={key}
            onPress={() => setColor(key)}
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              backgroundColor: hex,
              marginRight: 10,
              marginBottom: 10,
              borderWidth: 3,
              borderColor: color === key ? palette.text : "transparent",
            }}
          />
        ))}
      </View>

      <FieldLabel>Time of day</FieldLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {["morning", "afternoon", "evening", "anytime"].map((t) => (
          <Chip key={t} label={titleCase(t)} active={timeOfDay === t} onPress={() => setTimeOfDay(t)} />
        ))}
      </View>
    </Sheet>
  );
}

// ── Routine block editor ─────────────────────────────────────

function RoutineEditorSheet({ visible, taskId, onClose }: { visible: boolean; taskId: string | null; onClose: () => void }) {
  const { palette } = usePalette();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🌅");
  const [section, setSection] = useState("morning");
  const [time, setTime] = useState<string | null>(null);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [showTime, setShowTime] = useState(false);
  const [loaded, setLoaded] = useState<string | null | undefined>(undefined);

  React.useEffect(() => {
    if (!visible) return;
    if (loaded === taskId) return;
    setLoaded(taskId);
    if (taskId) {
      const rows = data.routineForDay(dayKey());
      const all = rows.find((x) => x.id === taskId);
      if (all) {
        setName(all.name);
        setEmoji(all.emoji);
        setSection(all.section);
        setTime(all.time);
        setDays(all.days.split(",").map((d) => parseInt(d, 10)).filter((n) => n >= 1 && n <= 7));
        return;
      }
    }
    setName("");
    setEmoji("🌅");
    setSection("morning");
    setTime(null);
    setDays([1, 2, 3, 4, 5, 6, 7]);
  }, [visible, taskId, loaded]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const dayStr = (days.length === 0 ? [1, 2, 3, 4, 5, 6, 7] : days).sort().join(",");
    data.saveRoutineTask(taskId, { name: trimmed, emoji, section, time, days: dayStr });
    bumpData();
    scheduleSync();
    toast.success(taskId ? "Block updated" : "Block added");
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={taskId ? "Edit block" : "New routine block"}
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
          {taskId ? (
            <Btn
              label="Delete"
              variant="danger"
              icon="trash-outline"
              small
              onPress={() => {
                data.softDelete("routineTasks", taskId);
                bumpData();
                scheduleSync();
                onClose();
              }}
              style={{ flex: 1 }}
            />
          ) : null}
          <Btn label={taskId ? "Save block" : "Add block"} icon="checkmark" onPress={save} style={{ flex: 2 }} />
        </View>
      }
    >
      <Input value={name} onChangeText={setName} placeholder="e.g. Deep work block" autoFocus={!taskId} onSubmitEditing={save} />

      <FieldLabel>Icon</FieldLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
        {["🌅", "☕️", "🧘", "📚", "💻", "🏃", "🥗", "😴", "✍️", "🎧", "📞", "🛁"].map((e) => (
          <Pressable
            key={e}
            onPress={() => setEmoji(e)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              marginRight: 8,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: emoji === e ? palette.primarySoft : palette.cardAlt,
              borderColor: emoji === e ? palette.primary : palette.border,
              borderWidth: 1,
            }}
          >
            <Text style={{ fontSize: 20 }}>{e}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <FieldLabel>Section</FieldLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {SECTIONS.map((s) => (
          <Chip key={s} label={titleCase(s)} active={section === s} onPress={() => setSection(s)} />
        ))}
      </View>

      <FieldLabel>Time (optional)</FieldLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        <Chip label={time ?? "No time"} active={!!time} onPress={() => setShowTime(true)} />
        {time ? <Chip label="Clear" onPress={() => setTime(null)} /> : null}
      </View>
      {showTime ? (
        <DateTimePickerInline onPick={(t) => { setTime(t); setShowTime(false); }} onCancel={() => setShowTime(false)} />
      ) : null}

      <FieldLabel>Days</FieldLabel>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {DAY_LABELS.map((label, i) => {
          const dayNum = i + 1;
          const on = days.includes(dayNum);
          return (
            <Pressable
              key={i}
              onPress={() => setDays(on ? days.filter((d) => d !== dayNum) : [...days, dayNum])}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: on ? palette.primary : palette.cardAlt,
                borderColor: palette.border,
                borderWidth: 1,
              }}
            >
              <Text style={{ fontWeight: "700", color: on ? palette.onPrimary : palette.textDim }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

function DateTimePickerInline({ onPick, onCancel }: { onPick: (time: string) => void; onCancel: () => void }) {
  const base = new Date();
  base.setHours(8, 0, 0, 0);
  return (
    <DateTimePicker
      value={base}
      mode="time"
      display="default"
      is24Hour={false}
      onChange={(_e, d) => {
        if (d) {
          const h = d.getHours();
          const m = d.getMinutes();
          onPick(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        } else {
          onCancel();
        }
      }}
    />
  );
}
