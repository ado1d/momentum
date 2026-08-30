// Diary — one entry per day: mood, energy, gratitude, free writing.

import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import * as data from "../db";
import { useApp, bumpData } from "../store";
import { scheduleSync } from "../sync";
import { toast } from "../toast";
import {
  Btn,
  Card,
  EmptyState,
  FieldLabel,
  Input,
  OfflinePill,
  SectionHeading,
  StackHeader,
  usePalette,
} from "../components/ui";
import { MOODS } from "../theme";
import { addDaysKey, dayKey, isFuture, isToday, relativeDay } from "../utils";

export default function DiaryScreen() {
  const { palette } = usePalette();
  const version = useApp((s) => s.dataVersion);
  const [date, setDate] = useState(dayKey());
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [gratitude, setGratitude] = useState("");
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const entry = useMemo(
    () => data.journalFor(date),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, date],
  );

  // Load the selected date into the editor (only when the date changes).
  React.useEffect(() => {
    if (loadedDate === date) return;
    setLoadedDate(date);
    const e = data.journalFor(date);
    setTitle(e?.title ?? "");
    setContent(e?.content ?? "");
    setMood(e?.mood ?? null);
    setEnergy(e?.energy ?? null);
    setGratitude(e?.gratitude ?? "");
    setSaved(false);
  }, [date, loadedDate]);

  const recent = useMemo(
    () => data.journalList(10),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const save = () => {
    data.saveJournal({
      date,
      title: title.trim() || null,
      content,
      mood,
      energy,
      gratitude: gratitude.trim() || null,
    });
    bumpData();
    scheduleSync();
    toast.success(entry ? "Diary updated" : "Diary saved");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const moodEmoji = (key: string | null) => MOODS.find((m) => m.key === key)?.emoji ?? "📝";

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <StackHeader title="Daily Diary" subtitle="Reflect, learn, grow" />
      <OfflinePill />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {/* Date stepper */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
          <Pressable
            onPress={() => setDate(addDaysKey(date, -1))}
            style={{ padding: 8, borderRadius: 10, backgroundColor: palette.cardAlt }}
          >
            <Ionicons name="chevron-back" size={18} color={palette.textDim} />
          </Pressable>
          <Pressable style={{ flex: 1, alignItems: "center" }} onPress={() => setDate(dayKey())}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: palette.text }}>
              {isToday(date) ? "Today" : relativeDay(date)}
            </Text>
            <Text style={{ fontSize: 12, color: palette.textDim }}>
              {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => !isFuture(addDaysKey(date, 1)) && setDate(addDaysKey(date, 1))}
            style={{ padding: 8, borderRadius: 10, backgroundColor: palette.cardAlt, opacity: isFuture(addDaysKey(date, 1)) ? 0.3 : 1 }}
          >
            <Ionicons name="chevron-forward" size={18} color={palette.textDim} />
          </Pressable>
        </View>

        <Card>
          <FieldLabel>Mood</FieldLabel>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {MOODS.map((m) => {
              const active = mood === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setMood(active ? null : m.key)}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: 10,
                    borderRadius: 14,
                    marginHorizontal: 3,
                    backgroundColor: active ? `${m.color}26` : "transparent",
                    borderWidth: 1.5,
                    borderColor: active ? m.color : "transparent",
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
                  <Text style={{ fontSize: 10.5, fontWeight: "600", color: active ? m.color : palette.textFaint, marginTop: 3 }}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <FieldLabel>Energy</FieldLabel>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                onPress={() => setEnergy(energy === n ? null : n)}
                style={{
                  width: 46,
                  height: 38,
                  borderRadius: 11,
                  marginRight: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: (energy ?? 0) >= n ? palette.primarySoft : palette.cardAlt,
                  borderWidth: 1.5,
                  borderColor: energy === n ? palette.primary : "transparent",
                }}
              >
                <Text style={{ fontSize: 16, color: (energy ?? 0) >= n ? palette.primary : palette.textFaint, fontWeight: "700" }}>
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>

          <FieldLabel>Grateful for</FieldLabel>
          <Input value={gratitude} onChangeText={setGratitude} placeholder="One good thing…" darkBg />

          <FieldLabel>Entry</FieldLabel>
          <Input
            value={content}
            onChangeText={setContent}
            placeholder="How was your day?"
            multiline
            style={{ minHeight: 170 }}
          />
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="Title (optional)"
            style={{ marginTop: 10 }}
            darkBg
          />

          <View style={{ marginTop: 14 }}>
            <Btn label={saved ? "Saved ✓" : entry ? "Update entry" : "Save entry"} icon={saved ? "checkmark-circle" : "save-outline"} onPress={save} />
          </View>
        </Card>

        <SectionHeading title="Recent entries" />
        {recent.length === 0 ? (
          <Card>
            <EmptyState icon="book-outline" title="Your diary starts today" hint="Write the first page — future-you will thank you." />
          </Card>
        ) : (
          recent
            .filter((e) => e.date !== date)
            .map((e) => (
              <Card key={e.id} onPress={() => setDate(e.date)}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ fontSize: 22, marginRight: 12 }}>{moodEmoji(e.mood)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: "700", color: palette.text }} numberOfLines={1}>
                      {e.title || relativeDay(e.date)}
                    </Text>
                    <Text style={{ fontSize: 12, color: palette.textFaint, marginTop: 2 }} numberOfLines={2}>
                      {e.content || "—"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={palette.textFaint} />
                </View>
              </Card>
            ))
        )}
      </ScrollView>
    </View>
  );
}
