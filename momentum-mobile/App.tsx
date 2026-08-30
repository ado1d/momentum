// Momentum app shell — mirrors the web app's mobile layout:
// top bar (brand · search · bell · quick-add · avatar),
// bottom tabs (Dashboard · Tasks · Routine · Goals · More-sheet),
// global Quick Add + toasts.

import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, createNavigationContainerRef, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import * as Network from "expo-network";

import { useApp } from "./src/store";
import { syncNow, scheduleSync } from "./src/sync";
import { usePalette } from "./src/components/ui";
import { toast, ToastHost } from "./src/toast";
import { QuickAddSheet } from "./src/quick-add";
import { BellSheet } from "./src/components/bell-sheet";

import DashboardScreen from "./src/screens/DashboardScreen";
import TasksScreen from "./src/screens/TasksScreen";
import RoutineScreen from "./src/screens/RoutineScreen";
import GoalsScreen from "./src/screens/GoalsScreen";
import FocusScreen from "./src/screens/FocusScreen";
import InsightsScreen from "./src/screens/InsightsScreen";
import NotesScreen from "./src/screens/NotesScreen";
import DiaryScreen from "./src/screens/DiaryScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import SearchScreen from "./src/screens/SearchScreen";
import { scheduleDailyReminder } from "./src/notifications";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const Stack = createNativeStackNavigator<StackParamList>();
const Tabs = createBottomTabNavigator();

export const navigationRef = createNavigationContainerRef<StackParamList>();

type StackParamList = {
  Main: undefined;
  Focus: undefined;
  Insights: undefined;
  Notes: undefined;
  Diary: undefined;
  Settings: undefined;
  Search: undefined;
};

/** More-sheet entries — same list as the web app's MOBILE_MORE_NAV. */
const MORE_ITEMS: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
  route: keyof StackParamList;
  color: string;
}[] = [
  { icon: "timer-outline", label: "Focus", desc: "Pomodoro deep-work timer", route: "Focus", color: "#2dd4bf" },
  { icon: "stats-chart-outline", label: "Insights", desc: "Trends, streaks & analytics", route: "Insights", color: "#34d399" },
  { icon: "create-outline", label: "Notes", desc: "Quick capture & ideas", route: "Notes", color: "#a78bfa" },
  { icon: "book-outline", label: "Diary", desc: "Daily journal & mood", route: "Diary", color: "#fb7185" },
  { icon: "settings-outline", label: "Settings", desc: "Preferences, sync & export", route: "Settings", color: "#fbbf24" },
];

// ── Brand (web: Zap logo + "Momentum / Productivity companion") ──

function Brand() {
  const { palette } = usePalette();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: palette.primary,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: palette.shadow,
          shadowOpacity: 0.2,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        <Ionicons name="flash" size={19} color={palette.onPrimary} />
      </View>
      <View>
        <Text style={{ color: palette.text, fontSize: 16, fontWeight: "800", letterSpacing: -0.3 }}>
          Momentum
        </Text>
        <Text
          style={{
            color: palette.textDim,
            fontSize: 8.5,
            fontWeight: "700",
            letterSpacing: 1.4,
            textTransform: "uppercase",
            marginTop: 1,
          }}
        >
          Productivity companion
        </Text>
      </View>
    </View>
  );
}

// ── Top bar (web mobile header) ──────────────────────────────

