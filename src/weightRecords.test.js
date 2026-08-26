import test from "node:test";
import assert from "node:assert/strict";
import {
  bodyweightOnOrNearest,
  buildWeightView,
  commitWeightMutation,
  createWeightCloudOperation,
  normalizeBodyweights,
  prepareWeightMutation,
} from "./weightRecords.js";

// Every date here is a LOCAL calendar date. Assertions are written so that a
// `new Date(iso)` (UTC) parse anywhere in this module fails the run in a
// negative-offset timezone, which is what `npm run test:tz` exercises.

test("normalizeBodyweights keeps every finite stored weight, including zero and negative legacy values", () => {
  const entries = normalizeBodyweights([
    { id: "a", date: "2026-08-01", weight: 180, unit: "lb" },
    { id: "b", date: "2026-08-02", weight: 0, unit: "lb" },
    { id: "c", date: "2026-08-03", weight: -5, unit: "lb" },
    { id: "d", date: "2026-08-04", weight: "not a number", unit: "lb" },
    { id: "e", date: "not-a-date", weight: 150, unit: "lb" },
    "not an object",
    null,
  ]);
  assert.deepEqual(entries.map(e => e.id), ["a", "b", "c"]);
});

test("bodyweightOnOrNearest picks the closest entry on or before the date, in lb", () => {
  const entries = [
    { id: "a", date: "2026-08-01", weight: 180, unit: "lb" },
    { id: "b", date: "2026-08-10", weight: 80, unit: "kg" },
  ];
  assert.equal(bodyweightOnOrNearest(entries, "2026-08-05").weightLb, 180);
  assert.equal(Math.round(bodyweightOnOrNearest(entries, "2026-08-15").weightLb), 176);
});

test("bodyweightOnOrNearest falls back to the earliest entry when the date predates all weigh-ins", () => {
  const entries = [{ id: "a", date: "2026-08-10", weight: 180, unit: "lb" }];
  assert.equal(bodyweightOnOrNearest(entries, "2026-01-01").date, "2026-08-10");
});

test("bodyweightOnOrNearest returns null with no usable weigh-ins", () => {
  assert.equal(bodyweightOnOrNearest([], "2026-08-05"), null);
});

test("buildWeightView with zero entries never fabricates a summary", () => {
  const view = buildWeightView([], "lb");
  assert.equal(view.summary.latest, null);
  assert.equal(view.summary.netChange, null);
  assert.equal(view.summary.count, 0);
  assert.equal(view.chart.hasTrend, false);
});

test("buildWeightView with one entry returns a real net change and a partial chart", () => {
  const view = buildWeightView([{ id: "a", date: "2026-08-10", weight: 180, unit: "lb" }], "lb");
  assert.equal(view.summary.latest.value, 180);
  assert.equal(view.summary.netChange.value, 0);
  assert.equal(view.chart.hasTrend, false);
  assert.equal(view.chart.points.length, 1);
});

test("buildWeightView converts mixed stored units for display without rewriting them", () => {
  const bodyweights = [
    { id: "a", date: "2026-08-01", weight: 200, unit: "lb" },
    { id: "b", date: "2026-08-08", weight: 88, unit: "kg" }, // ~194.0 lb
  ];
  const view = buildWeightView(bodyweights, "kg");
  assert.equal(view.summary.latest.value, 88);
  // net change is negative-ish in kg terms (200 lb -> ~90.7 kg oldest, 88 kg latest)
  assert.equal(view.summary.netChange.unit, "kg");
  assert.equal(bodyweights[0].unit, "lb");
  assert.equal(bodyweights[1].unit, "kg");
});

test("seven-day average uses local ISO calendar subtraction across a month boundary", () => {
  const bodyweights = [
    { id: "a", date: "2026-07-28", weight: 180, unit: "lb" },
    { id: "b", date: "2026-08-01", weight: 190, unit: "lb" },
  ];
  const view = buildWeightView(bodyweights, "lb");
  const last = view.chart.points.at(-1);
  // 2026-08-01 minus 6 days is 2026-07-26, so both entries fall in the window.
  assert.equal(last.trend, 185);
});

test("prepareWeightMutation adding onto an existing date preserves that date's id", () => {
  const bodyweights = [{ id: "existing", date: "2026-08-10", weight: 180, unit: "lb" }];
  const result = prepareWeightMutation(bodyweights, { date: "2026-08-10", weight: "182", unit: "lb" });
  assert.equal(result.ok, true);
  assert.equal(result.entry.id, "existing");
  assert.equal(result.nextWeights.length, 1);
  assert.equal(result.nextWeights[0].weight, 182);
});

test("prepareWeightMutation editing a date move keeps the edited id and replaces the target-date collision", () => {
  const bodyweights = [
    { id: "mover", date: "2026-08-10", weight: 180, unit: "lb" },
    { id: "target", date: "2026-08-12", weight: 175, unit: "lb" },
  ];
  const result = prepareWeightMutation(bodyweights, { date: "2026-08-12", weight: "179", unit: "lb" }, { editingId: "mover" });
  assert.equal(result.ok, true);
  assert.equal(result.entry.id, "mover");
  assert.deepEqual(result.nextWeights.map(e => e.id), ["mover"]);
  assert.deepEqual(result.cloud, { kind: "move", oldDate: "2026-08-10", newDate: "2026-08-12" });
});

test("prepareWeightMutation rejects a non-positive weight without mutating the source", () => {
  const bodyweights = [{ id: "a", date: "2026-08-10", weight: 180, unit: "lb" }];
  const result = prepareWeightMutation(bodyweights, { date: "2026-08-10", weight: "0", unit: "lb" });
  assert.equal(result.ok, false);
  assert.equal(result.field, "weight");
  assert.equal(bodyweights.length, 1);
});

test("commitWeightMutation leaves state untouched when the local write fails", () => {
  let applied = false;
  const result = commitWeightMutation({ nextWeights: [{ id: "a" }], writeLocal: () => false, applyState: () => { applied = true; } });
  assert.equal(result.ok, false);
  assert.equal(result.localCommitted, false);
  assert.equal(applied, false);
});

test("commitWeightMutation applies state only after a confirmed local write", () => {
  let applied = null;
  const nextWeights = [{ id: "a" }];
  const result = commitWeightMutation({ nextWeights, writeLocal: () => true, applyState: value => { applied = value; } });
  assert.equal(result.ok, true);
  assert.equal(result.localCommitted, true);
  assert.equal(applied, nextWeights);
});

test("createWeightCloudOperation awaits the old-date delete before the new-date save", async () => {
  const order = [];
  const operation = createWeightCloudOperation({
    deleteOld: async () => { order.push("delete"); },
    saveNew: async () => { order.push("save"); },
  });
  await operation();
  assert.deepEqual(order, ["delete", "save"]);
});
