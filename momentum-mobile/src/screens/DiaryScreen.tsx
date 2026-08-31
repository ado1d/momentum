// Diary — one entry per day: mood, energy, gratitude, free writing.
// Recent entries open in a beautiful READ view first ("Edit entry" loads
// it into the editor) — mirrors the web app's journal reader dialog.

import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
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
  RichTextEditor,
  SectionHeading,
  StackHeader,
  usePalette,
} from "../components/ui";
import { MiniMarkdown, markdownToPlain } from "../components/mini-md";
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
  const [reader, setReader] = useState<string | null>(null);

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

  const moodEmoji = (key: string | null) =>
    MOODS.find((m) => m.key === key)?.emoji ?? "📝";
  const moodInfo = (key: string | null) => MOODS.find((m) => m.key === key);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <StackHeader
        title="Daily Diary"
        subtitle="Reflect, learn, grow"
        right={
          entry ? (
            <Pressable
              onPress={() => setReader(entry.id)}
              hitSlop={8}
              style={{
                padding: 8,
                borderRadius: 12,
                backgroundColor: palette.primarySoft,
                marginRight: 4,
              }}
            >
              <Ionicons name="eye-outline" size={19} color={palette.primary} />
            </Pressable>
          ) : null
        }
      />
      <OfflinePill />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      >
        {/* Date stepper */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <Pressable
            onPress={() => setDate(addDaysKey(date, -1))}
            style={{
              padding: 8,
              borderRadius: 10,
              backgroundColor: palette.cardAlt,
            }}
          >
            <Ionicons name="chevron-back" size={18} color={palette.textDim} />
          </Pressable>
          <Pressable
            style={{ flex: 1, alignItems: "center" }}
            onPress={() => setDate(dayKey())}
          >
            <Text
              style={{ fontSize: 16, fontWeight: "800", color: palette.text }}
            >
              {isToday(date) ? "Today" : relativeDay(date)}
            </Text>
            <Text style={{ fontSize: 12, color: palette.textDim }}>
              {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              !isFuture(addDaysKey(date, 1)) && setDate(addDaysKey(date, 1))
            }
            style={{
              padding: 8,
              borderRadius: 10,
              backgroundColor: palette.cardAlt,
              opacity: isFuture(addDaysKey(date, 1)) ? 0.3 : 1,
            }}
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={palette.textDim}
            />
          </Pressable>
        </View>

        <Card>
          <FieldLabel>Mood</FieldLabel>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
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
                  <Text
                    style={{
                      fontSize: 10.5,
                      fontWeight: "600",
                      color: active ? m.color : palette.textFaint,
                      marginTop: 3,
                    }}
                  >
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
                  backgroundColor:
                    (energy ?? 0) >= n ? palette.primarySoft : palette.cardAlt,
                  borderWidth: 1.5,
                  borderColor: energy === n ? palette.primary : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color:
                      (energy ?? 0) >= n ? palette.primary : palette.textFaint,
                    fontWeight: "700",
                  }}
                >
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>

          <FieldLabel>Grateful for</FieldLabel>
          <Input
            value={gratitude}
            onChangeText={setGratitude}
            placeholder="One good thing…"
            darkBg
          />

          <FieldLabel>Entry</FieldLabel>
          <RichTextEditor
            value={content}
            onChangeText={setContent}
            placeholder="How was your day?"
            minHeight={170}
          />
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="Title (optional)"
            style={{ marginTop: 10 }}
            darkBg
          />

          <View style={{ marginTop: 14 }}>
            <Btn
              label={saved ? "Saved ✓" : entry ? "Update entry" : "Save entry"}
              icon={saved ? "checkmark-circle" : "save-outline"}
              onPress={save}
            />
          </View>
        </Card>

        <SectionHeading title="Recent entries" />
        {recent.length === 0 ? (
          <Card>
            <EmptyState
              icon="book-outline"
              title="Your diary starts today"
              hint="Write the first page — future-you will thank you."
            />
          </Card>
        ) : (
          recent
            .filter((e) => e.date !== date)
            .map((e) => (
              <Card key={e.id} onPress={() => setReader(e.id)}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ fontSize: 22, marginRight: 12 }}>
                    {moodEmoji(e.mood)}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14.5,
                        fontWeight: "700",
                        color: palette.text,
                      }}
                      numberOfLines={1}
                    >
                      {e.title || relativeDay(e.date)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: palette.textFaint,
                        marginTop: 2,
                      }}
                      numberOfLines={2}
                    >
                      {e.content ? markdownToPlain(e.content) : "—"}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={palette.textFaint}
                  />
                </View>
              </Card>
            ))
        )}
      </ScrollView>

      <DiaryReaderSheet
        entryId={reader}
        onClose={() => setReader(null)}
        onEdit={(d) => {
          setReader(null);
          setTimeout(() => setDate(d), 200);
        }}
      />
    </View>
  );
}

// ── Read-mode sheet (mirrors the web journal reader) ──────────