function TopBar({ onBell }: { onBell: () => void }) {
  const { palette } = usePalette();
  const auth = useApp((s) => s.auth);
  const setQuickAddOpen = useApp((s) => s.setQuickAddOpen);
  const insets = useSafeAreaInsets();
  const initial = (auth?.name ?? auth?.email ?? "M")[0]?.toUpperCase() ?? "M";
  return (
    <SafeAreaView
      edges={["top"]}
      style={{
        backgroundColor: palette.bg,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        <Brand />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Pressable
            onPress={() => navigationRef.navigate("Search")}
            hitSlop={6}
            style={{ padding: 8, borderRadius: 12 }}
          >
            <Ionicons name="search" size={20} color={palette.textDim} />
          </Pressable>
          <Pressable onPress={onBell} hitSlop={6} style={{ padding: 8, borderRadius: 12 }}>
            <Ionicons name="notifications-outline" size={20} color={palette.textDim} />
          </Pressable>
          <Pressable
            onPress={() => setQuickAddOpen(true)}
            hitSlop={6}
            style={{
              padding: 8,
              borderRadius: 12,
              marginLeft: 2,
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                backgroundColor: palette.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="add" size={22} color={palette.onPrimary} />
            </View>
          </Pressable>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              backgroundColor: palette.primarySoft,
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 6,
              borderWidth: 1,
              borderColor: palette.border,
            }}
          >
            <Text style={{ color: palette.primary, fontSize: 14, fontWeight: "800" }}>{initial}</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Bottom tabs (web BottomNav: Dashboard · Tasks · Routine · Goals · More) ──

type TabParamList = {
  Dashboard: undefined;
  Tasks: undefined;
  Routine: undefined;
  Goals: undefined;
  MoreTab: undefined;
};

const TAB_ITEMS: { name: keyof TabParamList; label: string; icon: keyof typeof Ionicons.glyphMap; component: React.ComponentType }[] = [
  { name: "Dashboard", label: "Dashboard", icon: "grid-outline", component: DashboardScreen },
  { name: "Tasks", label: "Tasks", icon: "list-outline", component: TasksScreen },
  { name: "Routine", label: "Routine", icon: "repeat-outline", component: RoutineScreen },
  { name: "Goals", label: "Goals", icon: "flag-outline", component: GoalsScreen },
];

function MainTabs({ onMore }: { onMore: () => void }) {
  const { palette } = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textDim,
        tabBarStyle: {
          backgroundColor: palette.tabBar,
          borderTopColor: palette.border,
          height: 62 + insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginTop: 1 },
      }}
    >
      {TAB_ITEMS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          component={t.component}
          options={{
            title: t.label,
            tabBarIcon: ({ color, focused }) => (
              <View
                style={{
                  height: 28,
                  paddingHorizontal: 16,
                  borderRadius: 999,
                  backgroundColor: focused ? palette.primary : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={t.icon} size={19} color={focused ? palette.onPrimary : color} />
              </View>
            ),
          }}
        />
      ))}
      <Tabs.Screen
        name="MoreTab"
        component={View}
        options={{
          title: "More",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                height: 28,
                paddingHorizontal: 16,
                borderRadius: 999,
                backgroundColor: focused ? palette.primary : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="menu" size={19} color={focused ? palette.onPrimary : color} />
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            onMore();
          },
        }}
      />
    </Tabs.Navigator>
  );
}

// ── More sheet (web mobile More sheet) ───────────────────────

