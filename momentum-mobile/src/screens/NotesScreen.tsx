// Notes — mirrors the web app's notes-view: search, tag filter chips,
// pinned section, colorful cards with #tag badges, and a READ-MODE view
// (tapping a note opens the beautiful reader first — "Edit note" stacks
// the editor on top, exactly like the web app).

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
  Chip,
  EmptyState,
  Fab,
  FieldLabel,
  Input,
  OfflinePill,
  SectionHeading,
  Sheet,
  StackHeader,
  usePalette,
} from "../components/ui";
import { MiniMarkdown, extractWikiTitles, markdownToPlain } from "../components/mini-md";
import { NOTE_COLORS, type Palette } from "../theme";
import { relativeTime } from "../utils";

/** Top gradient strip per note color — mirrors the web NOTE_ACCENT. */
const NOTE_ACCENTS: Record<string, string[]> = {
  default: ["#10b981", "#14b8a6", "#10b981"],
  yellow: ["#fbbf24", "#fb923c"],
  green: ["#10b981", "#14b8a6"],
  rose: ["#f43f5e", "#ec4899"],
  violet: ["#8b5cf6", "#d946ef"],
  teal: ["#14b8a6", "#10b981"],
};

export default function NotesScreen() {
  const { palette } = usePalette();
  const version = useApp((s) => s.dataVersion);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string>("all");
  const [editor, setEditor] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [reader, setReader] = useState<string | null>(null);

  const notes = useMemo(
    () => data.notesList(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const tags = useMemo(() => data.noteTags(notes), [notes]);

  const query = search.trim().toLowerCase();
  const filtered = notes.filter((n) => {
    if (activeTag !== "all" && n.tag !== activeTag) return false;
    if (!query) return true;
    return (
      n.title.toLowerCase().includes(query) ||
      n.content.toLowerCase().includes(query) ||
      (n.tag ?? "").toLowerCase().includes(query)
    );
  });

  const pinned = filtered.filter((n) => n.pinned);
  const rest = filtered.filter((n) => !n.pinned);

  const openReader = (id: string) => setReader(id);

  const openEditor = (id: string | null) => setEditor({ open: true, id });

  const resolveWikiLink = (title: string) => {
    const needle = title.trim().toLowerCase();
    const target = notes.find(
      (n) => (n.title.trim() || "Untitled note").toLowerCase() === needle,
    );
    if (target) {
      openReader(target.id);
    } else {
      toast.info(`No note titled "${title}" yet`);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <StackHeader title="Notes" subtitle="Quick capture & ideas" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}>
        <OfflinePill />
        <Input
          value={search}
          onChangeText={(t) => {
            setSearch(t);
            setActiveTag("all");
          }}
          placeholder="Search notes by title, content or tag…"
          returnKeyType="search"
        />
        <View style={{ height: 10 }} />

        {tags.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginBottom: 4 }}
            contentContainerStyle={{ paddingRight: 8, paddingBottom: 4 }}
          >
            <TagChip
              label={`All (${notes.length})`}
              active={activeTag === "all"}
              onPress={() => setActiveTag("all")}
            />
            {tags.map((t) => (
              <TagChip
                key={t.tag}
                label={`# ${t.tag} (${t.count})`}
                active={activeTag === t.tag}
                onPress={() => setActiveTag(activeTag === t.tag ? "all" : t.tag)}
              />
            ))}
          </ScrollView>
        ) : null}

        {notes.length === 0 ? (
          <Card>
            <EmptyState
              icon="create-outline"
              title="No notes yet"
              hint="Capture ideas, snippets and lists before they escape."
              action={<Btn label="New note" icon="add" onPress={() => openEditor(null)} />}
            />
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon="search-outline"
              title="No matching notes"
              hint={
                query
                  ? `Nothing matches "${search.trim()}". Try a different word or clear the filters.`
                  : "No notes carry this tag yet."
              }
              action={
                <Btn
                  label="Clear filters"
                  variant="outline"
                  small
                  onPress={() => {
                    setSearch("");
                    setActiveTag("all");
                  }}
                />
              }
            />
          </Card>
        ) : null}

        {pinned.length > 0 ? (
          <>
            <SectionHeading title="Pinned" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {pinned.map((n) => (
                <NoteCard key={n.id} note={n} palette={palette} onPress={() => openReader(n.id)} />
              ))}
            </View>
          </>
        ) : null}

        {rest.length > 0 ? (
          <>
            <SectionHeading title={pinned.length > 0 ? "Others" : "All notes"} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {rest.map((n) => (
                <NoteCard key={n.id} note={n} palette={palette} onPress={() => openReader(n.id)} />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <Fab onPress={() => openEditor(null)} icon="create" bottom={40} />

      {/* Reader renders before the editor so "Edit note" stacks on top. */}
      <NoteReaderSheet
        noteId={reader}
        onClose={() => setReader(null)}
        onEdit={(id) => openEditor(id)}
        onOpenNote={openReader}
        onWikiLink={resolveWikiLink}
      />
      <NoteEditorSheet
        visible={editor.open}
        noteId={editor.id}
        existingTags={tags.map((t) => t.tag)}
        onClose={() => setEditor({ open: false, id: null })}
      />
    </View>
  );
}

/** Web-style tag pill for the filter row. */
function TagChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { palette } = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderRadius: 999,
          borderWidth: 1,
          paddingHorizontal: 13,
          paddingVertical: 6,
          marginRight: 8,
          backgroundColor: active ? palette.primary : palette.card,
          borderColor: active ? palette.primary : palette.border,
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text
        numberOfLines={1}
        style={{ fontSize: 12, fontWeight: "700", color: active ? palette.onPrimary : palette.textDim }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function NoteCard({
  note,
  palette,
  onPress,
}: {
  note: data.Note;
  palette: Palette;
  onPress: () => void;
}) {
  const colors = NOTE_COLORS[note.color] ?? NOTE_COLORS.default;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: "48.4%",
          minHeight: 118,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border || palette.border,
          backgroundColor: colors.bg === "transparent" ? palette.card : colors.bg,
          padding: 13,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
        {note.pinned ? (
          <Ionicons name="pin" size={13} color={palette.warn} style={{ marginRight: 5 }} />
        ) : null}
        <Text style={{ fontSize: 14, fontWeight: "700", color: palette.text, flex: 1 }} numberOfLines={1}>
          {note.title || "Untitled note"}
        </Text>
      </View>
      <Text style={{ fontSize: 12, color: palette.textDim, lineHeight: 17 }} numberOfLines={5}>
        {note.content ? markdownToPlain(note.content) : "Empty note"}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
        {note.tag ? (
          <View
            style={{
              borderRadius: 999,
              backgroundColor: palette.cardAlt,
              borderWidth: 1,
              borderColor: palette.border,
              paddingHorizontal: 7,
              paddingVertical: 2,
              marginRight: 7,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "700", color: palette.textDim }}># {note.tag}</Text>
          </View>
        ) : null}
        <Text style={{ fontSize: 10.5, color: palette.textFaint, flex: 1 }} numberOfLines={1}>
          Edited {relativeTime(note.updatedAt)}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Read-mode sheet (mirrors the web NoteReaderDialog) ────────

function NoteReaderSheet({
  noteId,
  onClose,
  onEdit,
  onOpenNote,
  onWikiLink,
}: {
  noteId: string | null;
  onClose: () => void;
  onEdit: (id: string) => void;
  onOpenNote: (id: string) => void;
  onWikiLink: (title: string) => void;
}) {
  const { palette } = usePalette();
  const version = useApp((s) => s.dataVersion);

  // Keep the last note while the sheet is open so it never flashes empty.
  const [lastId, setLastId] = React.useState<string | null>(null);
  if (noteId && noteId !== lastId) setLastId(noteId);
  const visible = noteId !== null;
  const shownId = noteId ?? lastId;

  const note = useMemo(
    () => (shownId ? data.getNote(shownId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shownId, version],
  );

  const notes = useMemo(
    () => data.notesList(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const backlinks = useMemo(() => {
    const title = note?.title.trim().toLowerCase();
    if (!note || !title) return [];
    return notes.filter(
      (n) => n.id !== note.id && extractWikiTitles(n.content).includes(title),
    );
  }, [notes, note]);

  if (!note) return null;

  const accent = NOTE_ACCENTS[note.color] ?? NOTE_ACCENTS.default;
  const words = note.content.trim() ? note.content.trim().split(/\s+/).length : 0;
  const minutes = words > 0 ? Math.max(1, Math.round(words / 200)) : 0;
  const colors = NOTE_COLORS[note.color] ?? NOTE_COLORS.default;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "rgba(4,6,12,0.6)", justifyContent: "flex-end" }}>
        <Pressable style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }} onPress={onClose} />
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
          {/* color accent strip */}
          <View style={{ flexDirection: "row", height: 5 }}>
            {accent.map((c, i) => (
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
            <Text style={{ fontSize: 13, fontWeight: "800", color: palette.textFaint, letterSpacing: 0.5 }}>
              READING VIEW
            </Text>
            <Pressable onPress={onClose} hitSlop={8} style={{ padding: 6, borderRadius: 12 }}>
              <Ionicons name="close" size={22} color={palette.textDim} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {note.pinned ? (
                <Ionicons name="pin" size={15} color={palette.warn} style={{ marginRight: 7 }} />
              ) : null}
              <Text
                style={{
                  flex: 1,
                  fontSize: 21,
                  fontWeight: "800",
                  color: palette.text,
                  lineHeight: 28,
                  letterSpacing: -0.3,
                }}
              >
                {note.title || "Untitled note"}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
              {note.tag ? (
                <View
                  style={{
                    borderRadius: 999,
                    backgroundColor: palette.cardAlt,
                    borderWidth: 1,
                    borderColor: palette.border,
                    paddingHorizontal: 9,
                    paddingVertical: 3,
                    marginRight: 8,
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 10.5, fontWeight: "700", color: palette.textDim }}># {note.tag}</Text>
                </View>
              ) : null}
              <Text style={{ fontSize: 11.5, color: palette.textFaint, marginBottom: 4 }}>
                Edited {relativeTime(note.updatedAt)}
                {words > 0 ? `  ·  ${words} ${words === 1 ? "word" : "words"}  ·  ${minutes} min read` : ""}
              </Text>
            </View>

            <View style={{ height: 1, backgroundColor: palette.border, marginTop: 14, marginBottom: 4 }} />

            {note.content.trim() ? (
              <MiniMarkdown content={note.content} palette={palette} onWikiLink={onWikiLink} />
            ) : (
              <Text style={{ color: palette.textFaint, fontStyle: "italic", fontSize: 14, marginTop: 16 }}>
                This note is empty — tap "Edit note" to start writing.
              </Text>
            )}

            {backlinks.length > 0 ? (
              <View
                style={{
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: palette.border,
                  backgroundColor: palette.cardAlt,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  marginTop: 18,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="link-outline" size={12} color={palette.textDim} />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: palette.textDim, marginLeft: 5 }}>
                    Mentioned in
                  </Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
                  {backlinks.map((b) => (
                    <Pressable
                      key={b.id}
                      onPress={() => onOpenNote(b.id)}
                      style={({ pressed }) => [
                        {
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: palette.border,
                          backgroundColor: palette.card,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          marginRight: 6,
                          marginBottom: 6,
                        },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={{ fontSize: 12, color: palette.primary, fontWeight: "600" }}>
                        {b.title || "Untitled note"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
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
            <Text style={{ fontSize: 11, color: palette.textFaint, flex: 1, marginRight: 10 }} numberOfLines={1}>
              Created {new Date(note.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </Text>
            <Btn label="Edit note" icon="pencil" small onPress={() => onEdit(note.id)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Editor sheet (mirrors the web NoteDialog) ─────────────────

function NoteEditorSheet({
  visible,
  noteId,
  existingTags,
  onClose,
}: {
  visible: boolean;
  noteId: string | null;
  existingTags: string[];
  onClose: () => void;
}) {
  const { palette } = usePalette();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tag, setTag] = useState("");
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
        setTag(n.tag ?? "");
        setColor(n.color);
        setPinned(!!n.pinned);
        return;
      }
    }
    setTitle("");
    setContent("");
    setTag("");
    setColor("default");
    setPinned(false);
  }, [visible, noteId, loaded]);

  // X / backdrop dismiss DISCARDS changes (the web dialog behaves the same);
  // the explicit Save button persists.
  const discard = () => onClose();

  const save = () => {
    if (!title.trim() && !content.trim()) {
      onClose();
      return;
    }
    data.saveNote(noteId, {
      title: title.trim() || "Untitled note",
      content,
      tag: tag.trim().toLowerCase() || null,
      color,
      pinned,
    });
    bumpData();
    scheduleSync();
    toast.success(noteId ? "Note updated" : "Note saved");
    onClose();
  };

  const suggestions = existingTags.filter((t) => t !== tag.trim().toLowerCase()).slice(0, 6);

  return (
    <Sheet
      visible={visible}
      onClose={discard}
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
                toast.success("Note deleted");
                onClose();
              }}
              style={{ flex: 1 }}
            />
          ) : null}
          <Btn label={noteId ? "Save changes" : "Create note"} icon="checkmark" onPress={save} style={{ flex: 2 }} />
        </View>
      }
    >
      <Input value={title} onChangeText={setTitle} placeholder="Give it a name (optional)" autoFocus={!noteId} onSubmitEditing={save} returnKeyType="done" />

      <FieldLabel>Content</FieldLabel>
      <Input
        value={content}
        onChangeText={setContent}
        placeholder={"Write freely…\n**bold** · *italic* · # heading · [[Note title]] links notes"}
        multiline
        style={{ minHeight: 200 }}
      />

      <FieldLabel>Tag</FieldLabel>
      <Input value={tag} onChangeText={setTag} placeholder="e.g. ideas" returnKeyType="done" onSubmitEditing={save} />
      {suggestions.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
          {suggestions.map((t) => (
            <Chip key={t} label={`# ${t}`} small onPress={() => setTag(t)} />
          ))}
        </View>
      ) : null}

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
