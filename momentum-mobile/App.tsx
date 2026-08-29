import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme, View, Text } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import * as Network from "expo-network";

import { useApp } from "./src/store";
import { syncNow, scheduleSync } from "./src/sync";
import { usePalette } from "./src/components/ui";

import DashboardScreen from "./src/screens/DashboardScreen";
import TasksScreen from "./src/screens/TasksScreen";
import FocusScreen from "./src/screens/FocusScreen";
import InsightsScreen from "./src/screens/InsightsScreen";
import MoreScreen from "./src/screens/MoreScreen";
import RoutineScreen from "./src/screens/RoutineScreen";
import GoalsScreen from "./src/screens/GoalsScreen";
import NotesScreen from "./src/screens/NotesScreen";
import DiaryScreen from "./src/screens/DiaryScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import { scheduleDailyReminder } from "./src/notifications";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function TabIcon({ name, color, size }: { name: keyof typeof Ionicons.glyphMap; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function MainTabs() {
  const { palette } = usePalette();
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textFaint,
        tabBarStyle: {
          backgroundColor: palette.tabBar,
          borderTopColor: palette.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <TabIcon name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          title: "Tasks",
          tabBarIcon: ({ color, size }) => <TabIcon name="checkbox-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="Focus"
        component={FocusScreen}
        options={{
          title: "Focus",
          tabBarIcon: ({ color, size }) => <TabIcon name="timer-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="Insights"
        component={InsightsScreen}
        options={{
          title: "Insights",
          tabBarIcon: ({ color, size }) => <TabIcon name="stats-chart-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="More"
        component={MoreScreen}
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => <TabIcon name="grid-outline" color={color} size={size} />,
        }}
      />
    </Tabs.Navigator>
  );
}

export default function App() {
  const hydrated = useApp((s) => s.hydrated);
  const hydrate = useApp((s) => s.hydrate);
  const theme = useApp((s) => s.theme);
  const system = useColorScheme();
  const { palette, dark } = usePalette();
  const auth = useApp((s) => s.auth);

  useEffect(() => {
    hydrate();
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
          void syncNow(false);
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
      <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: palette.primary, fontSize: 28, fontWeight: "800", letterSpacing: -0.5 }}>
          Momentum
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Routine" component={RoutineScreen} />
        <Stack.Screen name="Goals" component={GoalsScreen} />
        <Stack.Screen name="Notes" component={NotesScreen} />
        <Stack.Screen name="Diary" component={DiaryScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
