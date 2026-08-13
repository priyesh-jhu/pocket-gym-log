import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createWorkoutSummary } from "./workoutSummary.js";

const exercise = (name, weight, reps=10, unit="lb") => ({ name, sets:[{weight,reps,unit}] });

describe("post-workout summary", () => {
  test("counts exercises, sets, volume, duration, and notes", () => {
    const session = { date:"2026-08-13", day:"MON", startedAt:"2026-08-13T12:00:00Z", notes:"Strong day", exercises:[exercise("Press",100), {name:"Raise",sets:[{weight:10,reps:12,unit:"lb"},{weight:10,reps:12,unit:"lb"}]}] };
    const result = createWorkoutSummary(session, [], "2026-08-13T12:45:00Z");
    assert.equal(result.durationMinutes, 45);
    assert.equal(result.exercises, 2);
    assert.equal(result.sets, 3);
    assert.equal(result.volumeLb, 1240);
    assert.equal(result.notes, "Strong day");
  });

  test("detects new PRs and improvements over the previous matching exercise", () => {
    const prior = [{date:"2026-08-01",exercises:[exercise("Press",95)]}];
    const result = createWorkoutSummary({exercises:[exercise("Press",100)]}, prior);
    assert.deepEqual(result.prs.map(item=>item.name), ["Press"]);
    assert.deepEqual(result.improvements, [{name:"Press",increaseLb:5}]);
  });

  test("does not call a repeated best a PR or improvement", () => {
    const prior = [{date:"2026-08-01",exercises:[exercise("Press",100,10)]}];
    const result = createWorkoutSummary({exercises:[exercise("Press",100,9)]}, prior);
    assert.deepEqual(result.prs, []);
    assert.deepEqual(result.improvements, []);
  });

  test("omits implausible or missing duration", () => {
    assert.equal(createWorkoutSummary({exercises:[]}, []).durationMinutes, null);
    assert.equal(createWorkoutSummary({startedAt:"2026-08-01T00:00:00Z",exercises:[]}, [], "2026-08-02T00:00:00Z").durationMinutes, null);
  });
});
