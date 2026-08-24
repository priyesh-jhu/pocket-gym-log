import test from "node:test";
import assert from "node:assert/strict";
import { commitHistoryMutation, createDraftSet, createHistoryDraft, groupSessionsByMonth, normalizeHistorySessions, prepareHistoryUpdate } from "./historyRecords.js";

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

// ─── EDITING ──────────────────────────────────────────────────────────────────

const confirmed = () => ({
  id: "session_1755100000000",
  date: "2026-08-14",
  day: "MON",
  notes: "solid",
  startedAt: "2026-08-14T17:00:00.000Z",
  completedAt: "2026-08-14T18:04:00.000Z",
  readiness: { energy: 4, sleep: 3, soreness: 2, pain: false },
  perceivedEffort: 8,
  exercises: [
    { name: "Barbell Bench Press", equipment: "free", tracking: "weighted", target: "3 x 8-12", sets: [mkSet("135", "8"), mkSet("140", "6")] },
    { name: "Hanging Leg Raises", tracking: "bodyweight", sets: [{ weight: "", reps: "12", unit: "lb", rpe: 7 }] },
  ],
});

test("a normalized set includes rpe and its display text includes it when present", () => {
  const record = normalizeHistorySessions([confirmed()])[0];
  const rated = record.exercises[1].sets[0];
  assert.equal(rated.rpe, 7);
  assert.equal(rated.display.includes("RPE 7"), true);
});

test("a set without rpe displays with no RPE text", () => {
  const record = normalizeHistorySessions([confirmed()])[0];
  const unrated = record.exercises[0].sets[0];
  assert.equal(unrated.rpe, null);
  assert.equal(unrated.display.includes("RPE"), false);
});

test("a draft's set rpe is editable and round-trips through an update", () => {
  const original = confirmed();
  const draft = createHistoryDraft(original);
  assert.equal(draft.exercises[1].sets[0].rpe, "7");
  draft.exercises[1].sets[0].rpe = "9";
  const { session } = prepareHistoryUpdate(original, draft);
  assert.equal(session.exercises[1].sets[0].rpe, 9);
});

test("clearing a draft's rpe stores null", () => {
  const original = confirmed();
  const draft = createHistoryDraft(original);
  draft.exercises[1].sets[0].rpe = "";
  const { session } = prepareHistoryUpdate(original, draft);
  assert.equal(session.exercises[1].sets[0].rpe, null);
});

test("a draft is a deep copy: editing it never touches the confirmed record", () => {
  const original = confirmed();
  const snapshot = JSON.parse(JSON.stringify(original));
  const draft = createHistoryDraft(original);

  draft.date = "2026-08-01";
  draft.day = "TUE";
  draft.notes = "changed";
  draft.exercises[0].name = "Renamed";
  draft.exercises[0].sets[0].weight = "999";
  draft.exercises[0].sets.push(createDraftSet(draft.exercises[0], "new-1"));
  draft.exercises[1].sets.pop();

  assert.deepEqual(original, snapshot);
  assert.notEqual(draft.exercises, original.exercises);
  assert.notEqual(draft.exercises[0].sets[0], original.exercises[0].sets[0]);
});

test("a draft mirrors stored order, names, units and tracking as editable strings", () => {
  const draft = createHistoryDraft(confirmed());
  assert.deepEqual(draft.exercises.map(item => item.name), ["Barbell Bench Press", "Hanging Leg Raises"]);
  assert.deepEqual(draft.exercises.map(item => item.tracking), ["weighted", "bodyweight"]);
  assert.equal(draft.exercises[0].sets[0].weight, "135");
  assert.equal(draft.exercises[0].sets[0].reps, "8");
  assert.equal(draft.exercises[0].sets[0].unit, "lb");
  assert.equal(draft.date, "2026-08-14");
  assert.equal(draft.day, "MON");
});

