import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { bigLiftSummary, getStandardsSex, setStandardsSex } from "./strengthStandards.js";

function mkSet(weight, reps, unit = "lb") { return { weight, reps, unit }; }
function mkSession(date, exercises) { return { id: date, date, day: "MON", notes: "", exercises }; }

describe("bigLiftSummary", () => {
  test("falls back to a variant when the canonical lift name has no data", () => {
    const sessions = [mkSession("2026-08-01", [{ name: "Smith Machine Deadlift", sets: [mkSet("300", "5")] }])];
    const result = bigLiftSummary(sessions, 200, "male");
    const deadlift = result.find(item => item.lift === "deadlift");
    assert.equal(deadlift.exerciseName, "Smith Machine Deadlift");
    assert.equal(deadlift.isFallback, true);
  });

  test("assigns the correct tier at a threshold boundary", () => {
    // Single set of 150lb x 1 rep -> e1RM = 150lb (Epley: reps===1 returns load unchanged).
    // 150 / 200 bodyweight = 0.75, which is exactly the male bench "intermediate" threshold.
    const sessions = [mkSession("2026-08-01", [{ name: "Barbell/DB Bench Press", sets: [mkSet("150", "1")] }])];
    const result = bigLiftSummary(sessions, 200, "male");
    const bench = result.find(item => item.lift === "bench");
    assert.equal(bench.ratio, 0.75);
    assert.equal(bench.tier, "intermediate");
  });

  test("tier is null when sex hasn't been set", () => {
    const sessions = [mkSession("2026-08-01", [{ name: "Barbell/DB Bench Press", sets: [mkSet("150", "1")] }])];
    const result = bigLiftSummary(sessions, 200, null);
    assert.equal(result[0].tier, null);
  });

  test("returns an empty array when there is no data for any of the 3 lifts", () => {
    const sessions = [mkSession("2026-08-01", [{ name: "Bicep Curl", sets: [mkSet("30", "10")] }])];
    assert.deepEqual(bigLiftSummary(sessions, 200, "male"), []);
  });
});

describe("getStandardsSex / setStandardsSex", () => {
  test("round-trips through prefs", () => {
    const prefs = setStandardsSex({}, "female");
    assert.equal(getStandardsSex(prefs), "female");
  });

  test("defaults to null when unset", () => {
    assert.equal(getStandardsSex({}), null);
  });
});
