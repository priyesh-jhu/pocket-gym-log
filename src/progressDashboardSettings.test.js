import test from "node:test";
import assert from "node:assert/strict";
import { DASHBOARD_KEY, PROGRESS_GROUP_IDS, normalizeDashboardSettings, updateDashboardSettings } from "./progressDashboardSettings.js";

const prefs = value => ({ [DASHBOARD_KEY]: value });

test("migrates all five legacy cards and uses the earliest daily position", () => {
  const settings = normalizeDashboardSettings(prefs({ cardOrder: ["heatmap", "calendar", "summary", "trend", "balance"] }));
  assert.deepEqual(settings.cardOrder, ["heatmap", "trend", "balance", "volumeTrend", "rpeTrend", "dayTypeTrend", "muscleBalanceTrend", "e1rm", "relativeStrength", "strength"]);
});

test("repairs duplicate and missing identifiers", () => {
  const settings = normalizeDashboardSettings(prefs({ cardOrder: ["balance", "balance", "unknown"] }));
  assert.deepEqual(settings.cardOrder, ["balance", "trend", "volumeTrend", "rpeTrend", "dayTypeTrend", "muscleBalanceTrend", "heatmap", "e1rm", "relativeStrength", "strength"]);
  assert.deepEqual([...settings.cardOrder].sort(), [...PROGRESS_GROUP_IDS].sort());
});

test("upgrades a saved order that still exactly matches an old shipped default", () => {
  const sevenItem = normalizeDashboardSettings(prefs({ cardOrder: ["e1rm", "trend", "heatmap", "balance", "strength", "dayTypeTrend", "volumeTrend"] }));
  assert.deepEqual(sevenItem.cardOrder, PROGRESS_GROUP_IDS);
  const fiveItem = normalizeDashboardSettings(prefs({ cardOrder: ["e1rm", "trend", "heatmap", "balance", "strength"] }));
  assert.deepEqual(fiveItem.cardOrder, PROGRESS_GROUP_IDS);
  const sevenThemed = normalizeDashboardSettings(prefs({ cardOrder: ["trend", "volumeTrend", "dayTypeTrend", "balance", "heatmap", "e1rm", "strength"] }));
  assert.deepEqual(sevenThemed.cardOrder, PROGRESS_GROUP_IDS);
});

test("leaves a genuinely customized order untouched", () => {
  const settings = normalizeDashboardSettings(prefs({ cardOrder: ["e1rm", "strength", "trend", "heatmap", "balance", "dayTypeTrend", "volumeTrend"] }));
  assert.deepEqual(settings.cardOrder, ["e1rm", "strength", "trend", "heatmap", "balance", "dayTypeTrend", "volumeTrend", "rpeTrend", "muscleBalanceTrend", "relativeStrength"]);
});

test("treats a missing card order as legacy and hides Daily only when all legacy parts were hidden", () => {
  const partial = normalizeDashboardSettings(prefs({ hiddenCards: ["summary", "calendar"] }));
  const complete = normalizeDashboardSettings(prefs({ hiddenCards: ["summary", "calendar", "trend"] }));
  assert.equal(partial.hiddenCards.includes("trend"), false);
  assert.equal(complete.hiddenCards.includes("trend"), true);
});

test("preserves normalized hidden Daily trend through repeated normalization", () => {
  const raw = prefs({ cardOrder: ["e1rm", "trend", "heatmap", "balance"], hiddenCards: ["trend"] });
  const first = normalizeDashboardSettings(raw);
  const second = normalizeDashboardSettings(prefs(first));
  assert.deepEqual(first, second);
  assert.deepEqual(second.cardOrder, ["e1rm", "trend", "heatmap", "balance", "volumeTrend", "rpeTrend", "dayTypeTrend", "muscleBalanceTrend", "relativeStrength", "strength"]);
  assert.deepEqual(second.hiddenCards, ["trend"]);
});

test("normalization is idempotent and same-value updates preserve identity", () => {
  const first = normalizeDashboardSettings(prefs({ cardOrder: ["trend", "heatmap"] }));
  assert.deepEqual(normalizeDashboardSettings(prefs(first)), first);
  assert.equal(updateDashboardSettings(first, { rangeDays: first.rangeDays }), first);
  assert.notEqual(updateDashboardSettings(first, { rangeDays: 28 }), first);
});