function MoreSheet({
  visible,
  onClose,
  onNavigate,
}: {
  visible: boolean;
  onClose: () => void;
  onNavigate: (route: keyof StackParamList) => void;
}) {
  const { palette, dark } = usePalette();
  const setTheme = useApp((s) => s.setTheme);
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
          <Text style={{ color: palette.text, fontSize: 16, fontWeight: "800", marginBottom: 12 }}>
            More
          </Text>
          {MORE_ITEMS.map((it) => (
            <Pressable
              key={it.route}
              onPress={() => {
                onClose();
                onNavigate(it.route);
              }}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: palette.card,
                  borderColor: palette.border,
                  borderWidth: 1,
                  borderRadius: 16,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  marginBottom: 8,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  backgroundColor: `${it.color}22`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={it.icon} size={19} color={it.color} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: palette.text, fontSize: 14.5, fontWeight: "700" }}>{it.label}</Text>
                <Text style={{ color: palette.textDim, fontSize: 12, marginTop: 1 }}>{it.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={palette.textFaint} />
            </Pressable>
          ))}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: palette.card,
              borderColor: palette.border,
              borderWidth: 1,
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 12,
              marginTop: 2,
            }}
          >
            <Text style={{ color: palette.text, fontSize: 14, fontWeight: "600" }}>Appearance</Text>
            <Pressable
              onPress={() => setTheme(dark ? "light" : "dark")}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: palette.cardAlt,
                  borderWidth: 1,
                  borderColor: palette.border,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name={dark ? "sunny" : "moon"} size={14} color={palette.primary} />
              <Text style={{ color: palette.primary, fontSize: 12.5, fontWeight: "700" }}>
                {dark ? "Light" : "Dark"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Root ─────────────────────────────────────────────────────

function Root() {
  const { palette, dark } = usePalette();
  const hydrated = useApp((s) => s.hydrated);
  const hydrate = useApp((s) => s.hydrate);
  const theme = useApp((s) => s.theme);
  const auth = useApp((s) => s.auth);
  const system = useColorScheme();
  const [moreOpen, setMoreOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [hydrated]);

  // Connectivity tracking + auto-sync on regain.
  useEffect(() => {
    let lastOnline: boolean | null = null;
    const check = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        useApp.getState().setOnline(!!state.isConnected);
        if (lastOnline === false && state.isConnected) {
          const res = await syncNow(false);
          if (res.ok) toast.success(res.message);
        }
        lastOnline = !!state.isConnected;
      } catch {
        /* offline start */
      }
    };
    void check();
    const interval = setInterval(check, 15000);
    const sub = Network.addNetworkStateListener((state) => {
      useApp.getState().setOnline(!!state.isConnected);
      if (lastOnline === false && state.isConnected) void syncNow(false);
      lastOnline = !!state.isConnected;
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);

  // Sync on app start (after hydration) and arm the daily reminder.
  useEffect(() => {
    if (!hydrated) return;
    if (useApp.getState().auth) {
      void syncNow(false);
    }
    void scheduleDailyReminder().catch(() => undefined);
  }, [hydrated, auth?.token]);

  const navTheme = dark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: palette.bg,
          card: palette.card,
          border: palette.border,
          text: palette.text,
          primary: palette.primary,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: palette.bg,
          card: palette.card,
          border: palette.border,
          text: palette.text,
          primary: palette.primary,
        },
      };

  if (!hydrated) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              backgroundColor: palette.primary,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 18,
            }}
          >
            <Ionicons name="flash" size={32} color={palette.onPrimary} />
          </View>
          <Text style={{ color: palette.text, fontSize: 26, fontWeight: "800", letterSpacing: -0.5 }}>
            Momentum
          </Text>
          <Text style={{ color: palette.textDim, fontSize: 12, marginTop: 4, letterSpacing: 1.2 }}>
            PRODUCTIVITY COMPANION
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["left", "right", "top"]}>
      <StatusBar style={dark ? "light" : "dark"} />
      <View style={{ flex: 1 }}>
        <NavigationContainer ref={navigationRef} theme={navTheme}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
              <Stack.Screen name="Main">
                {() => (
                  <View style={{ flex: 1 }}>
                    <TopBar onBell={() => setBellOpen(true)} />
                    <MainTabs onMore={() => setMoreOpen(true)} />
                  </View>
                )}
              </Stack.Screen>
              <Stack.Screen name="Focus" component={FocusScreen} />
              <Stack.Screen name="Insights" component={InsightsScreen} />
              <Stack.Screen name="Notes" component={NotesScreen} />
              <Stack.Screen name="Diary" component={DiaryScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen
                name="Search"
                component={SearchScreen}
                options={{ animation: "fade" }}
              />
            </Stack.Navigator>
          </KeyboardAvoidingView>
        </NavigationContainer>
      </View>
      <QuickAddSheet />
      <MoreSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        onNavigate={(route) => {
          setMoreOpen(false);
          // Navigate after the sheet dismiss animation settles.
          setTimeout(() => {
            if (navigationRef.isReady()) navigationRef.navigate(route);
          }, 220);
        }}
      />
      <BellSheet visible={bellOpen} onClose={() => setBellOpen(false)} />
      <ToastHost />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}
