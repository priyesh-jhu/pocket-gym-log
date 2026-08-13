import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getProgressionRecommendation, parseRepTarget } from "./progression.js";

describe("progressive-overload recommendations", () => {
  test("parses rep ranges and each-side targets", () => {
    assert.deepEqual(parseRepTarget("3 x 8-10 each"), { sets:3, minReps:8, maxReps:10 });
    assert.deepEqual(parseRepTarget("3 x 12 each side"), { sets:3, minReps:12, maxReps:12 });
  });

  test("does not treat time or distance as reps", () => {
    assert.equal(parseRepTarget("3 x 30-45 sec"), null);
    assert.equal(parseRepTarget("3 x 25-30 meters"), null);
  });

  test("recommends the default unit increment after completing the top of the range", () => {
    const sets = [10, 10, 11].map(reps => ({ weight:"135", reps:String(reps), unit:"lb" }));
    assert.deepEqual(getProgressionRecommendation(sets, "3 x 6-10"), {
      action:"increase", label:"Increase next time",
      message:"Try 140 lb; you reached 10+ reps across all 3 working sets.",
    });
  });

  test("uses a 2.5 kg increment", () => {
    const sets = [12, 12, 12].map(reps => ({ weight:"40", reps, unit:"kg" }));
    assert.equal(getProgressionRecommendation(sets, "3 x 10-12").message.startsWith("Try 42.5 kg"), true);
  });

  test("holds when performance is mixed or fewer prescribed working sets were logged", () => {
    const mixed = [12, 11, 9].map(reps => ({ weight:100, reps, unit:"lb" }));
    const short = [12, 12].map(reps => ({ weight:100, reps, unit:"lb" }));
    assert.equal(getProgressionRecommendation(mixed, "3 x 10-12").action, "hold");
    assert.equal(getProgressionRecommendation(short, "3 x 10-12").action, "hold");
  });

  test("reduces only when every prescribed working set misses the minimum", () => {
    const sets = [7, 6, 7].map(reps => ({ weight:100, reps, unit:"lb" }));
    assert.equal(getProgressionRecommendation(sets, "3 x 8-10").action, "reduce");
    assert.match(getProgressionRecommendation(sets, "3 x 8-10").message, /95 lb/);
  });

  test("uses the most common weight so warm-up sets do not drive the advice", () => {
    const sets = [
      { weight:45, reps:10, unit:"lb" },
      ...[10, 10, 10].map(reps => ({ weight:100, reps, unit:"lb" })),
    ];
    assert.match(getProgressionRecommendation(sets, "3 x 8-10").message, /105 lb/);
  });

  test("returns no advice without usable weighted sets", () => {
    assert.equal(getProgressionRecommendation([{ weight:"", reps:12, unit:"lb" }], "3 x 10-12"), null);
  });
});
