// More — hub for the secondary views + profile summary.

import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useApp } from "../store";
import { Card, OfflinePill, Screen, ViewHeader, usePalette } from "../components/ui";
import type { Palette } from "../theme";

export default function MoreScreen() {
  const { palette } = usePalette();
  const navigation = useNavigation<any>();
  const auth = useApp((s) => s.auth);
  const pending = useApp((s) => s.pending);
  const online = useApp((s) => s.online);

  const initial = (auth?.name ?? auth?.email ?? "M")[0].toUpperCase();

  const items: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    desc: string;
    route: string;
    color: string;
  }[] = [
    { icon: "repeat-outline", label: "Routine", desc: "Habits & daily schedule", route: "Routine", color: "#34d399" },
    { icon: "flag-outline", label: "Goals", desc: "Track what you're building", route: "Goals", color: "#fbbf24" },
    { icon: "create-outline", label: "Notes", desc: "Quick capture & ideas", route: "Notes", color: "#a78bfa" },
    { icon: "book-outline", label: "Diary", desc: "Daily journal with mood", route: "Diary", color: "#fb7185" },
    { icon: "settings-outline", label: "Settings", desc: "Account, sync, backups", route: "Settings", color: "#2dd4bf" },
  ];

  return (
    <Screen>
      <ViewHeader title="More" subtitle="Your life, organized" />
      <OfflinePill />

      <Card onPress={() => navigation.navigate("Settings")}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 999,
              backgroundColor: palette.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "800", color: palette.primary }}>{initial}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: palette.text }}>
              {auth ? (auth.name ?? "Signed in") : "Local mode"}
            </Text>
            <Text style={{ fontSize: 12.5, color: palette.textDim, marginTop: 2 }} numberOfLines={1}>
              {auth
                ? `${auth.email}${online && pending > 0 ? ` · ${pending} pending` : ""}`
                : "Sign in to sync with the web app"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.textFaint} />
        </View>
      </Card>

      {items.map((it) => (
        <Card key={it.route} onPress={() => navigation.navigate(it.route)}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: `${it.color}22`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={it.icon} size={20} color={it.color} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ fontSize: 15.5, fontWeight: "700", color: palette.text }}>{it.label}</Text>
              <Text style={{ fontSize: 12.5, color: palette.textDim, marginTop: 1 }}>{it.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textFaint} />
          </View>
        </Card>
      ))}

      <Text style={{ textAlign: "center", color: palette.textFaint, fontSize: 12, marginTop: 18 }}>
        Momentum · works fully offline · syncs when you sign in
      </Text>
    </Screen>
  );
}
