import { describe, test } from "node:test";
import assert from "node:assert/strict";
import exerciseLibrary from "./exerciseLibrary.json" with { type: "json" };
import { MUSCLES } from "./formGuide.js";

describe("exerciseLibrary.json", () => {
  test("is a non-empty array", () => {
    assert.ok(Array.isArray(exerciseLibrary));
    assert.ok(exerciseLibrary.length > 0);
  });

  test("every entry has at least one valid primary muscle, and all muscles are valid MUSCLES keys", () => {
    const validKeys = new Set(Object.keys(MUSCLES));
    for (const entry of exerciseLibrary) {
      assert.ok(entry.primaryMuscles.length > 0, `${entry.id} has no primary muscles`);
      for (const key of [...entry.primaryMuscles, ...entry.secondaryMuscles]) {
        assert.ok(validKeys.has(key), `${entry.id} has invalid muscle key "${key}"`);
      }
    }
  });

  test("every entry has a unique id and non-empty name", () => {
    const ids = new Set();
    for (const entry of exerciseLibrary) {
      assert.ok(entry.id && !ids.has(entry.id), `duplicate or missing id: ${entry.id}`);
      ids.add(entry.id);
      assert.ok(entry.name && entry.name.trim().length > 0);
    }
  });
});