test("a valid update accepts date, day, name, note and set edits", () => {
  const original = confirmed();
  const draft = createHistoryDraft(original);
  draft.date = "2026-07-31";
  draft.day = "WED";
  draft.notes = "  edited note  ";
  draft.exercises[0].name = " Incline Bench Press ";
  draft.exercises[0].sets[1].reps = "7";
  const result = prepareHistoryUpdate(original, draft);

  assert.equal(result.ok, true);
  assert.equal(result.session.date, "2026-07-31");
  assert.equal(result.session.day, "WED");
  assert.equal(result.session.notes, "edited note");
  assert.equal(result.session.exercises[0].name, "Incline Bench Press");
  assert.equal(result.session.exercises[0].sets[1].reps, "7");
});

test("an update preserves the id, completion metadata and untouched stored fields", () => {
  const original = confirmed();
  const draft = createHistoryDraft(original);
  draft.notes = "note only";
  const { session } = prepareHistoryUpdate(original, draft);

  assert.equal(session.id, original.id);
  assert.equal(session.startedAt, original.startedAt);
  assert.equal(session.completedAt, original.completedAt);
  assert.deepEqual(session.readiness, original.readiness);
  assert.equal(session.perceivedEffort, 8);
  assert.deepEqual(session.exercises.map(item => item.name), ["Barbell Bench Press", "Hanging Leg Raises"]);
  assert.equal(session.exercises[0].equipment, "free");
  assert.equal(session.exercises[0].target, "3 x 8-12");
  assert.equal(session.exercises[0].tracking, "weighted");
  assert.equal(session.exercises[1].sets[0].rpe, 7);
  assert.equal(session.exercises[1].sets[0].unit, "lb");
});

test("prepared sets carry no transient edit-only fields", () => {
  const original = confirmed();
  const draft = createHistoryDraft(original);
  draft.exercises[0].sets[0].done = true;
  const { session } = prepareHistoryUpdate(original, draft);
  for (const exercise of session.exercises) {
    assert.equal("key" in exercise, false);
    assert.equal("sourceIndex" in exercise, false);
    for (const set of exercise.sets) {
      assert.equal("key" in set, false);
      assert.equal("sourceIndex" in set, false);
      assert.equal("done" in set, false);
    }
  }
});

test("weighted sets need a finite non-negative weight and positive reps", () => {
  const original = confirmed();
  const cases = [
    { weight: "", reps: "8" },
    { weight: "abc", reps: "8" },
    { weight: "-5", reps: "8" },
    { weight: "135", reps: "0" },
    { weight: "135", reps: "-3" },
    { weight: "135", reps: "" },
  ];
  for (const values of cases) {
    const draft = createHistoryDraft(original);
    draft.exercises[1].sets = [];
    draft.exercises[0].sets = [{ ...draft.exercises[0].sets[0], ...values }];
    const result = prepareHistoryUpdate(original, draft);
    assert.equal(result.ok, false, `expected ${JSON.stringify(values)} to be rejected`);
    assert.equal(result.session, null);
  }
  const zeroWeight = createHistoryDraft(original);
  zeroWeight.exercises[0].sets = [{ ...zeroWeight.exercises[0].sets[0], weight: "0", reps: "10" }];
  assert.equal(prepareHistoryUpdate(original, zeroWeight).ok, true);
});

test("bodyweight, timed and distance sets need their own positive result only", () => {
  for (const [name, tracking] of [["Hanging Leg Raises", "bodyweight"], ["Plank w/ Shoulder Taps", "timed"], ["Farmer's Carries", "distance"]]) {
    const original = { id: "s1", date: "2026-08-14", day: "MON", exercises: [{ name, tracking, sets: [{ weight: "", reps: "30", unit: "lb" }] }] };
    const draft = createHistoryDraft(original);
    assert.equal(draft.exercises[0].tracking, tracking);
    assert.equal(prepareHistoryUpdate(original, draft).ok, true, `${name} should accept a result without weight`);

    const blank = createHistoryDraft(original);
    blank.exercises[0].sets[0].reps = "";
    const rejected = prepareHistoryUpdate(original, blank);
    assert.equal(rejected.ok, false);
    assert.equal(rejected.field, "sets");
  }
});

