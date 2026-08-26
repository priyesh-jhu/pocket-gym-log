import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { addDaysISO } from "./dateUtils.js";
import { MUSCLES } from "./data/formGuide.js";
import {
  toLb, setVolume, isDumbbellExercise, sessionVolume, weekStartISO, weeklyVolume, monthlyVolume, dayTypeTrend, weekSummary, weekVolumeDelta, currentStreak, estimated1RM, exerciseE1RMSeries, personalRecords, muscleFreshness, pushPullRatio, muscleBalance, muscleBalanceTrend, MUSCLE_GROUP_ORDER, rpeTrend, activityCalendar, recentDaysHeat, consistencySummary, muscleCoverageGaps, muscleHeatmapCoverage, exerciseSuggestionsForMissed, muscleSetVolume, dashboardRangeSummary, musclePriorities, monthSummary, lastSameDaySummary, sameDayTrend, topSetForExercise,
} from "./stats.js";

function mkSet(weight, reps, unit = "lb") { return { weight, reps, unit }; }
function mkSession(date, exercises, day = "MON") { return { id: date, date, day, notes: "", exercises }; }

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

  test("doubles volume for dumbbell exercises, logged as one implement's weight", () => {
    const session = mkSession("2026-08-10", [
      { name: "Dumbbell Bench Press", sets: [mkSet("30", "10", "lb")] },
      { name: "Barbell Bench Press", sets: [mkSet("30", "10", "lb")] },
    ]);
    assert.equal(sessionVolume(session), 30 * 10 * 2 + 30 * 10);
  });
});

describe("isDumbbellExercise", () => {
  test("matches whole-word 'dumbbell' or 'db', case-insensitively", () => {
    assert.equal(isDumbbellExercise("Dumbbell Bench Press"), true);
    assert.equal(isDumbbellExercise("DB Row"), true);
    assert.equal(isDumbbellExercise("dumbbell curl"), true);
  });

  test("does not false-positive on unrelated or embedded-letter names", () => {
    assert.equal(isDumbbellExercise("Deadlift"), false);
    assert.equal(isDumbbellExercise("Adductor Machine"), false);
    assert.equal(isDumbbellExercise(undefined), false);
  });

  test("excludes single-arm/unilateral dumbbell variants, which use only one implement", () => {
    assert.equal(isDumbbellExercise("Single-Arm DB Row"), false);
    assert.equal(isDumbbellExercise("One-Arm Dumbbell Row"), false);
    assert.equal(isDumbbellExercise("Unilateral DB Curl"), false);
  });
});

