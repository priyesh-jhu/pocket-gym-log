import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  toLb, sessionVolume, weekStartISO, weeklyVolume, weekSummary, muscleBalance,
} from "./stats.js";

function mkSet(weight, reps, unit = "lb") { return { weight, reps, unit }; }
function mkSession(date, exercises) { return { id: date, date, day: "MON", notes: "", exercises }; }

describe("toLb", () => {
  test("converts kg to lb", () => {
    assert.equal(Math.round(toLb("100", "kg")), 220);
  });

  test("returns 0 for blank/NaN weight", () => {
    assert.equal(toLb("", "lb"), 0);
    assert.equal(toLb("abc", "lb"), 0);
  });
});

describe("sessionVolume", () => {
  test("sums correctly across a mixed lb/kg session", () => {
    const session = mkSession("2026-08-10", [
      { name: "A", sets: [mkSet("100", "10", "lb")] },
      { name: "B", sets: [mkSet("100", "10", "kg")] },
    ]);
    // 100*10 lb + (100*2.20462)*10 lb = 1000 + 2204.62
    assert.equal(Math.round(sessionVolume(session)), 3205);
  });
});

describe("weekStartISO", () => {
  test("returns the same date when it is already a Monday", () => {
    assert.equal(weekStartISO("2026-08-10"), "2026-08-10");
  });

  test("returns the preceding Monday when the date is a Sunday", () => {
    assert.equal(weekStartISO("2026-08-16"), "2026-08-10");
  });

  test("buckets correctly across a month boundary", () => {
    // Sun Feb 1 2026 belongs to the week starting Mon Jan 26 2026.
    assert.equal(weekStartISO("2026-02-01"), "2026-01-26");
  });

  test("buckets correctly across a year boundary", () => {
    // Fri Jan 1 2027 belongs to the week starting Mon Dec 28 2026.
    assert.equal(weekStartISO("2027-01-01"), "2026-12-28");
  });
});

describe("weeklyVolume", () => {
  test("returns exactly `weeks` entries including zero-activity gaps", () => {
    const sessions = [mkSession("2026-08-10", [{ name: "A", sets: [mkSet("100", "10")] }])];
    const result = weeklyVolume(sessions, 12, "2026-08-13");
    assert.equal(result.length, 12);
    const nonZero = result.filter(w => w.volume > 0);
    assert.equal(nonZero.length, 1);
    assert.equal(nonZero[0].weekStart, "2026-08-10");
  });

  test("still counts an exercise with no form-guide entry toward volume", () => {
    const sessions = [mkSession("2026-08-10", [{ name: "Totally Made Up Exercise", sets: [mkSet("50", "5")] }])];
    const result = weeklyVolume(sessions, 1, "2026-08-13");
    assert.equal(result[0].volume, 250);
  });
});

describe("weekSummary", () => {
  test("deltaPct is null (not Infinity) when the previous week had no volume", () => {
    const sessions = [mkSession("2026-08-10", [{ name: "A", sets: [mkSet("100", "10")] }])];
    const summary = weekSummary(sessions, "2026-08-13");
    assert.equal(summary.prevVolume, 0);
    assert.equal(summary.deltaPct, null);
  });
});

describe("muscleBalance", () => {
  test("primary [quads, glutes] credits Legs once at 100%, not twice", () => {
    const sessions = [mkSession("2026-08-10", [
      { name: "Back Squat/Goblet Squat", sets: [mkSet("100", "10")] },
    ])];
    const result = muscleBalance(sessions, 4, "2026-08-13");
    assert.equal(result.length, 1);
    assert.equal(result[0].group, "Legs");
    assert.equal(result[0].pct, 100);
  });

  test("an exercise with no form guide is skipped for balance", () => {
    const sessions = [mkSession("2026-08-10", [
      { name: "Totally Made Up Exercise", sets: [mkSet("50", "5")] },
    ])];
    assert.deepEqual(muscleBalance(sessions, 4, "2026-08-13"), []);
  });
});
