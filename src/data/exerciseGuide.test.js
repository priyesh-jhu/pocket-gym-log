import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { guideFor } from "./exerciseGuide.js";
import { primeExerciseLibraryCacheForTests } from "./exerciseLibraryLoader.js";
import exerciseLibrary from "./exerciseLibrary.json" with { type: "json" };

describe("guideFor", () => {
  test("preloads the library cache", () => {
    primeExerciseLibraryCacheForTests(exerciseLibrary);
  });

  test("returns the hand-authored guide when one exists, ignoring any draft libraryId", () => {
    const guide = guideFor("Barbell/DB Bench Press", { libraryId: "irrelevant" });
    assert.equal(guide.kind, "authored");
    assert.ok(Array.isArray(guide.setup));
  });

  test("returns a library guide for a library-sourced draft exercise with no hand-authored entry", () => {
    const entry = exerciseLibrary[0];
    const draftExercise = { libraryId: entry.id, primaryMuscles: entry.primaryMuscles, secondaryMuscles: entry.secondaryMuscles };
    const guide = guideFor(entry.name, draftExercise);
    assert.equal(guide.kind, "library");
    assert.deepEqual(guide.primary, entry.primaryMuscles);
    assert.deepEqual(guide.instructions, entry.instructions);
    assert.deepEqual(guide.images, [`/exercise-images/${entry.id}/0.jpg`, `/exercise-images/${entry.id}/1.jpg`]);
  });

  test("returns null for a plain custom exercise with no library link", () => {
    assert.equal(guideFor("Some Typed Exercise", { name: "Some Typed Exercise" }), null);
  });

  test("returns null when no draft exercise is provided and there is no hand-authored entry", () => {
    assert.equal(guideFor("Some Typed Exercise", undefined), null);
  });
});
