// Lightweight sonner-style toast system — success/error feedback everywhere.
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { create } from "zustand";
import { usePalette } from "./components/ui";

export interface ToastItem {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
  description?: string;
}

interface ToastState {
  toasts: ToastItem[];
  push: (kind: ToastItem["kind"], message: string, description?: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message, description) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, kind, message, description }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3600);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (message: string, description?: string) =>
    useToasts.getState().push("success", message, description),
  error: (message: string, description?: string) =>
    useToasts.getState().push("error", message, description),
  info: (message: string, description?: string) =>
    useToasts.getState().push("info", message, description),
};

function ToastRow({ item }: { item: ToastItem }) {
  const { palette } = usePalette();
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [fade]);
  const icon =
    item.kind === "success" ? "checkmark-circle" : item.kind === "error" ? "alert-circle" : "information-circle";
  const color = item.kind === "success" ? palette.ok : item.kind === "error" ? palette.danger : palette.primary;
  return (
    <Animated.View style={{ opacity: fade, width: "100%", alignItems: "center" }}>
      <Pressable
        onPress={() => useToasts.getState().dismiss(item.id)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          width: "100%",
          maxWidth: 420,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.card,
          paddingHorizontal: 14,
          paddingVertical: 12,
          shadowColor: palette.shadow,
          shadowOpacity: 0.22,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 5 },
          elevation: 6,
        }}
      >
        <Ionicons name={icon} size={19} color={color} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: palette.text, fontSize: 13.5, fontWeight: "700" }} numberOfLines={2}>
            {item.message}
          </Text>
          {item.description ? (
            <Text style={{ color: palette.textDim, fontSize: 12, marginTop: 1 }} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Mounted once in App — renders the live toast stack at the top of the screen. */
export function ToastHost() {
  const toasts = useToasts((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 12,
        left: 0,
        right: 0,
        zIndex: 1000,
        elevation: 1000,
        alignItems: "center",
        paddingHorizontal: 14,
      }}
    >
      {toasts.map((t) => (
        <ToastRow key={t.id} item={t} />
      ))}
    </View>
  );
}
