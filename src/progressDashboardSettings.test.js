import test from "node:test";
import assert from "node:assert/strict";
import { DASHBOARD_KEY, PROGRESS_GROUP_IDS, normalizeDashboardSettings, updateDashboardSettings } from "./progressDashboardSettings.js";

const prefs = value => ({ [DASHBOARD_KEY]: value });

test("migrates all five legacy cards and uses the earliest daily position", () => {
  const settings = normalizeDashboardSettings(prefs({ cardOrder: ["heatmap", "calendar", "summary", "trend", "balance"] }));
  assert.deepEqual(settings.cardOrder, ["e1rm", "heatmap", "trend", "balance", "strength"]);
});

test("repairs duplicate and missing identifiers", () => {
  const settings = normalizeDashboardSettings(prefs({ cardOrder: ["balance", "balance", "unknown"] }));
  assert.deepEqual(settings.cardOrder, ["e1rm", "balance", "trend", "heatmap", "strength"]);
  assert.deepEqual([...settings.cardOrder].sort(), [...PROGRESS_GROUP_IDS].sort());
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
  assert.deepEqual(second.cardOrder, ["e1rm", "trend", "heatmap", "balance", "strength"]);
  assert.deepEqual(second.hiddenCards, ["trend"]);
});

test("normalization is idempotent and same-value updates preserve identity", () => {
  const first = normalizeDashboardSettings(prefs({ cardOrder: ["trend", "heatmap"] }));
  assert.deepEqual(normalizeDashboardSettings(prefs(first)), first);
  assert.equal(updateDashboardSettings(first, { rangeDays: first.rangeDays }), first);
  assert.notEqual(updateDashboardSettings(first, { rangeDays: 28 }), first);
});
