// Notes — searchable note cards with colors and pinning.

import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import * as data from "../db";
import { useApp, bumpData } from "../store";
import { scheduleSync } from "../sync";
import {
  Btn,
  Card,
  Chip,
  EmptyState,
  Fab,
  FieldLabel,
  Input,
  OfflinePill,
  Screen,
  ScreenHeader,
  SectionTitle,
  Sheet,
  usePalette,
} from "../components/ui";
import { NOTE_COLORS } from "../theme";
import { formatDateShort } from "../utils";

export default function NotesScreen() {
  const { palette, dark } = usePalette();
  const navigation = useNavigation<any>();
  const version = useApp((s) => s.dataVersion);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const notes = useMemo(
    () => data.notesList(search),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, search],
  );
  const pinned = notes.filter((n) => n.pinned);
  const rest = notes.filter((n) => !n.pinned);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScreenHeader
        title="Notes"
        subtitle={`${notes.length} ${notes.length === 1 ? "note" : "notes"}`}
        right={
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 6 }}>
            <Ionicons name="arrow-back" size={22} color={palette.primary} />
          </Pressable>
        }
      />
      <OfflinePill />

      <View style={{ paddingHorizontal: 16 }}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search notes…"
          darkBg
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
        {notes.length === 0 ? (
          <Card style={{ marginTop: 8 }}>
            <EmptyState
              icon="create-outline"
              title={search ? "No matches" : "No notes yet"}
              hint={search ? "Try a different search." : "Capture ideas before they escape."}
              action={search ? undefined : <Btn label="New note" icon="add" onPress={() => setEditor({ open: true, id: null })} />}
            />
          </Card>
        ) : null}

        {pinned.length > 0 ? (
          <>
            <SectionTitle>Pinned</SectionTitle>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
              {pinned.map((n) => (
                <NoteCard key={n.id} note={n} palette={palette} dark={dark} onPress={() => setEditor({ open: true, id: n.id })} />
              ))}
            </View>
          </>
        ) : null}

        {rest.length > 0 ? (
          <>
            <SectionTitle>{pinned.length > 0 ? "Others" : "All notes"}</SectionTitle>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
              {rest.map((n) => (
                <NoteCard key={n.id} note={n} palette={palette} dark={dark} onPress={() => setEditor({ open: true, id: n.id })} />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <Fab onPress={() => setEditor({ open: true, id: null })} icon="create" />
      <NoteEditorSheet visible={editor.open} noteId={editor.id} onClose={() => setEditor({ open: false, id: null })} />
    </View>
  );
}

function NoteCard({
  note,
  palette,
  dark,
  onPress,
}: {
  note: data.Note;
  palette: ReturnType<typeof usePalette>["palette"];
  dark: boolean;
  onPress: () => void;
}) {
  const colors = NOTE_COLORS[note.color] ?? NOTE_COLORS.default;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: "48.5%",
          minHeight: 120,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border || palette.border,
          backgroundColor: colors.bg === "transparent" ? palette.card : colors.bg,
          padding: 13,
          marginBottom: 12,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
        <Text style={{ fontSize: 14.5, fontWeight: "700", color: palette.text, flex: 1 }} numberOfLines={1}>
          {note.title}
        </Text>
        {note.pinned ? <Ionicons name="pin" size={13} color={palette.warn} /> : null}
      </View>
      <Text style={{ fontSize: 12.5, color: palette.textDim, lineHeight: 18 }} numberOfLines={5}>
        {note.content || "Empty note"}
      </Text>
      <Text style={{ fontSize: 10.5, color: palette.textFaint, marginTop: 8 }}>
        {formatDateShort(new Date(note.updatedAt))}
      </Text>
    </Pressable>
  );
}

function NoteEditorSheet({ visible, noteId, onClose }: { visible: boolean; noteId: string | null; onClose: () => void }) {
  const { palette } = usePalette();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState("default");
  const [pinned, setPinned] = useState(false);
  const [loaded, setLoaded] = useState<string | null | undefined>(undefined);

  React.useEffect(() => {
    if (!visible) return;
    if (loaded === noteId) return;
    setLoaded(noteId);
    if (noteId) {
      const n = data.getNote(noteId);
      if (n) {
        setTitle(n.title);
        setContent(n.content);
        setColor(n.color);
        setPinned(!!n.pinned);
        return;
      }
    }
    setTitle("");
    setContent("");
    setColor("default");
    setPinned(false);
  }, [visible, noteId, loaded]);

  const save = () => {
    data.saveNote(noteId, {
      title: title.trim() || "Untitled note",
      content,
      color,
      pinned,
    });
    bumpData();
    scheduleSync();
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={save}
      title={noteId ? "Edit note" : "New note"}
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
          {noteId ? (
            <Btn
              label="Delete"
              variant="danger"
              icon="trash-outline"
              small
              onPress={() => {
                data.softDelete("notes", noteId);
                bumpData();
                scheduleSync();
                onClose();
              }}
              style={{ flex: 1 }}
            />
          ) : null}
          <Btn label="Save note" icon="checkmark" onPress={save} style={{ flex: 2 }} />
        </View>
      }
    >
      <Input value={title} onChangeText={setTitle} placeholder="Title" autoFocus={!noteId} onSubmitEditing={save} />

      <FieldLabel>Content</FieldLabel>
      <Input
        value={content}
        onChangeText={setContent}
        placeholder="Write freely… (markdown works on the web app)"
        multiline
        style={{ minHeight: 200 }}
      />

      <FieldLabel>Color</FieldLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {Object.entries(NOTE_COLORS).map(([key, c]) => (
          <Pressable
            key={key}
            onPress={() => setColor(key)}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              marginRight: 10,
              marginBottom: 10,
              borderWidth: 2,
              borderColor: color === key ? palette.primary : palette.border,
              backgroundColor: c.bg === "transparent" ? palette.cardAlt : c.bg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {color === key ? <Ionicons name="checkmark" size={16} color={palette.primary} /> : null}
          </Pressable>
        ))}
      </View>

      <FieldLabel>Pin</FieldLabel>
      <View style={{ flexDirection: "row" }}>
        <Chip label={pinned ? "📌 Pinned" : "Pin to top"} active={pinned} onPress={() => setPinned(!pinned)} />
      </View>
    </Sheet>
  );
}
