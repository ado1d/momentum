// Goals — daily/weekly/monthly goals with progress tracking.

import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
  RichTextEditor,
  Segmented,
  Sheet,
  usePalette,
} from "../components/ui";
import { dayKey, relativeDay, titleize } from "../utils";

const CATEGORIES = [
  "learning",
  "fitness",
  "career",
  "personal",
  "finance",
  "other",
];
const PERIODS = ["daily", "weekly", "monthly"];

export default function GoalsScreen() {
  const { palette } = usePalette();
  const version = useApp((s) => s.dataVersion);
  const [status, setStatus] = useState<"active" | "completed">("active");
  const [editor, setEditor] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });

  const goals = useMemo(
    () => data.goalsList(status),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, status],
  );

  const adjust = (id: string, delta: number) => {
    data.adjustGoalProgress(id, delta);
    bumpData();
    scheduleSync();
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
      >
        <View style={{ paddingTop: 8, paddingBottom: 12 }}>
          <Text
            style={{
              color: palette.text,
              fontSize: 23,
              fontWeight: "800",
              letterSpacing: -0.4,
            }}
          >
            Goals
          </Text>
          <Text
            style={{ color: palette.textDim, fontSize: 13.5, marginTop: 3 }}
          >
            Daily learning goals, weekly targets, monthly ambitions
          </Text>
        </View>
        <OfflinePill />
        <Segmented
          value={status}
          onChange={(k) => setStatus(k as "active" | "completed")}
          options={[
            { key: "active", label: "Active" },
            { key: "completed", label: "Completed" },
          ]}
        />
        <View style={{ height: 12 }} />
        {goals.length === 0 ? (
          <Card style={{ marginTop: 4 }}>
            <EmptyState
              icon="flag-outline"
              title={
                status === "active"
                  ? "No active goals"
                  : "Nothing completed yet"
              }
              hint={
                status === "active"
                  ? "Set a target — small and specific wins."
                  : "Finish a goal to see it here."
              }
              action={
                status === "active" ? (
                  <Btn
                    label="New goal"
                    icon="add"
                    onPress={() => setEditor({ open: true, id: null })}
                  />
                ) : undefined
              }
            />
          </Card>
        ) : (
          goals.map((g) => {
            const pct =
              g.target <= 0
                ? 0
                : Math.min(100, Math.round((g.progress / g.target) * 100));
            const complete = g.progress >= g.target;
            return (
              <Card key={g.id}>
                <Pressable onPress={() => setEditor({ open: true, id: g.id })}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 13,
                        backgroundColor: complete
                          ? palette.primarySoft
                          : palette.cardAlt,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                      }}
                    >
                      <Ionicons
                        name={complete ? "trophy" : "flag-outline"}
                        size={19}
                        color={complete ? palette.primary : palette.textDim}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15.5,
                          fontWeight: "700",
                          color: palette.text,
                        }}
                        numberOfLines={1}
                      >
                        {g.title}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: palette.textFaint,
                          marginTop: 2,
                        }}
                      >
                        {titleize(g.category)} · {g.period}
                        {g.endDate ? ` · ends ${relativeDay(g.endDate)}` : ""}
                      </Text>
                    </View>
                  </View>
                </Pressable>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 14,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: complete ? palette.primary : palette.text,
                      width: 70,
                    }}
                  >
                    {g.progress}/{g.target} {g.unit ?? ""}
                  </Text>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Bar
                      value={g.progress}
                      max={g.target}
                      color={complete ? palette.primary : "#fbbf24"}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      color: palette.textDim,
                      width: 40,
                      textAlign: "right",
                    }}
                  >
                    {pct}%
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    marginTop: 10,
                  }}
                >
                  <Pressable
                    onPress={() => adjust(g.id, -1)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: palette.cardAlt,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 8,
                    }}
                  >
                    <Ionicons name="remove" size={18} color={palette.textDim} />
                  </Pressable>
                  <Pressable
                    onPress={() => adjust(g.id, 1)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: palette.primarySoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="add" size={18} color={palette.primary} />
                  </Pressable>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      <Fab onPress={() => setEditor({ open: true, id: null })} />
      <GoalEditorSheet
        visible={editor.open}
        goalId={editor.id}
        onClose={() => setEditor({ open: false, id: null })}
      />
    </View>
  );
}

function GoalEditorSheet({
  visible,
  goalId,
  onClose,
}: {
  visible: boolean;
  goalId: string | null;
  onClose: () => void;
}) {
  const { palette } = usePalette();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("learning");
  const [period, setPeriod] = useState("weekly");
  const [target, setTarget] = useState("7");
  const [unit, setUnit] = useState("");
  const [loaded, setLoaded] = useState<string | null | undefined>(undefined);

  React.useEffect(() => {
    if (!visible) return;
    if (loaded === goalId) return;
    setLoaded(goalId);
    if (goalId) {
      const g = data.getGoal(goalId);
      if (g) {
        setTitle(g.title);
        setDescription(g.description ?? "");
        setCategory(g.category);
        setPeriod(g.period);
        setTarget(String(g.target));
        setUnit(g.unit ?? "");
        return;
      }
    }
    setTitle("");
    setDescription("");
    setCategory("learning");
    setPeriod("weekly");
    setTarget("7");
    setUnit("");
  }, [visible, goalId, loaded]);

  const save = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const t = Math.max(1, parseInt(target, 10) || 1);
    data.saveGoal(goalId, {
      title: trimmed,
      description: description.trim() || null,
      category,
      period,
      target: t,
      unit: unit.trim() || null,
    });
    bumpData();
    scheduleSync();
    toast.success(goalId ? "Goal updated" : "Goal created");
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={goalId ? "Edit goal" : "New goal"}
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
          {goalId ? (
            <Btn
              label="Delete"
              variant="danger"
              icon="trash-outline"
              small
              onPress={() => {
                data.softDelete("goals", goalId);
                bumpData();
                scheduleSync();
                onClose();
              }}
              style={{ flex: 1 }}
            />
          ) : null}
          <Btn
            label={goalId ? "Save goal" : "Add goal"}
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
        placeholder="e.g. Read 100 pages a week"
        autoFocus={!goalId}
        onSubmitEditing={save}
      />

      <FieldLabel>Why this matters (optional)</FieldLabel>
      <RichTextEditor
        value={description}
        onChangeText={setDescription}
        placeholder="Motivation…"
        minHeight={70}
      />

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

      <FieldLabel>Period</FieldLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {PERIODS.map((p) => (
          <Chip
            key={p}
            label={titleize(p)}
            active={period === p}
            onPress={() => setPeriod(p)}
          />
        ))}
      </View>

      <FieldLabel>Target</FieldLabel>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Input
          value={target}
          onChangeText={setTarget}
          keyboardType="numeric"
          placeholder="7"
          style={{ width: 90 }}
        />
        <Input
          value={unit}
          onChangeText={setUnit}
          placeholder="unit (pages, km…)"
          style={{ flex: 1 }}
        />
      </View>
    </Sheet>
  );
}
