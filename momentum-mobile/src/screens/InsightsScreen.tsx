// Insights — charts and stats over your last 7 / 30 days.

import React, { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";

import * as data from "../db";
import { useApp } from "../store";
import {
  Card,
  OfflinePill,
  SectionHeading,
  Segmented,
  StackHeader,
  usePalette,
} from "../components/ui";
import { MOODS } from "../theme";
import { dayKey, minutesToClock } from "../utils";

export default function InsightsScreen() {
  const { palette } = usePalette();
  const version = useApp((s) => s.dataVersion);
  const [range, setRange] = React.useState<"7" | "30">("7");

  const stats = useMemo(
    () => data.statsForDays(parseInt(range, 10)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, range],
  );
  const habits = useMemo(
    () => data.habits(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
  const totals = useMemo(
    () => data.totals(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const days = stats.map((s) => ({
    label: new Date(`${s.key}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" }),
    ...s,
  }));
  const maxCompleted = Math.max(1, ...days.map((d) => d.completed));
  const maxFocus = Math.max(1, ...days.map((d) => d.focusMinutes));
  const totalCompleted = days.reduce((s, d) => s + d.completed, 0);
  const totalFocus = days.reduce((s, d) => s + d.focusMinutes, 0);
  const habitExpected = stats.length * habits.filter((h) => !h.archived).length;
  const habitDone = days.reduce((s, d) => s + d.habitDone, 0);
  const habitPct = habitExpected === 0 ? 0 : Math.round((habitDone / habitExpected) * 100);
  const journalDays = days.filter((d) => d.journalMood).length;

  const moodCounts = new Map<string, number>();
  for (const d of days) {
    if (d.journalMood) moodCounts.set(d.journalMood, (moodCounts.get(d.journalMood) ?? 0) + 1);
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <StackHeader title="Insights" subtitle="Your productivity trends at a glance" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <OfflinePill />

        <Segmented
          value={range}
          onChange={(k) => setRange(k as "7" | "30")}
          options={[
            { key: "7", label: "Last 7 days" },
            { key: "30", label: "Last 30 days" },
          ]}
        />
        <View style={{ height: 12 }} />

      {/* Hero numbers */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Card style={{ flex: 1, marginBottom: 0 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: palette.primary }}>{totalCompleted}</Text>
          <Text style={{ fontSize: 12, color: palette.textDim, marginTop: 2 }}>tasks completed</Text>
        </Card>
        <Card style={{ flex: 1, marginBottom: 0 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: palette.text }}>{minutesToClock(totalFocus)}</Text>
          <Text style={{ fontSize: 12, color: palette.textDim, marginTop: 2 }}>time focused</Text>
        </Card>
      </View>

      <SectionHeading title="Tasks completed per day" />
      <Card>
        <View style={{ flexDirection: "row", alignItems: "flex-end", height: 110, gap: range === "7" ? 10 : 4 }}>
          {days.map((d) => (
            <View key={d.key} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
              <Text style={{ fontSize: 10, color: palette.textDim, marginBottom: 3 }}>{d.completed || ""}</Text>
              <View
                style={{
                  width: "100%",
                  maxWidth: 26,
                  height: `${Math.max(4, (d.completed / maxCompleted) * 100)}%`,
                  minHeight: 3,
                  borderRadius: 5,
                  backgroundColor: d.key === dayKey() ? palette.primary : palette.primaryDim,
                }}
              />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: range === "7" ? 10 : 4, marginTop: 6 }}>
          {days.map((d, i) => (
            <Text key={d.key} style={{ flex: 1, textAlign: "center", fontSize: 9.5, color: palette.textFaint }}>
              {range === "7" ? d.label : i % 5 === 0 ? new Date(`${d.key}T12:00:00`).getDate().toString() : ""}
            </Text>
          ))}
        </View>
      </Card>

      <SectionHeading title="Focus minutes" />
      <Card>
        <View style={{ flexDirection: "row", alignItems: "flex-end", height: 90, gap: range === "7" ? 10 : 4 }}>
          {days.map((d) => (
            <View key={d.key} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
              <View
                style={{
                  width: "100%",
                  maxWidth: 26,
                  height: `${Math.max(4, (d.focusMinutes / maxFocus) * 100)}%`,
                  minHeight: 3,
                  borderRadius: 5,
                  backgroundColor: "#2dd4bf",
                }}
              />
            </View>
          ))}
        </View>
      </Card>

      <SectionHeading title="Habits" />
      <Card>
        <View style={{ flexDirection: "row", alignItems: "baseline" }}>
          <Text style={{ fontSize: 34, fontWeight: "800", color: palette.text }}>{habitPct}%</Text>
          <Text style={{ fontSize: 13, color: palette.textDim, marginLeft: 8 }}>
            consistency over {range} days
          </Text>
        </View>
        {habits.filter((h) => !h.archived).length === 0 ? (
          <Text style={{ color: palette.textFaint, fontSize: 13, marginTop: 8 }}>
            No habits to measure yet — add some in Routine.
          </Text>
        ) : (
          <View style={{ marginTop: 12 }}>
            {habits
              .filter((h) => !h.archived)
              .map((h) => {
                const done = days.filter((d) => d.habitDone > 0 && data.habitLogExists(h.id, d.key)).length;
                return (
                  <View key={h.id} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text style={{ color: palette.text, fontSize: 13, fontWeight: "600" }}>
                        {h.emoji} {h.name}
                      </Text>
                      <Text style={{ color: palette.textDim, fontSize: 12 }}>{h.streak}🔥</Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 3 }}>
                      {days.slice(-14).map((d) => {
                        const ok = data.habitLogExists(h.id, d.key);
                        return (
                          <View
                            key={d.key}
                            style={{
                              flex: 1,
                              height: 8,
                              borderRadius: 3,
                              backgroundColor: ok ? palette.primary : palette.cardAlt,
                            }}
                          />
                        );
                      })}
                    </View>
                  </View>
                );
              })}
          </View>
        )}
      </Card>

      <SectionHeading title="Journal & mood" />
      <Card>
        <Text style={{ color: palette.text, fontSize: 14, fontWeight: "600" }}>
          {journalDays} journaled {journalDays === 1 ? "day" : "days"} in the last {range}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
          {MOODS.map((m) => {
            const n = moodCounts.get(m.key) ?? 0;
            return (
              <View
                key={m.key}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: palette.cardAlt,
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  marginRight: 8,
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 14 }}>{m.emoji}</Text>
                <Text style={{ fontSize: 12, color: palette.textDim, marginLeft: 5, fontWeight: "600" }}>{n}</Text>
              </View>
            );
          })}
        </View>
      </Card>

      <SectionHeading title="All-time" />
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={{ color: palette.textDim, fontSize: 13 }}>Tasks completed</Text>
          <Text style={{ color: palette.text, fontSize: 13, fontWeight: "700" }}>{totals.todosCompleted}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={{ color: palette.textDim, fontSize: 13 }}>Notes written</Text>
          <Text style={{ color: palette.text, fontSize: 13, fontWeight: "700" }}>{totals.notes}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={{ color: palette.textDim, fontSize: 13 }}>Journal entries</Text>
          <Text style={{ color: palette.text, fontSize: 13, fontWeight: "700" }}>{totals.journalEntries}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: palette.textDim, fontSize: 13 }}>Total focus time</Text>
          <Text style={{ color: palette.text, fontSize: 13, fontWeight: "700" }}>{minutesToClock(totals.focusMinutes)}</Text>
        </View>
      </Card>
      </ScrollView>
    </View>
  );
}
