import test from "node:test";
import assert from "node:assert/strict";
import { groupSessionsByMonth, normalizeHistorySessions } from "./historyRecords.js";

// Every date here is a LOCAL calendar date. These assertions are written so
// that a `new Date(iso)` (UTC) parse anywhere in the module fails the run in a
// negative-offset timezone, which is what `npm run test:tz` exercises.

const mkSet = (weight, reps, unit = "lb") => ({ weight, reps, unit });
const mkSession = (id, date, extra = {}) => ({
  id,
  date,
  day: "MON",
  notes: "",
  exercises: [{ name: "Barbell Bench Press", sets: [mkSet("135", "8")] }],
  ...extra,
});

test("groups valid sessions by local month, newest month and newest session first", () => {
  const groups = groupSessionsByMonth([
    mkSession("a", "2026-07-04"),
    mkSession("b", "2026-08-01"),
    mkSession("c", "2026-08-14"),
    mkSession("d", "2026-06-30"),
  ]);
  assert.deepEqual(groups.map(group => group.key), ["2026-08", "2026-07", "2026-06"]);
  assert.deepEqual(groups[0].sessions.map(item => item.id), ["c", "b"]);
  assert.equal(groups[0].count, 2);
});

test("month labels come from the stored local date without a UTC shift", () => {
  const [july] = groupSessionsByMonth([mkSession("a", "2026-07-01")]);
  assert.equal(july.key, "2026-07");
  assert.equal(july.label, new Date(2026, 6, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" }));
});

test("the first day of a month never lands in the previous month", () => {
  for (const iso of ["2026-01-01", "2026-03-01", "2026-11-01", "2026-12-31"]) {
    const [group] = groupSessionsByMonth([mkSession("x", iso)]);
    assert.equal(group.key, iso.slice(0, 7));
    assert.equal(group.sessions[0].date, iso);
  }
});

test("readable date labels keep the stored calendar day", () => {
  const [record] = normalizeHistorySessions([mkSession("a", "2026-08-14")]);
  assert.equal(record.date, "2026-08-14");
  assert.equal(record.dateLabel, new Date(2026, 7, 14).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }));
});

test("same-date sessions keep a deterministic newest-first order", () => {
  const first = groupSessionsByMonth([
    mkSession("session_1", "2026-08-14", { completedAt: "2026-08-14T10:00:00.000Z" }),
    mkSession("session_2", "2026-08-14", { completedAt: "2026-08-14T18:00:00.000Z" }),
  ]);
  const reversed = groupSessionsByMonth([
    mkSession("session_2", "2026-08-14", { completedAt: "2026-08-14T18:00:00.000Z" }),
    mkSession("session_1", "2026-08-14", { completedAt: "2026-08-14T10:00:00.000Z" }),
  ]);
  assert.deepEqual(first.at(0).sessions.map(item => item.id), ["session_2", "session_1"]);
  assert.deepEqual(reversed.at(0).sessions.map(item => item.id), first.at(0).sessions.map(item => item.id));
});

test("malformed records are isolated without blanking valid history", () => {
  const records = normalizeHistorySessions([
    null,
    "not a session",
    { date: "2026-08-14" },
    mkSession("valid", "2026-08-14"),
    { id: "no-date", exercises: [] },
    { id: "bad-date", date: "not-a-date", exercises: [] },
    { id: "bad-exercises", date: "2026-08-14", exercises: "nope" },
  ]);
  assert.deepEqual(records.map(item => item.id), ["valid"]);
});

test("non-array input is safe", () => {
  assert.deepEqual(normalizeHistorySessions(undefined), []);
  assert.deepEqual(normalizeHistorySessions({ id: "x" }), []);
  assert.deepEqual(groupSessionsByMonth(null), []);
});

test("valid exercises, sets, notes and metadata survive; malformed fragments are dropped", () => {
  const [record] = normalizeHistorySessions([mkSession("a", "2026-08-14", {
    notes: "  felt strong  ",
    completedAt: "2026-08-14T18:04:00.000Z",
    readiness: { energy: 4, sleep: 3, soreness: 2, pain: false },
    exercises: [
      { name: "Barbell Bench Press", sets: [mkSet("135", "8"), mkSet("140", "6"), null, "bad", mkSet("", "")] },
      { name: "   ", sets: [mkSet("100", "5")] },
      { name: "Plank w/ Shoulder Taps", sets: "not an array" },
      { name: "Farmer's Carries", sets: [mkSet("", "40")] },
    ],
  })]);
  assert.deepEqual(record.exercises.map(item => item.name), ["Barbell Bench Press", "Farmer's Carries"]);
  assert.equal(record.exercises[0].sets.length, 2);
  assert.equal(record.exercises[0].sets[0].display, "135 lb × 8 reps");
  assert.equal(record.exercises[1].tracking, "distance");
  assert.equal(record.exercises[1].sets[0].display, "40 m");
  assert.equal(record.notes, "felt strong");
  assert.equal(record.setCount, 3);
  assert.equal(record.exerciseCount, 2);
  assert.deepEqual(record.readiness, { energy: 4, sleep: 3, soreness: 2, pain: false });
  assert.equal(typeof record.readinessScore, "number");
});

test("normalization never mutates its input", () => {
  const sessions = [mkSession("a", "2026-08-14", { exercises: [{ name: "Squat", sets: [mkSet("225", "5"), null] }] })];
  const snapshot = JSON.stringify(sessions);
  normalizeHistorySessions(sessions);
  groupSessionsByMonth(sessions);
  assert.equal(JSON.stringify(sessions), snapshot);
});

test("missing or unknown day metadata falls back to Workout instead of throwing", () => {
  const records = normalizeHistorySessions([
    mkSession("a", "2026-08-14", { day: "NOPE" }),
    mkSession("b", "2026-08-13", { day: undefined }),
    mkSession("c", "2026-08-12", { day: { label: "injected" } }),
  ]);
  assert.equal(records.length, 3);
  for (const record of records) {
    assert.equal(record.dayLabel, "Workout");
    assert.equal(record.dayEmoji, "");
  }
  const [known] = normalizeHistorySessions([mkSession("d", "2026-08-14", { day: "TUE" })]);
  assert.equal(known.dayLabel, "Pull");
  assert.equal(known.dayEmoji, "🔻");
});

test("volume is reported only when the stored sets support one honest figure", () => {
  const [weighted] = normalizeHistorySessions([mkSession("a", "2026-08-14", {
    exercises: [{ name: "Barbell Bench Press", sets: [mkSet("100", "10"), mkSet("100", "5")] }],
  })]);
  const [mixedUnits] = normalizeHistorySessions([mkSession("b", "2026-08-14", {
    exercises: [{ name: "Barbell Bench Press", sets: [mkSet("100", "10"), mkSet("50", "10", "kg")] }],
  })]);
  const [bodyweightOnly] = normalizeHistorySessions([mkSession("c", "2026-08-14", {
    exercises: [{ name: "Hanging Leg Raises", sets: [mkSet("", "12")] }],
  })]);
  assert.deepEqual(weighted.volume, { value: 1500, unit: "lb" });
  assert.equal(mixedUnits.volume, null);
  assert.equal(bodyweightOnly.volume, null);
});

test("each normalized record carries the exact stored session for editing", () => {
  const stored = mkSession("a", "2026-08-14");
  const [record] = normalizeHistorySessions([stored]);
  assert.equal(record.session, stored);
});
