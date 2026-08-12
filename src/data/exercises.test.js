import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { dayOrder, dayTemplates, variantFor, allVariantNames } from "./exercises.js";
import { formGuide } from "./formGuide.js";

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

describe("machine variants — MON", () => {
  test("every MON exercise has a machine variant", () => {
    for (const ex of dayTemplates.MON.exercises) {
      const machine = ex.variants.find(v => v.equipment === "machine");
      assert.ok(machine, `${ex.variants[0].name} has no machine variant`);
    }
  });

  test("MON machine variants are the expected exercises", () => {
    const actual = dayTemplates.MON.exercises.map(ex => variantFor(ex, "machine").name);
    assert.deepEqual(actual, [
      "Chest Press Machine",
      "Incline Chest Press Machine",
      "Shoulder Press Machine",
      "Lateral Raise Machine",
      "Cable Tricep Pushdown",
    ]);
  });
});

describe("machine variants — TUE", () => {
  test("every TUE exercise has a machine variant", () => {
    for (const ex of dayTemplates.TUE.exercises) {
      assert.ok(ex.variants.find(v => v.equipment === "machine"),
        `${ex.variants[0].name} has no machine variant`);
    }
  });

  test("TUE machine variants are the expected exercises", () => {
    const actual = dayTemplates.TUE.exercises.map(ex => variantFor(ex, "machine").name);
    assert.deepEqual(actual, [
      "Lat Pulldown Machine",
      "Seated Cable Row",
      "Single-Arm Hammer Strength Row",
      "Rear Delt Fly Machine",
      "Preacher Curl Machine",
    ]);
  });
});

describe("machine variants — WED", () => {
  test("every WED exercise has a machine variant", () => {
    for (const ex of dayTemplates.WED.exercises) {
      assert.ok(ex.variants.find(v => v.equipment === "machine"),
        `${ex.variants[0].name} has no machine variant`);
    }
  });

  test("WED machine variants are the expected exercises", () => {
    const actual = dayTemplates.WED.exercises.map(ex => variantFor(ex, "machine").name);
    assert.deepEqual(actual, [
      "Leg Press Machine",
      "Seated Leg Curl Machine",
      "Single-Leg Leg Press",
      "Hip Thrust Machine",
      "Standing Calf Raise Machine",
    ]);
  });
});

describe("machine variants — THU", () => {
  test("every THU exercise has a machine variant", () => {
    for (const ex of dayTemplates.THU.exercises) {
      assert.ok(ex.variants.find(v => v.equipment === "machine"),
        `${ex.variants[0].name} has no machine variant`);
    }
  });

  test("THU machine variants are the expected exercises", () => {
    const actual = dayTemplates.THU.exercises.map(ex => variantFor(ex, "machine").name);
    assert.deepEqual(actual, [
      "Ab Crunch Machine",
      "Captain's Chair Leg Raise",
      "Kneeling Cable Crunch",
      "Torso Rotation Machine",
      "Decline Ab Bench (Weighted)",
    ]);
  });
});

describe("machine variants — FRI", () => {
  test("every FRI exercise has a machine variant", () => {
    for (const ex of dayTemplates.FRI.exercises) {
      assert.ok(ex.variants.find(v => v.equipment === "machine"),
        `${ex.variants[0].name} has no machine variant`);
    }
  });

  test("FRI machine variants are the expected exercises", () => {
    const actual = dayTemplates.FRI.exercises.map(ex => variantFor(ex, "machine").name);
    assert.deepEqual(actual, [
      "Smith Machine Deadlift",
      "Back Extension Machine",
      "Chest-Supported T-Bar Row",
      "Shrug Machine",
      "Seated Calf Raise Machine",
    ]);
  });
});

describe("form guide coverage", () => {
  test("every variant name in the plan has a form guide", () => {
    for (const name of allVariantNames()) {
      assert.ok(formGuide[name], `no form guide for "${name}" — its ⓘ form button would do nothing`);
    }
  });
});

describe("whole-plan invariants", () => {
  const allExercises = () => dayOrder.flatMap(k => dayTemplates[k].exercises);

  test("every exercise has exactly 2 variants — one free, one machine", () => {
    for (const ex of allExercises()) {
      assert.equal(ex.variants.length, 2, `${ex.variants[0].name}`);
      assert.deepEqual(ex.variants.map(v => v.equipment), ["free", "machine"],
        `${ex.variants[0].name}: expected [free, machine]`);
    }
  });

  test("no form guide is orphaned — every guide belongs to a variant", () => {
    const names = new Set(allVariantNames());
    for (const guideName of Object.keys(formGuide)) {
      assert.ok(names.has(guideName), `orphaned guide "${guideName}" — no variant uses it`);
    }
  });

  test("a machine variant never shares its form guide with its free counterpart", () => {
    for (const ex of allExercises()) {
      assert.notEqual(ex.variants[0].name, ex.variants[1].name);
      assert.notDeepEqual(formGuide[ex.variants[0].name], formGuide[ex.variants[1].name],
        `${ex.variants[1].name}: guide is a copy of the free-weight guide`);
    }
  });
});