function DiaryReaderSheet({
  entryId,
  onClose,
  onEdit,
}: {
  entryId: string | null;
  onClose: () => void;
  onEdit: (date: string) => void;
}) {
  const { palette } = usePalette();
  const version = useApp((s) => s.dataVersion);

  const [lastId, setLastId] = React.useState<string | null>(null);
  if (entryId && entryId !== lastId) setLastId(entryId);
  const visible = entryId !== null;
  const shownId = entryId ?? lastId;

  const entry = useMemo(() => {
    if (!shownId) return null;
    const all = data.journalList(120);
    return all.find((e) => e.id === shownId) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownId, version]);

  if (!entry) return null;

  const mood = MOODS.find((m) => m.key === entry.mood);
  const words = entry.content.trim()
    ? entry.content.trim().split(/\s+/).length
    : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      transparent
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(4,6,12,0.6)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
          onPress={onClose}
        />
        <View
          style={{
            backgroundColor: palette.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: palette.border,
            maxHeight: "92%",
          }}
        >
          {/* mood accent strip */}
          <View style={{ flexDirection: "row", height: 5 }}>
            {(mood
              ? [mood.color, mood.color, palette.primary]
              : [palette.primary, palette.primaryDim]
            ).map((c, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: c }} />
            ))}
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 14,
              paddingTop: 10,
              paddingBottom: 8,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "800",
                color: palette.textFaint,
                letterSpacing: 0.5,
              }}
            >
              DIARY ENTRY
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={{ padding: 6, borderRadius: 12 }}
            >
              <Ionicons name="close" size={22} color={palette.textDim} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 18,
                  backgroundColor: mood ? `${mood.color}26` : palette.cardAlt,
                  borderWidth: 1.5,
                  borderColor: mood ? mood.color : palette.border,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 13,
                }}
              >
                <Text style={{ fontSize: 26 }}>{mood?.emoji ?? "📝"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "800",
                    color: palette.text,
                    lineHeight: 26,
                  }}
                  numberOfLines={2}
                >
                  {entry.title || relativeDay(entry.date)}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: palette.textFaint,
                    marginTop: 3,
                  }}
                >
                  {relativeDay(entry.date)} ·{" "}
                  {new Date(`${entry.date}T12:00:00`).toLocaleDateString(
                    undefined,
                    { month: "short", day: "numeric", year: "numeric" },
                  )}
                </Text>
              </View>
            </View>

            {/* meta chips */}
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12 }}
            >
              {mood ? (
                <MetaChip
                  palette={palette}
                  icon="happy-outline"
                  label={`Mood: ${mood.label}`}
                  color={mood.color}
                />
              ) : null}
              {entry.energy ? (
                <MetaChip
                  palette={palette}
                  icon="battery-half-outline"
                  label={`Energy: ${entry.energy}/5`}
                />
              ) : null}
              {words > 0 ? (
                <MetaChip
                  palette={palette}
                  icon="document-text-outline"
                  label={`${words} ${words === 1 ? "word" : "words"}`}
                />
              ) : null}
            </View>

            <View
              style={{
                height: 1,
                backgroundColor: palette.border,
                marginTop: 16,
                marginBottom: 4,
              }}
            />

            {entry.content.trim() ? (
              <MiniMarkdown content={entry.content} palette={palette} />
            ) : (
              <Text
                style={{
                  color: palette.textFaint,
                  fontStyle: "italic",
                  fontSize: 14,
                  marginTop: 16,
                }}
              >
                No writing for this day — tap "Edit entry" to add some.
              </Text>
            )}

            {entry.gratitude ? (
              <View
                style={{
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: palette.border,
                  backgroundColor: palette.cardAlt,
                  paddingHorizontal: 13,
                  paddingVertical: 11,
                  marginTop: 18,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons
                    name="heart-outline"
                    size={13}
                    color={palette.warn}
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "800",
                      color: palette.textDim,
                      marginLeft: 5,
                      letterSpacing: 0.4,
                    }}
                  >
                    GRATEFUL FOR
                  </Text>
                </View>
                <Text
                  style={{
                    color: palette.text,
                    fontSize: 14,
                    lineHeight: 21,
                    marginTop: 7,
                  }}
                >
                  {entry.gratitude}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderTopWidth: 1,
              borderTopColor: palette.border,
              paddingHorizontal: 18,
              paddingVertical: 12,
              paddingBottom: 20,
              backgroundColor: palette.card,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                color: palette.textFaint,
                flex: 1,
                marginRight: 10,
              }}
              numberOfLines={1}
            >
              {entry.date === dayKey()
                ? "Today's entry"
                : `From ${relativeDay(entry.date).toLowerCase()}`}
            </Text>
            <Btn
              label="Edit entry"
              icon="pencil"
              small
              onPress={() => onEdit(entry.date)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MetaChip({
  palette,
  icon,
  label,
  color,
}: {
  palette: ReturnType<typeof usePalette>["palette"];
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 999,
        backgroundColor: color ? `${color}1f` : palette.cardAlt,
        borderWidth: 1,
        borderColor: color ?? palette.border,
        paddingHorizontal: 10,
        paddingVertical: 5,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Ionicons name={icon} size={12} color={color ?? palette.textDim} />
      <Text
        style={{
          fontSize: 11.5,
          fontWeight: "700",
          color: color ?? palette.textDim,
          marginLeft: 5,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