test("an update with no complete set fails and leaves the original deeply unchanged", () => {
  const original = confirmed();
  const snapshot = JSON.parse(JSON.stringify(original));
  const draft = createHistoryDraft(original);
  for (const exercise of draft.exercises) exercise.sets = [];
  const result = prepareHistoryUpdate(original, draft);

  assert.equal(result.ok, false);
  assert.equal(result.session, null);
  assert.equal(result.field, "sets");
  assert.match(result.error, /at least one complete set/i);
  assert.deepEqual(original, snapshot);
});

test("exercises whose sets are all incomplete drop out while the rest are kept", () => {
  const original = confirmed();
  const draft = createHistoryDraft(original);
  draft.exercises[1].sets[0].reps = "";
  const { ok, session } = prepareHistoryUpdate(original, draft);
  assert.equal(ok, true);
  assert.deepEqual(session.exercises.map(item => item.name), ["Barbell Bench Press"]);
});

test("an invalid date or unsupported day is rejected with the offending field", () => {
  const original = confirmed();
  for (const date of ["", "14/08/2026", "2026-8-14", "2026-02-30", "not-a-date"]) {
    const draft = createHistoryDraft(original);
    draft.date = date;
    const result = prepareHistoryUpdate(original, draft);
    assert.equal(result.ok, false, `expected ${date} to be rejected`);
    assert.equal(result.field, "date");
  }
  const badDay = createHistoryDraft(original);
  badDay.day = "SATURDAY";
  const dayResult = prepareHistoryUpdate(original, badDay);
  assert.equal(dayResult.ok, false);
  assert.equal(dayResult.field, "day");
  assert.equal(prepareHistoryUpdate(original, createHistoryDraft(original)).ok, true);
});

test("a legacy day the app no longer offers survives an unrelated edit", () => {
  const original = { ...confirmed(), day: "SAT" };
  const draft = createHistoryDraft(original);
  draft.notes = "kept";
  const result = prepareHistoryUpdate(original, draft);
  assert.equal(result.ok, true);
  assert.equal(result.session.day, "SAT");
});

test("an empty exercise name is rejected before anything is written", () => {
  const original = confirmed();
  const draft = createHistoryDraft(original);
  draft.exercises[0].name = "   ";
  const result = prepareHistoryUpdate(original, draft);
  assert.equal(result.ok, false);
  assert.match(result.field, /^exercise-/);
});

test("a malformed stored exercise never blocks saving the rest of the record", () => {
  const original = { ...confirmed(), exercises: [null, confirmed().exercises[0]] };
  const draft = createHistoryDraft(original);
  draft.notes = "still saveable";
  const result = prepareHistoryUpdate(original, draft);
  assert.equal(result.ok, true);
  assert.deepEqual(result.session.exercises.map(item => item.name), ["Barbell Bench Press"]);
});

test("a garbage draft or missing original is rejected safely", () => {
  assert.equal(prepareHistoryUpdate(null, createHistoryDraft(confirmed())).ok, false);
  assert.equal(prepareHistoryUpdate(confirmed(), null).ok, false);
  assert.equal(createHistoryDraft(null), null);
});

// ─── COMMIT ORDERING ──────────────────────────────────────────────────────────

