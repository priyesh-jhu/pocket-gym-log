import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { deloadReminder } from "./deloadInsight.js";

function mkSet(weight, reps) { return { weight, reps, unit: "lb" }; }
function mkSession(date, weight, reps) { return { date, day: "MON", exercises: [{ name: "Squat", sets: [mkSet(weight, reps)] }] }; }

// "2026-08-25" is a Tuesday in the week starting Monday 2026-08-24, which
// stays the CURRENT (excluded, possibly-partial) week throughout these
// tests. The 4 completed weeks checked are 2026-07-27, 2026-08-03,
// 2026-08-10, 2026-08-17 (oldest to newest).
const TODAY = "2026-08-25";

describe("deloadReminder", () => {
  test("flags 4 weeks of rising volume with no down week", () => {
    const sessions = [
      mkSession("2026-07-28", "100", "5"), // week of 07-27: 500
      mkSession("2026-08-04", "100", "6"), // week of 08-03: 600
      mkSession("2026-08-11", "100", "7"), // week of 08-10: 700
      mkSession("2026-08-18", "100", "8"), // week of 08-17: 800
    ];
    const result = deloadReminder(sessions, TODAY);
    assert.equal(result.type, "deload-week");
    assert.equal(result.weeks.length, 4);
    assert.deepEqual(result.weeks.map(w => w.volume), [500, 600, 700, 800]);
  });

  test("flat volume across 4 weeks still counts as \"held\" and flags", () => {
    const sessions = [
      mkSession("2026-07-28", "100", "5"),
      mkSession("2026-08-04", "100", "5"),
      mkSession("2026-08-11", "100", "5"),
      mkSession("2026-08-18", "100", "5"),
    ];
    assert.notEqual(deloadReminder(sessions, TODAY), null);
  });

  test("a down week clears the flag", () => {
    const sessions = [
      mkSession("2026-07-28", "100", "5"), // 500
      mkSession("2026-08-04", "100", "6"), // 600
      mkSession("2026-08-11", "100", "4"), // 400 -- drop vs previous week
      mkSession("2026-08-18", "100", "8"), // 800
    ];
    assert.equal(deloadReminder(sessions, TODAY), null);
  });

  test("returns null when any of the 4 completed weeks has no volume", () => {
    const sessions = [
      mkSession("2026-08-11", "100", "7"), // week of 08-10 only
      mkSession("2026-08-18", "100", "8"), // week of 08-17 only
    ];
    assert.equal(deloadReminder(sessions, TODAY), null);
  });
});
