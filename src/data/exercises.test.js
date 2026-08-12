import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { dayOrder, dayTemplates, variantFor, allVariantNames } from "./exercises.js";

describe("exercise plan structure", () => {
  test("dayOrder is the five training days", () => {
    assert.deepEqual(dayOrder, ["MON", "TUE", "WED", "THU", "FRI"]);
  });

  test("every day in dayOrder has a template", () => {
    for (const key of dayOrder) {
      assert.ok(dayTemplates[key], `missing template for ${key}`);
    }
  });

  test("dayTemplates has no days outside dayOrder", () => {
    assert.deepEqual(Object.keys(dayTemplates).sort(), [...dayOrder].sort());
  });

  test("every day has the display fields the UI reads", () => {
    for (const key of dayOrder) {
      const t = dayTemplates[key];
      for (const field of ["label", "color", "emoji", "focus", "coachNote", "cardio"]) {
        assert.ok(typeof t[field] === "string" && t[field].length > 0, `${key}: ${field}`);
      }
      assert.match(t.color, /^#[0-9A-Fa-f]{6}$/, `${key}: color must be a 6-digit hex`);
    }
  });

  test("every day has a warmup with at least one drill", () => {
    for (const key of dayOrder) {
      const w = dayTemplates[key].warmup;
      assert.ok(w && typeof w.general === "string" && w.general.length > 0, `${key}: warmup.general`);
      assert.ok(Array.isArray(w.drills) && w.drills.length > 0, `${key}: warmup.drills`);
      for (const d of w.drills) {
        assert.ok(d.name && d.detail, `${key}: drill missing name or detail`);
      }
    }
  });

  test("every day has exactly 5 exercises", () => {
    for (const key of dayOrder) {
      assert.equal(dayTemplates[key].exercises.length, 5, `${key}`);
    }
  });

  test("the plan has 25 exercises in total", () => {
    const total = dayOrder.reduce((n, k) => n + dayTemplates[k].exercises.length, 0);
    assert.equal(total, 25);
  });
});

// The 25 free-weight names as they exist in users' localStorage. Every logged
// session, PR and progress chart is keyed by these strings. Changing one orphans
// that exercise's history, so this list is frozen.
const FROZEN_FREE_NAMES = [
  "Barbell/DB Bench Press", "Incline DB Press", "Overhead Press", "Lateral Raises",
  "Tricep Dips/Skull Crushers",
  "Pull-ups/Lat Pulldown", "Bent-Over Barbell Row", "Single-Arm DB Row",
  "Face Pulls/Band Pull-Aparts", "Bicep Curls",
  "Back Squat/Goblet Squat", "Romanian Deadlift", "Bulgarian Split Squat",
  "Glute Bridge/Hip Thrust", "Standing Calf Raises",
  "Plank w/ Shoulder Taps", "Hanging Leg Raises", "Ab Wheel/Dead Bug",
  "Cable/DB Woodchop", "Weighted Sit-ups/Bicycle Crunches",
  "Conventional Deadlift", "Back Extensions/Good Mornings", "Chest-Supported DB Row",
  "Farmer's Carries", "Seated Calf Raises",
];

describe("exercise variants", () => {
  const allExercises = () => dayOrder.flatMap(k => dayTemplates[k].exercises);

  test("every exercise has a variants array with a free variant first", () => {
    for (const ex of allExercises()) {
      assert.ok(Array.isArray(ex.variants), "variants must be an array");
      assert.ok(ex.variants.length >= 1, "at least one variant");
      assert.equal(ex.variants[0].equipment, "free", "index 0 must be the free variant");
    }
  });

  test("every variant has all display fields the card reads", () => {
    for (const ex of allExercises()) {
      for (const v of ex.variants) {
        for (const field of ["name", "target", "muscles", "tip", "alt"]) {
          assert.ok(typeof v[field] === "string" && v[field].length > 0,
            `${v.name || "(unnamed)"}: ${field}`);
        }
        assert.ok(v.equipment === "free" || v.equipment === "machine",
          `${v.name}: bad equipment "${v.equipment}"`);
      }
    }
  });

  test("free-weight names exactly match the frozen list — renaming orphans history", () => {
    const actual = allExercises().map(ex => ex.variants[0].name);
    assert.deepEqual(actual, FROZEN_FREE_NAMES);
  });

  test("no exercise has a flat legacy name field left behind", () => {
    for (const ex of allExercises()) {
      assert.equal(ex.name, undefined, "exercise.name should have moved onto the variant");
    }
  });

  test("all variant names across the plan are unique", () => {
    const names = allVariantNames();
    assert.equal(new Set(names).size, names.length,
      "duplicate name: " + names.filter((n, i) => names.indexOf(n) !== i).join(", "));
  });

  test("variantFor returns the requested equipment", () => {
    const ex = dayTemplates.MON.exercises[0];
    assert.equal(variantFor(ex, "free").equipment, "free");
  });

  test("variantFor falls back to free when the equipment is missing or unknown", () => {
    const ex = dayTemplates.MON.exercises[0];
    assert.equal(variantFor(ex, "machine").equipment, ex.variants.length > 1 ? "machine" : "free");
    assert.equal(variantFor(ex, "nonsense").equipment, "free");
    assert.equal(variantFor(ex, undefined).equipment, "free");
  });
});