test("a successful commit writes the device, then state, then the cloud mirror", () => {
  const calls = [];
  const nextSessions = [{ id: "s1" }];
  const result = commitHistoryMutation({
    nextSessions,
    writeLocal: value => { calls.push(`write:${value.length}`); return true; },
    applyState: value => { calls.push(`state:${value === nextSessions}`); },
    mirrorCloud: () => calls.push("cloud"),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["write:1", "state:true", "cloud"]);
});

test("a false device write invokes neither state nor cloud", () => {
  const calls = [];
  const result = commitHistoryMutation({
    nextSessions: [],
    writeLocal: () => { calls.push("write"); return false; },
    applyState: () => calls.push("state"),
    mirrorCloud: () => calls.push("cloud"),
  });
  assert.equal(result.ok, false);
  assert.ok(result.error instanceof Error);
  assert.deepEqual(calls, ["write"]);
});

test("a throwing device write invokes neither state nor cloud", () => {
  const calls = [];
  const result = commitHistoryMutation({
    nextSessions: [],
    writeLocal: () => { calls.push("write"); throw new Error("quota exceeded"); },
    applyState: () => calls.push("state"),
    mirrorCloud: () => calls.push("cloud"),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.message, "quota exceeded");
  assert.deepEqual(calls, ["write"]);
});

test("an absent cloud mirror is optional and never blocks a local success", () => {
  const calls = [];
  const result = commitHistoryMutation({
    nextSessions: [],
    writeLocal: () => { calls.push("write"); return true; },
    applyState: () => calls.push("state"),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["write", "state"]);
});

test("a throwing cloud mirror does not undo a confirmed local save", () => {
  const result = commitHistoryMutation({
    nextSessions: [],
    writeLocal: () => true,
    applyState: () => {},
    mirrorCloud: () => { throw new Error("offline"); },
  });
  assert.equal(result.ok, true);
  assert.equal(result.mirrorError.message, "offline");
});

test("a commit never mutates the confirmed collection it was handed", () => {
  const nextSessions = [{ id: "s1", exercises: [{ name: "Squat", sets: [mkSet("225", "5")] }] }];
  const snapshot = JSON.stringify(nextSessions);
  commitHistoryMutation({ nextSessions, writeLocal: () => true, applyState: () => {}, mirrorCloud: () => {} });
  commitHistoryMutation({ nextSessions, writeLocal: () => false, applyState: () => {}, mirrorCloud: () => {} });
  assert.equal(JSON.stringify(nextSessions), snapshot);
});

// These two model exactly what App's save and delete adapters inject, so the
// ordering contract is proven for the real cloud operations, not just abstractly.
test("an edit commit mirrors a cloud session save only after the device write", () => {
  const calls = [];
  const stored = [confirmed()];
  const edited = { ...confirmed(), notes: "edited" };
  const result = commitHistoryMutation({
    nextSessions: stored.map(item => (item.id === edited.id ? edited : item)),
    writeLocal: value => { calls.push(`writeSessions:${value[0].notes}`); return true; },
    applyState: value => calls.push(`setSessions:${value[0].notes}`),
    mirrorCloud: () => calls.push(`saveCloudSession:${edited.id}`),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["writeSessions:edited", "setSessions:edited", `saveCloudSession:${edited.id}`]);
});

test("a delete commit mirrors a cloud session delete only after the device write", () => {
  const calls = [];
  const stored = [confirmed(), { ...confirmed(), id: "session_keep" }];
  const removedId = stored[0].id;
  const result = commitHistoryMutation({
    nextSessions: stored.filter(item => item.id !== removedId),
    writeLocal: value => { calls.push(`writeSessions:${value.length}`); return true; },
    applyState: value => calls.push(`setSessions:${value.length}`),
    mirrorCloud: () => calls.push(`deleteCloudSession:${removedId}`),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["writeSessions:1", "setSessions:1", `deleteCloudSession:${removedId}`]);
});

test("a failed delete leaves the workout in the confirmed collection", () => {
  const calls = [];
  const stored = [confirmed()];
  const result = commitHistoryMutation({
    nextSessions: stored.filter(item => item.id !== stored[0].id),
    writeLocal: () => { calls.push("writeSessions"); return false; },
    applyState: () => calls.push("setSessions"),
    mirrorCloud: () => calls.push("deleteCloudSession"),
  });
  assert.equal(result.ok, false);
  assert.deepEqual(calls, ["writeSessions"]);
  assert.equal(stored.length, 1);
});

test("a commit without a usable list or writer refuses rather than guessing", () => {
  assert.equal(commitHistoryMutation({ nextSessions: null, writeLocal: () => true }).ok, false);
  assert.equal(commitHistoryMutation({ nextSessions: [], writeLocal: null }).ok, false);
});
