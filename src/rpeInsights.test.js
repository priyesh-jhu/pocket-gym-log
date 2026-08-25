import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { grindingInsights } from "./rpeInsights.js";

const session = (date, name, rpes) => ({
  date,
  exercises: [{ name, sets: rpes.map(rpe => ({ weight: "100", reps: "5", unit: "lb", rpe })) }],
});

describe("grindingInsights", () => {
  test("flags an exercise averaging RPE 9+ across the last 3 sessions", () => {
    const result = grindingInsights([
      session("2026-08-01", "Squat", [9, 9]),
      session("2026-08-03", "Squat", [9, 10]),
      session("2026-08-05", "Squat", [9, 9]),
    ]);
    assert.equal(result.length, 1);
    assert.equal(result[0].type, "grinding");
    assert.equal(result[0].name, "Squat");
    assert.equal(result[0].evidence.length, 3);
  });

  test("does not flag when only 2 of the last 3 sessions qualify", () => {
    const result = grindingInsights([
      session("2026-08-01", "Squat", [9, 9]),
      session("2026-08-03", "Squat", [7, 8]),
      session("2026-08-05", "Squat", [9, 9]),
    ]);
    assert.deepEqual(result, []);
  });

  test("returns no insights when no sets carry an rpe", () => {
    const sessions = [{ date: "2026-08-01", exercises: [{ name: "Squat", sets: [{ weight: "100", reps: "5", unit: "lb" }] }] }];
    assert.deepEqual(grindingInsights(sessions), []);
  });
});
