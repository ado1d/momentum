// Global search — mirrors the web command palette's core: find anything
// (tasks, notes, journal) and jump straight to it.
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import * as data from "../db";
import { useApp } from "../store";
import { Input, StackHeader, usePalette } from "../components/ui";
import { dayKey, relativeDay } from "../utils";

export default function SearchScreen() {
  const { palette } = usePalette();
  const navigation = useNavigation<any>();
  const version = useApp((s) => s.dataVersion);
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return { todos: [], notes: [], journal: [] };
    const todos = data.allTodos().filter(
      (t) => t.title.toLowerCase().includes(query) || (t.notes ?? "").toLowerCase().includes(query),
    );
    const notes = data.notesList(q);
    const journal = data.journalList(60).filter(
      (j) =>
        (j.title ?? "").toLowerCase().includes(query) ||
        j.content.toLowerCase().includes(query) ||
        (j.gratitude ?? "").toLowerCase().includes(query),
    );
    return { todos: todos.slice(0, 8), notes: notes.slice(0, 8), journal: journal.slice(0, 5) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, version]);

  const total = results.todos.length + results.notes.length + results.journal.length;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <StackHeader title="Search" subtitle="Tasks, notes and journal entries" />
      <View style={{ padding: 16 }}>
        <Input
          value={q}
          onChangeText={setQ}
          placeholder="Search everything…"
          autoFocus
          returnKeyType="search"
        />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {q.trim() && total === 0 ? (
          <Text style={{ color: palette.textDim, textAlign: "center", paddingVertical: 30, fontSize: 13.5 }}>
            No matches for “{q.trim()}”
          </Text>
        ) : null}

        {results.todos.length > 0 ? (
          <Section palette={palette} label="Tasks" />
        ) : null}
        {results.todos.map((t) => (
          <Hit
            key={t.id}
            palette={palette}
            icon="checkbox-outline"
            title={t.title}
            sub={t.dueDate ? relativeDay(dayKey(t.dueDate)) : "No date"}
            onPress={() => navigation.replace("Main", { screen: "Tasks" } as never)}
          />
        ))}

        {results.notes.length > 0 ? <Section palette={palette} label="Notes" /> : null}
        {results.notes.map((n) => (
          <Hit
            key={n.id}
            palette={palette}
            icon="create-outline"
            title={n.title}
            sub={n.content.slice(0, 60) || "Empty note"}
            onPress={() => navigation.navigate("Notes")}
          />
        ))}

        {results.journal.length > 0 ? <Section palette={palette} label="Journal" /> : null}
        {results.journal.map((j) => (
          <Hit
            key={j.id}
            palette={palette}
            icon="book-outline"
            title={j.title || "Journal entry"}
            sub={`${relativeDay(j.date)} · ${j.content.slice(0, 60)}`}
            onPress={() => navigation.navigate("Diary")}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function Section({ palette, label }: { palette: ReturnType<typeof usePalette>["palette"]; label: string }) {
  return (
    <Text
      style={{
        color: palette.textDim,
        fontSize: 11.5,
        fontWeight: "700",
        letterSpacing: 0.9,
        textTransform: "uppercase",
        marginTop: 10,
        marginBottom: 8,
      }}
    >
      {label}
    </Text>
  );
}

function Hit({
  palette,
  icon,
  title,
  sub,
  onPress,
}: {
  palette: ReturnType<typeof usePalette>["palette"];
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  onPress: () => void;
}) {
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
          borderRadius: 14,
          paddingHorizontal: 13,
          paddingVertical: 11,
          marginBottom: 8,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Ionicons name={icon} size={18} color={palette.primary} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ color: palette.text, fontSize: 14, fontWeight: "700" }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ color: palette.textDim, fontSize: 11.5, marginTop: 1 }} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color={palette.textFaint} />
    </Pressable>
  );
}