describe("setVolume", () => {
  test("doubles for a dumbbell exercise name, not for others", () => {
    assert.equal(setVolume(mkSet("30", "10"), "Dumbbell Curl"), 600);
    assert.equal(setVolume(mkSet("30", "10"), "Barbell Curl"), 300);
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

  test("also tallies working sets per week", () => {
    const sessions = [mkSession("2026-08-10", [{ name: "A", sets: [mkSet("50", "5"), mkSet("50", "5")] }])];
    const result = weeklyVolume(sessions, 1, "2026-08-13");
    assert.equal(result[0].sets, 2);
  });

  test("counts a training day once even when saved as several same-date session records", () => {
    const sessions = [
      mkSession("2026-08-10", [{ name: "Bench Press", sets: [mkSet("100", "10")] }]),
      mkSession("2026-08-10", [{ name: "Row", sets: [mkSet("100", "10")] }]),
      mkSession("2026-08-11", [{ name: "Squat", sets: [mkSet("100", "10")] }]),
    ];
    const result = weeklyVolume(sessions, 1, "2026-08-13");
    assert.equal(result[0].sessions, 2);
    assert.equal(result[0].volume, 3000);
  });
});

describe("monthlyVolume", () => {
  test("returns exactly `months` entries including zero-activity gaps, and tallies sets", () => {
    const sessions = [mkSession("2026-06-15", [{ name: "A", sets: [mkSet("100", "10")] }])];
    const result = monthlyVolume(sessions, 6, "2026-08-13");
    assert.equal(result.length, 6);
    const nonZero = result.filter(m => m.volume > 0);
    assert.equal(nonZero.length, 1);
    assert.equal(nonZero[0].monthStart, "2026-06");
    assert.equal(nonZero[0].sets, 1);
  });

  test("buckets correctly across a year boundary", () => {
    const sessions = [mkSession("2025-12-05", [{ name: "A", sets: [mkSet("100", "10")] }])];
    const result = monthlyVolume(sessions, 3, "2026-01-15");
    assert.equal(result[0].monthStart, "2025-11");
    assert.equal(result[1].monthStart, "2025-12");
    assert.equal(result[2].monthStart, "2026-01");
    assert.equal(result[1].volume, 1000);
  });

  test("counts a training day once even when saved as several same-date session records", () => {
    const sessions = [
      mkSession("2026-08-10", [{ name: "Bench Press", sets: [mkSet("100", "10")] }]),
      mkSession("2026-08-10", [{ name: "Row", sets: [mkSet("100", "10")] }]),
      mkSession("2026-08-11", [{ name: "Squat", sets: [mkSet("100", "10")] }]),
    ];
    const result = monthlyVolume(sessions, 1, "2026-08-13");
    assert.equal(result[0].sessions, 2);
    assert.equal(result[0].volume, 3000);
  });
});

describe("dayTypeTrend", () => {
  test("classifies training days by dominant exercise type, ignoring the session's own day label", () => {
    const sessions = [
      // 2026-08-03: shoulder work -> Push, despite being labeled "LEG DAY".
      mkSession("2026-08-03", [{ name: "Overhead Press", sets: [mkSet("100", "10")] }], "LEG DAY"),
      // 2026-08-04: back work -> Pull.
      mkSession("2026-08-04", [{ name: "Bent-Over Barbell Row", sets: [mkSet("100", "10")] }], "PULL"),
      // 2026-08-10: saved as two separate records sharing one date -> one Push occurrence.
      mkSession("2026-08-10", [{ name: "Overhead Press", sets: [mkSet("110", "10")] }]),
      mkSession("2026-08-10", [{ name: "Overhead Press", sets: [mkSet("50", "10")] }]),
    ];
    const { dayTypes, data } = dayTypeTrend(sessions);
    assert.deepEqual(dayTypes, ["Push", "Pull"]);
    assert.equal(data.length, 2);
    assert.equal(data[0].Push, 1000);
    assert.equal(data[0].Pull, 1000);
    assert.equal(data[1].Push, 1600);
    assert.equal(data[1].Pull, undefined);
  });

  test("classifies an exercise by majority primary muscle when it spans two types", () => {
    // Conventional Deadlift: lowerBack (Pull) vs glutes+hamstrings (Legs) -> Legs wins.
    const sessions = [mkSession("2026-08-01", [{ name: "Conventional Deadlift", sets: [mkSet("200", "5")] }])];
    const { dayTypes } = dayTypeTrend(sessions);
    assert.deepEqual(dayTypes, ["Legs"]);
  });

  test("excludes a training day with no classifiable exercises", () => {
    const sessions = [mkSession("2026-08-01", [{ name: "Totally Made Up Exercise", sets: [mkSet("50", "5")] }])];
    const { dayTypes, data } = dayTypeTrend(sessions);
    assert.deepEqual(dayTypes, []);
    assert.deepEqual(data, []);
  });

  test("supports the sets param, counting all of that day's sets even outside the dominant type", () => {
    const sessions = [mkSession("2026-08-01", [
      { name: "Incline DB Press", sets: [mkSet("100", "1"), mkSet("100", "1")] },
      { name: "Weighted Sit-ups/Bicycle Crunches", sets: [mkSet("0", "10")] },
    ])];
    const { dayTypes, data } = dayTypeTrend(sessions, { param: "sets" });
    assert.deepEqual(dayTypes, ["Push"]);
    assert.equal(data[0].Push, 3);
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

describe("home dashboard analytics", () => {
  test("reports weekly direction and consecutive-day streaks", () => {
    const sessions = ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13"].map(date =>
      mkSession(date, [{ name: "Incline DB Press", sets: [mkSet(50, 10)] }])
    );
    assert.equal(weekVolumeDelta(sessions, "2026-08-13").direction, "flat");
    assert.deepEqual(currentStreak(sessions, "2026-08-13"), { current: 4, longest: 4 });
  });

  test("calculates e1RM series and returns recent load records", () => {
    const sessions = [
      mkSession("2026-08-10", [{ name: "Incline DB Press", sets: [mkSet(50, 10)] }]),
      mkSession("2026-08-12", [{ name: "Incline DB Press", sets: [mkSet(60, 5)] }]),
    ];
    assert.equal(Math.round(estimated1RM(50, 10)), 67);
    assert.deepEqual(exerciseE1RMSeries(sessions, "Incline DB Press").map(item => item.date), ["2026-08-10", "2026-08-12"]);
    assert.equal(personalRecords(sessions, 1)[0].weight, 60);
  });

  test("scores freshness and push/pull balance without UTC date drift", () => {
    const sessions = [mkSession("2026-08-12", [
      { name: "Incline DB Press", sets: [mkSet(50, 10)] },
      { name: "Bent-Over Barbell Row", sets: [mkSet(50, 10)] },
    ])];
    const freshness = muscleFreshness(sessions, "2026-08-13");
    assert.equal(freshness.chest, 30);
    assert.equal(freshness.calves, 100);
    assert.deepEqual(pushPullRatio(sessions, 7, "2026-08-13"), { push: 1, pull: 1, pushPct: 50, pullPct: 50 });
  });
});

describe("monthSummary", () => {
  test("computes current-month sessions/volume and delta vs previous month", () => {
    const sessions = [
      mkSession("2026-07-15", [{ name: "A", sets: [mkSet("100", "10")] }]), // prev month: 1000 lb
      mkSession("2026-08-05", [{ name: "A", sets: [mkSet("110", "10")] }]), // current month
      mkSession("2026-08-20", [{ name: "A", sets: [mkSet("110", "10")] }]), // current month
    ];
    const result = monthSummary(sessions, "2026-08-24");
    assert.equal(result.sessions, 2);
    assert.equal(result.volume, 2200);
    assert.equal(result.prevVolume, 1000);
    assert.equal(result.deltaPct, 120);
  });

  test("deltaPct is null with no prior-month baseline", () => {
    const sessions = [mkSession("2026-08-05", [{ name: "A", sets: [mkSet("100", "10")] }])];
    const result = monthSummary(sessions, "2026-08-24");
    assert.equal(result.prevVolume, 0);
    assert.equal(result.deltaPct, null);
  });
});

describe("lastSameDaySummary", () => {
  test("finds the most recent prior session with a matching day and reports top sets", () => {
    const sessions = [
      mkSession("2026-08-01", [{ name: "Bench Press", sets: [mkSet("135", "8"), mkSet("155", "5")] }], "PUSH"),
      mkSession("2026-08-03", [{ name: "Squat", sets: [mkSet("200", "5")] }], "LEGS"),
      mkSession("2026-08-08", [{ name: "Bench Press", sets: [mkSet("145", "6")] }], "PUSH"),
    ];
    const result = lastSameDaySummary(sessions, "PUSH", "2026-08-15");
    assert.equal(result.date, "2026-08-08");
    assert.equal(result.exercises.length, 1);
    assert.deepEqual(result.exercises[0], { name: "Bench Press", weight: 145, unit: "lb", reps: 6, weightLb: 145 });
  });

  test("returns null when no prior session matches the day", () => {
    const sessions = [mkSession("2026-08-01", [{ name: "Squat", sets: [mkSet("200", "5")] }], "LEGS")];
    assert.equal(lastSameDaySummary(sessions, "PUSH", "2026-08-15"), null);
  });

  test("sums volume and merges exercises across multiple session records sharing the same date and day", () => {
    // Reproduces a real user's data shape: each exercise saved as its own
    // session record, all sharing one date/day (e.g. saving one exercise at
    // a time instead of building a full multi-exercise session before saving).
    const sessions = [
      mkSession("2026-08-18", [{ name: "Bent-Over Barbell Row", sets: [mkSet("40", "12"), mkSet("40", "12"), mkSet("40", "11")] }], "TUE"),
      mkSession("2026-08-18", [{ name: "Single-Arm DB Row", sets: [mkSet("40", "12"), mkSet("40", "12"), mkSet("40", "12")] }], "TUE"),
      mkSession("2026-08-18", [{ name: "Bicep Curls", sets: [mkSet("25", "12"), mkSet("25", "11"), mkSet("25", "11")] }], "TUE"),
    ];
    const result = lastSameDaySummary(sessions, "TUE", "2026-08-25");
    assert.equal(result.date, "2026-08-18");
    assert.equal(result.volume, 1400 + 1440 + 850);
    assert.equal(result.exercises.length, 3);
  });
});

describe("sameDayTrend", () => {
  test("returns the last N occurrences of a day, oldest first", () => {
    const sessions = [
      mkSession("2026-08-01", [{ name: "A", sets: [mkSet("100", "10")] }], "LEGS"),
      mkSession("2026-08-08", [{ name: "A", sets: [mkSet("110", "10")] }], "LEGS"),
      mkSession("2026-08-15", [{ name: "A", sets: [mkSet("120", "10")] }], "LEGS"),
      mkSession("2026-08-05", [{ name: "A", sets: [mkSet("999", "10")] }], "PULL"),
    ];
    const result = sameDayTrend(sessions, "LEGS", 2, "2026-08-20");
    assert.equal(result.length, 2);
    assert.deepEqual(result.map(r => r.date), ["2026-08-08", "2026-08-15"]);
    assert.equal(result[1].volume, 1200);
  });

  test("aggregates same-date records sharing the day into one occurrence", () => {
    const sessions = [
      mkSession("2026-08-18", [{ name: "A", sets: [mkSet("40", "12")] }], "TUE"),
      mkSession("2026-08-18", [{ name: "B", sets: [mkSet("40", "12")] }], "TUE"),
    ];
    const result = sameDayTrend(sessions, "TUE", 8, "2026-08-25");
    assert.equal(result.length, 1);
    assert.equal(result[0].volume, 960);
  });

  test("returns fewer than `occurrences` when there isn't enough history", () => {
    const sessions = [mkSession("2026-08-01", [{ name: "A", sets: [mkSet("100", "10")] }], "LEGS")];
    assert.equal(sameDayTrend(sessions, "LEGS", 8, "2026-08-20").length, 1);
  });
});

describe("topSetForExercise", () => {
  test("returns the heaviest set converted to lb", () => {
    const exercise = { name: "Bench Press", sets: [mkSet("135", "8"), mkSet("155", "5"), mkSet("0", "10")] };
    assert.deepEqual(topSetForExercise(exercise), { weightLb: 155, weight: 155, unit: "lb", reps: 5 });
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

  test("splits volume evenly across two different muscle groups", () => {
    const sessions = [mkSession("2026-08-10", [
      { name: "Incline DB Press", sets: [mkSet("100", "10")] },
    ])];
    const result = muscleBalance(sessions, 4, "2026-08-13");
    assert.equal(result.length, 2);
    const byGroup = new Map(result.map(r => [r.group, r]));
    // "DB" doubles volume (1000*2=2000 total), split evenly across the two groups.
    assert.equal(byGroup.get("Chest").pct, 50);
    assert.equal(byGroup.get("Chest").volume, 1000);
    assert.equal(byGroup.get("Shoulders").pct, 50);
    assert.equal(byGroup.get("Shoulders").volume, 1000);
  });

  test("collapses three primary muscles spanning two groups into 50/50, not thirds", () => {
    const sessions = [mkSession("2026-08-10", [
      { name: "Conventional Deadlift", sets: [mkSet("100", "10")] },
    ])];
    const result = muscleBalance(sessions, 4, "2026-08-13");
    assert.equal(result.length, 2);
    const byGroup = new Map(result.map(r => [r.group, r]));
    assert.equal(byGroup.get("Back").pct, 50);
    assert.equal(byGroup.get("Back").volume, 500);
    assert.equal(byGroup.get("Legs").pct, 50);
    assert.equal(byGroup.get("Legs").volume, 500);
  });
});

describe("muscleBalanceTrend", () => {
  test("returns exactly `weeks` rows, each with every group present", () => {
    const sessions = [mkSession("2026-08-10", [{ name: "Back Squat/Goblet Squat", sets: [mkSet("100", "10")] }])];
    const result = muscleBalanceTrend(sessions, 3, "2026-08-13");
    assert.equal(result.length, 3);
    for (const week of result) for (const group of MUSCLE_GROUP_ORDER) assert.equal(typeof week[group], "number");
  });

  test("computes each week's own composition independently, not a rolling window", () => {
    const sessions = [
      mkSession("2026-08-03", [{ name: "Back Squat/Goblet Squat", sets: [mkSet("100", "10")] }]), // Legs-only week
      mkSession("2026-08-10", [{ name: "Bent-Over Barbell Row", sets: [mkSet("100", "10")] }]),   // Back-only week
    ];
    const result = muscleBalanceTrend(sessions, 2, "2026-08-13");
    assert.equal(result[0].Legs, 100);
    assert.equal(result[0].Back, 0);
    assert.equal(result[1].Back, 100);
    assert.equal(result[1].Legs, 0);
  });

  test("a week with no mapped volume has every group at 0", () => {
    const result = muscleBalanceTrend([], 1, "2026-08-13");
    for (const group of MUSCLE_GROUP_ORDER) assert.equal(result[0][group], 0);
  });
});

describe("rpeTrend", () => {
  test("averages rated sets per week and returns exactly `weeks` entries", () => {
    const sessions = [mkSession("2026-08-10", [{ name: "A", sets: [{ weight: 100, reps: 10, rpe: 8 }, { weight: 100, reps: 10, rpe: 6 }] }])];
    const result = rpeTrend(sessions, 2, "2026-08-13");
    assert.equal(result.length, 2);
    assert.equal(result[1].avgRpe, 7);
    assert.equal(result[1].ratedSets, 2);
  });

  test("a week with no rated sets is null, not 0", () => {
    const sessions = [mkSession("2026-08-10", [{ name: "A", sets: [{ weight: 100, reps: 10, rpe: null }] }])];
    const result = rpeTrend(sessions, 1, "2026-08-13");
    assert.equal(result[0].avgRpe, null);
    assert.equal(result[0].ratedSets, 0);
  });

  test("ignores non-positive or non-finite rpe values", () => {
    const sessions = [mkSession("2026-08-10", [{ name: "A", sets: [{ weight: 100, reps: 10, rpe: 0 }, { weight: 100, reps: 10, rpe: "abc" }, { weight: 100, reps: 10, rpe: 9 }] }])];
    const result = rpeTrend(sessions, 1, "2026-08-13");
    assert.equal(result[0].avgRpe, 9);
    assert.equal(result[0].ratedSets, 1);
  });
});

describe("activity calendar and consistency", () => {
  test("builds complete Monday-to-Sunday weeks ending with the current week", () => {
    const sessions = [mkSession("2026-08-10", []), mkSession("2026-08-10", []), mkSession("2026-08-13", [])];
    const calendar = activityCalendar(sessions, 2, "2026-08-13");
    assert.equal(calendar.length, 2);
    assert.equal(calendar[0][0].date, "2026-08-03");
    assert.equal(calendar[1][0].count, 2);
    assert.equal(calendar[1][3].count, 1);
    assert.equal(calendar[1][6].future, true);
  });

  test("levels reflect volume, not just whether a session was logged", () => {
    const heavyDay = mkSession("2026-08-10", [{sets:[mkSet(200,10)]}]);
    const lightDay = mkSession("2026-08-11", [{sets:[mkSet(20,10)]}]);
    const calendar = activityCalendar([heavyDay, lightDay], 2, "2026-08-13");
    const week = calendar[1];
    assert.equal(week[0].count, 1);
    assert.equal(week[1].count, 1);
    assert.ok(week[0].level > week[1].level, "a heavier day should reach a higher level than a lighter day");
    assert.equal(week[2].level, 0, "an untrained day is level 0");
  });

  test("recentDaysHeat returns a trailing window ending today, bucketed by volume", () => {
    const heavyDay = mkSession("2026-08-11", [{ name: "A", sets: [mkSet(200, 10)] }]);
    const lightDay = mkSession("2026-08-12", [{ name: "A", sets: [mkSet(20, 10)] }]);
    const heat = recentDaysHeat([heavyDay, lightDay], 7, "2026-08-13");
    assert.equal(heat.length, 7);
    assert.equal(heat[0].date, "2026-08-07");
    assert.equal(heat.at(-1).date, "2026-08-13");
    const heavy = heat.find(day => day.date === "2026-08-11");
    const light = heat.find(day => day.date === "2026-08-12");
    assert.ok(heavy.level > light.level);
    assert.equal(heat.find(day => day.date === "2026-08-13").level, 0);
  });

  test("summarizes unique workout days over the rolling last 28 days", () => {
    const sessions = [mkSession("2026-08-13", []), mkSession("2026-08-13", []), mkSession("2026-08-10", []), mkSession("2026-07-01", [])];
    assert.deepEqual(consistencySummary(sessions, "2026-08-13"), { workouts:2, activeWeeks:1, goalPct:10 });
  });

  test("consistency cannot exceed 100 percent", () => {
    const sessions = Array.from({length:28}, (_,i) => mkSession(addDaysISO("2026-07-17", i), []));
    assert.equal(consistencySummary(sessions, "2026-08-13").goalPct, 100);
  });
});

describe("muscle coverage gaps",()=>{
  test("flags groups trained in one or fewer of four completed weeks",()=>{
    const sessions=[
      mkSession("2026-08-03",[{name:"Incline DB Press",sets:[mkSet("50","10")]}]),
      mkSession("2026-07-27",[{name:"Incline DB Press",sets:[mkSet("50","10")]}]),
      mkSession("2026-07-20",[{name:"Conventional Deadlift",sets:[mkSet("100","5")]}]),
    ];
    const gaps=muscleCoverageGaps(sessions,4,"2026-08-13");
    assert.equal(gaps.some(item=>item.group==="Chest"),false);
    assert.equal(gaps.find(item=>item.group==="Legs").activeWeeks,1);
    assert.equal(gaps.find(item=>item.group==="Core").missedWeeks,4);
  });

  test("requires three completed weeks and excludes the current incomplete week",()=>{
    assert.deepEqual(muscleCoverageGaps([mkSession("2026-08-10",[{name:"Incline DB Press",sets:[mkSet("50","10")]}])],4,"2026-08-13"),[]);
    const sessions=["2026-08-10","2026-08-03","2026-07-27","2026-07-20"].map(date=>mkSession(date,[{name:"Incline DB Press",sets:[mkSet("50","10")]}]))
    const gaps=muscleCoverageGaps(sessions,4,"2026-08-13");
    assert.equal(gaps.some(item=>item.group==="Chest"),false);
  });
});

describe("muscle heatmap coverage",()=>{
  test("scores primary and secondary muscles inside the selected range",()=>{
    const result=muscleHeatmapCoverage([mkSession("2026-08-10",[{name:"Incline DB Press",sets:[mkSet("50","10")]}])],7,"2026-08-13");
    assert.equal(result.scores.chest,1);
    assert.equal(result.scores.frontDelts,1);
    assert.equal(result.scores.triceps,0.5);
    assert.equal(result.missed.includes("lats"),true);
  });
  test("excludes sessions before the rolling range",()=>{
    const result=muscleHeatmapCoverage([mkSession("2026-08-01",[{name:"Incline DB Press",sets:[mkSet("50","10")]}])],7,"2026-08-13");
    assert.equal(result.scores.chest,0);
  });
  test("does not count an exercise without a logged set",()=>{
    const result=muscleHeatmapCoverage([mkSession("2026-08-10",[{name:"Incline DB Press",sets:[]}])],7,"2026-08-13");
    assert.equal(result.scores.chest,0);
  });
});

describe("exercise suggestions for missed muscles",()=>{
  test("prefers one direct compound exercise that covers multiple gaps",()=>{
    const result=exerciseSuggestionsForMissed(["quads","glutes"]);
    assert.deepEqual(result.suggestions.map(item=>item.name),["Back Squat/Goblet Squat"]);
    assert.deepEqual(result.suggestions[0].direct,["quads","glutes"]);
    assert.deepEqual(result.uncovered,[]);
  });

  test("uses an explicitly labeled supporting match where no primary exercise exists",()=>{
    const result=exerciseSuggestionsForMissed(["adductors"]);
    assert.equal(result.suggestions[0].name,"Back Squat/Goblet Squat");
    assert.deepEqual(result.suggestions[0].direct,[]);
    assert.deepEqual(result.suggestions[0].supporting,["adductors"]);
  });

  test("ignores unknown muscle identifiers",()=>{
    assert.deepEqual(exerciseSuggestionsForMissed(["notReal"]),{suggestions:[],uncovered:[]});
  });
  test("avoids repeating a recent equivalent when another direct option exists",()=>{
    const result=exerciseSuggestionsForMissed(["sideDelts"],{recentExercises:["Lateral Raises"],preferredEquipment:"machine"});
    assert.equal(result.suggestions[0].name,"Shoulder Press Machine");
    assert.deepEqual(result.suggestions[0].direct,["sideDelts"]);
  });
});

describe("dashboard muscle targets",()=>{
  test("credits full primary sets and half secondary sets",()=>{
    const sessions=[mkSession("2026-08-13",[{name:"Incline DB Press",sets:[mkSet(50,10),mkSet(50,10)]}])];
    const result=muscleSetVolume(sessions,7,"2026-08-13");
    assert.equal(result.sets.chest,2);
    assert.equal(result.sets.triceps,1);
    assert.equal(result.lastTrained.chest,"2026-08-13");
  });
  test("summarizes a shared rolling range",()=>{
    const result=dashboardRangeSummary([mkSession("2026-08-13",[{name:"A",sets:[mkSet(10,10)]}]),mkSession("2026-08-01",[])],7,"2026-08-13");
    assert.equal(result.sessions,1); assert.equal(result.sets,1); assert.equal(result.volume,100);
  });
  test("calculates target progress and prioritizes the largest deficit",()=>{
    const baseline=Object.fromEntries(Object.keys(MUSCLES).map(muscle=>[muscle,10]));
    const volume={sets:{...baseline,chest:8,lats:2},lastTrained:{chest:"2026-08-12",lats:"2026-08-01"}};
    const priorities=musclePriorities(volume,{...baseline,chest:10,lats:12},5,"2026-08-13");
    assert.equal(priorities[0].muscle,"lats"); assert.equal(priorities.find(item=>item.muscle==="chest").pct,80);
  });
});
