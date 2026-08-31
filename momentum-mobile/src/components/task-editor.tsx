// Task create/edit sheet — shared by Dashboard quick-add and Tasks list.

import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

import * as data from "../db";
import { bumpData } from "../store";
import { scheduleSync } from "../sync";
import { toast } from "../toast";
import {
  Btn,
  Chip,
  FieldLabel,
  IconBtn,
  Input,
  RichTextEditor,
  Sheet,
  usePalette,
} from "./ui";
import { PRIORITY_COLORS } from "../theme";
import { dayKey, formatTime, relativeDay, titleize } from "../utils";

const PRIORITIES = ["low", "medium", "high", "urgent"];
const CATEGORIES = ["personal", "work", "learning", "health", "other"];
const REPEATS = ["none", "daily", "weekdays", "weekly", "monthly"];

export function TaskEditorSheet({
  visible,
  todoId,
  onClose,
  presetDueToday,
}: {
  visible: boolean;
  todoId: string | null;
  onClose: () => void;
  presetDueToday?: boolean;
}) {
  const { palette } = usePalette();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("personal");
  const [repeat, setRepeat] = useState("none");
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [hasTime, setHasTime] = useState(false);
  const [reminderOffset, setReminderOffset] = useState<number | null>(null); // minutes before due (null = none)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [subtasks, setSubtasks] = useState<data.Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [loadedId, setLoadedId] = useState<string | null | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!visible) return;
    const idToLoad = todoId;
    if (loadedId === idToLoad) return;
    setLoadedId(idToLoad);
    if (idToLoad) {
      const t = data.getTodo(idToLoad);
      if (t) {
        setTitle(t.title);
        setNotes(t.notes ?? "");
        setPriority(t.priority);
        setCategory(t.category);
        setRepeat(t.repeat);
        const d = t.dueDate ? new Date(t.dueDate) : null;
        setDueDate(d);
        setHasTime(
          !!(
            t.dueDate &&
            new Date(t.dueDate).getHours() + new Date(t.dueDate).getMinutes() >
              0
          ),
        );
        // Reverse-engineer the offset from the stored reminderAt.
        if (t.reminderAt && t.dueDate) {
          const off = Math.round(
            (new Date(t.dueDate).getTime() - new Date(t.reminderAt).getTime()) /
              60000,
          );
          setReminderOffset(off === 0 || off === 15 || off === 60 ? off : 0);
        } else {
          setReminderOffset(null);
        }
        setSubtasks(data.subtasksOf(idToLoad));
        return;
      }
    }
    setTitle("");
    setNotes("");
    setPriority("medium");
    setCategory("personal");
    setRepeat("none");
    setSubtasks([]);
    setReminderOffset(null);
    if (presetDueToday) {
      const d = new Date();
      d.setHours(9, 0, 0, 0);
      setDueDate(d);
      setHasTime(false);
    } else {
      setDueDate(null);
      setHasTime(false);
    }
  }, [visible, todoId, loadedId, presetDueToday]);

  const save = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    let dateISO: string | null = null;
    if (dueDate) {
      const d = new Date(dueDate);
      if (!hasTime) {
        d.setHours(0, 0, 0, 0);
      }
      dateISO = d.toISOString();
    }
    let reminderISO: string | null = null;
    if (dateISO && hasTime && reminderOffset !== null) {
      reminderISO = new Date(
        new Date(dateISO).getTime() - reminderOffset * 60000,
      ).toISOString();
    }
    data.saveTodo(todoId, {
      title: trimmed,
      notes: notes.trim() || null,
      priority,
      category,
      repeat,
      dueDate: dateISO,
      reminderAt: reminderISO,
    });
    bumpData();
    scheduleSync();
    toast.success(todoId ? "Task updated" : "Task added");
    if (reminderISO)
      toast.info(`⏰ Reminder set for ${formatTime(reminderISO)}`);
    onClose();
  };

  const dueLabel = dueDate
    ? `${relativeDay(dayKey(dueDate))}${hasTime ? ` · ${formatTime(dueDate.toISOString())}` : ""}`
    : "No date";

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={todoId ? "Edit task" : "New task"}
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
          {todoId ? (
            <Btn
              label="Delete"
              variant="danger"
              icon="trash-outline"
              small
              onPress={() => {
                data.softDelete("todos", todoId);
                bumpData();
                scheduleSync();
                onClose();
              }}
              style={{ flex: 1 }}
            />
          ) : null}
          <Btn
            label={todoId ? "Save changes" : "Add task"}
            icon="checkmark"
            onPress={save}
            style={{ flex: 2 }}
          />
        </View>
      }
    >
      <Input
        value={title}
        onChangeText={setTitle}
        placeholder="What needs doing?"
        autoFocus={!todoId}
        onSubmitEditing={save}
      />

      <FieldLabel>Notes</FieldLabel>
      <RichTextEditor
        value={notes}
        onChangeText={setNotes}
        placeholder="Details…"
        minHeight={90}
      />

      <FieldLabel>Priority</FieldLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {PRIORITIES.map((p) => (
          <Chip
            key={p}
            label={titleize(p)}
            active={priority === p}
            color={PRIORITY_COLORS[p]}
            onPress={() => setPriority(p)}
          />
        ))}
      </View>

      <FieldLabel>Category</FieldLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={titleize(c)}
            active={category === c}
            onPress={() => setCategory(c)}
          />
        ))}
      </View>

      <FieldLabel>Due date</FieldLabel>
      <View
        style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}
      >
        <Chip
          label={dueLabel}
          active={!!dueDate}
          onPress={() => setShowDatePicker(true)}
        />
        {dueDate ? (
          <>
            <Chip
              label={hasTime ? "Time set ✓" : "Add time"}
              active={hasTime}
              onPress={() => setShowTimePicker(true)}
            />
            <Chip
              label="Clear"
              onPress={() => {
                setDueDate(null);
                setHasTime(false);
                setReminderOffset(null);
              }}
            />
          </>
        ) : null}
      </View>

      {dueDate && hasTime ? (
        <>
          <FieldLabel>Reminder</FieldLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            <Chip
              label="At time"
              active={reminderOffset === 0}
              onPress={() => setReminderOffset(0)}
            />
            <Chip
              label="15 min before"
              active={reminderOffset === 15}
              onPress={() => setReminderOffset(15)}
            />
            <Chip
              label="1 hour before"
              active={reminderOffset === 60}
              onPress={() => setReminderOffset(60)}
            />
            <Chip
              label="No reminder"
              active={reminderOffset === null}
              onPress={() => setReminderOffset(null)}
            />
          </View>
        </>
      ) : null}

      {showDatePicker && (
        <DateTimePicker
          value={dueDate ?? new Date()}
          mode="date"
          display="default"
          onChange={(_e, d) => {
            setShowDatePicker(false);
            if (d) {
              const next = new Date(d);
              const base = dueDate ?? new Date();
              next.setHours(base.getHours(), base.getMinutes(), 0, 0);
              setDueDate(next);
            }
          }}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={dueDate ?? new Date()}
          mode="time"
          display="default"
          is24Hour={false}
          onChange={(_e, d) => {
            setShowTimePicker(false);
            if (d) {
              const next = dueDate ? new Date(dueDate) : new Date();
              next.setHours(d.getHours(), d.getMinutes(), 0, 0);
              setDueDate(next);
              setHasTime(true);
            }
          }}
        />
      )}

      <FieldLabel>Repeat</FieldLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {REPEATS.map((r) => (
          <Chip
            key={r}
            label={r === "none" ? "Never" : titleize(r)}
            active={repeat === r}
            onPress={() => setRepeat(r)}
          />
        ))}
      </View>

      <FieldLabel>Checklist</FieldLabel>
      {subtasks.map((s) => (
        <View
          key={s.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <Pressable
            onPress={() => {
              data.setSubtaskCompleted(s.id, !s.completed);
              setSubtasks(data.subtasksOf(todoId ?? ""));
            }}
            style={{
              width: 22,
              height: 22,
              borderRadius: 7,
              borderWidth: 1.5,
              borderColor: s.completed ? palette.primary : palette.border,
              backgroundColor: s.completed ? palette.primary : "transparent",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10,
            }}
          >
            {s.completed ? (
              <Ionicons name="checkmark" size={15} color={palette.onPrimary} />
            ) : null}
          </Pressable>
          <Text
            style={{
              flex: 1,
              color: s.completed ? palette.textFaint : palette.text,
              textDecorationLine: s.completed ? "line-through" : "none",
            }}
          >
            {s.title}
          </Text>
          <IconBtn
            name="close-circle-outline"
            size={18}
            color={palette.textFaint}
            onPress={() => {
              data.deleteSubtask(s.id);
              setSubtasks(data.subtasksOf(todoId ?? ""));
              bumpData();
              scheduleSync();
            }}
          />
        </View>
      ))}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Input
          value={newSubtask}
          onChangeText={setNewSubtask}
          placeholder="Add checklist item…"
          style={{ flex: 1 }}
          onSubmitEditing={() => {
            const t = newSubtask.trim();
            if (t && todoId) {
              data.addSubtask(todoId, t);
              setSubtasks(data.subtasksOf(todoId));
              setNewSubtask("");
              bumpData();
              scheduleSync();
            } else if (t) {
              setNewSubtask("");
            }
          }}
        />
      </View>
      {!todoId ? (
        <Text style={{ color: palette.textFaint, fontSize: 12, marginTop: 6 }}>
          Save the task first to add checklist items.
        </Text>
      ) : null}
    </Sheet>
  );
}
