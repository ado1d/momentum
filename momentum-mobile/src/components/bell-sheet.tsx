// Bell menu — mirrors the web app's BellMenu: what needs attention today
// (overdue tasks, tasks due today, habits left, reminder status).
import React, { useMemo } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import * as data from "../db";
import { useApp } from "../store";
import { navigationRef } from "../../App";
import { Btn, usePalette } from "./ui";
import { dayKey, formatTime, relativeDay } from "../utils";

export function BellSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { palette } = usePalette();
  const version = useApp((s) => s.dataVersion);
  const reminderEnabled = useApp((s) => s.reminderEnabled);

  const model = useMemo(() => {
    const today = dayKey();
    const active = data.activeTodos();
    return {
      overdue: active.filter((t) => t.dueDate && dayKey(t.dueDate) < today).slice(0, 6),
      dueToday: active.filter((t) => t.dueDate && dayKey(t.dueDate) === today),
      habitsLeft: data.habits().filter((h) => !h.doneToday),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, visible]);

  const count = model.overdue.length + model.dueToday.length + model.habitsLeft.length;

  const goSettings = () => {
    onClose();
    setTimeout(() => {
      if (navigationRef.isReady()) navigationRef.navigate("Settings");
    }, 200);
  };

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
            paddingHorizontal: 16,
            paddingTop: 6,
            paddingBottom: 30,
            maxHeight: "80%",
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              borderRadius: 999,
              backgroundColor: "rgba(150,160,180,0.35)",
              marginTop: 6,
              marginBottom: 10,
            }}
          />
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Ionicons name="notifications" size={18} color={palette.primary} />
            <Text style={{ color: palette.text, fontSize: 16, fontWeight: "800", marginLeft: 8 }}>
              What needs you today
            </Text>
            {count > 0 ? (
              <View
                style={{
                  marginLeft: "auto",
                  borderRadius: 999,
                  backgroundColor: palette.primarySoft,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ color: palette.primary, fontSize: 12, fontWeight: "800" }}>{count}</Text>
              </View>
            ) : null}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
            {count === 0 ? (
              <View
                style={{
                  borderRadius: 16,
                  borderWidth: 1.2,
                  borderStyle: "dashed",
                  borderColor: palette.border,
                  backgroundColor: palette.cardAlt,
                  paddingHorizontal: 16,
                  paddingVertical: 26,
                  alignItems: "center",
                }}
              >
                <Ionicons name="checkmark-done-outline" size={30} color={palette.primary} />
                <Text style={{ color: palette.text, fontSize: 15, fontWeight: "700", marginTop: 8 }}>
                  All clear
                </Text>
                <Text style={{ color: palette.textDim, fontSize: 12.5, marginTop: 3, textAlign: "center" }}>
                  Nothing overdue, nothing due today, every habit checked. Enjoy it.
                </Text>
              </View>
            ) : (
              <>
                {model.overdue.map((t) => (
                  <Row
                    key={t.id}
                    icon="alert-circle"
                    iconColor={palette.danger}
                    title={t.title}
                    sub={`Overdue · ${relativeDay(dayKey(t.dueDate ?? ""))}`}
                    palette={palette}
                  />
                ))}
                {model.dueToday.map((t) => (
                  <Row
                    key={t.id}
                    icon="time-outline"
                    iconColor={palette.warn}
                    title={t.title}
                    sub={`Due today${t.dueDate && new Date(t.dueDate).getHours() > 0 ? ` · ${formatTime(t.dueDate)}` : ""}`}
                    palette={palette}
                  />
                ))}
                {model.habitsLeft.length > 0 ? (
                  <Row
                    key="habits-left"
                    icon="repeat-outline"
                    iconColor={palette.primary}
                    title={`${model.habitsLeft.length} habit${model.habitsLeft.length === 1 ? "" : "s"} left today`}
                    sub={model.habitsLeft.map((h) => `${h.emoji} ${h.name}`).join("  ·  ")}
                    palette={palette}
                  />
                ) : null}
              </>
            )}

            <View style={{ marginTop: 14, gap: 8 }}>
              <Btn
                label={reminderEnabled ? "Daily reminder on ✓ — adjust in Settings" : "Set up a daily reminder"}
                variant="outline"
                icon="notifications-outline"
                small
                onPress={goSettings}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Row({
  icon,
  iconColor,
  title,
  sub,
  palette,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  sub: string;
  palette: ReturnType<typeof usePalette>["palette"];
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
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 8,
      }}
    >
      <Ionicons name={icon} size={19} color={iconColor} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ color: palette.text, fontSize: 13.5, fontWeight: "700" }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ color: palette.textDim, fontSize: 11.5, marginTop: 1 }} numberOfLines={2}>
          {sub}
        </Text>
      </View>
    </View>
  );
}
