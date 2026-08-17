// src/data/muscleMap.test.js
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mapMuscles, viewForMuscles } from "./muscleMap.js";

describe("muscleMap", () => {
  test("maps direct 1:1 muscle names", () => {
    assert.deepEqual(mapMuscles(["chest", "biceps"]), ["chest", "biceps"]);
  });

  test("expands shoulders to all three delt regions", () => {
    assert.deepEqual(mapMuscles(["shoulders"]), ["frontDelts", "sideDelts", "rearDelts"]);
  });

  test("maps multi-word upstream names", () => {
    assert.deepEqual(mapMuscles(["lower back", "middle back"]), ["lowerBack", "midBack"]);
  });

  test("drops unmappable names and dedupes", () => {
    assert.deepEqual(mapMuscles(["neck", "chest", "chest"]), ["chest"]);
  });

  test("returns an empty array for no input", () => {
    assert.deepEqual(mapMuscles([]), []);
    assert.deepEqual(mapMuscles(undefined), []);
  });

  test("picks back view when any muscle is back-only", () => {
    assert.equal(viewForMuscles(["lats"]), "back");
    assert.equal(viewForMuscles(["chest", "lowerBack"]), "back");
  });

  test("defaults to front view", () => {
    assert.equal(viewForMuscles(["chest"]), "front");
    assert.equal(viewForMuscles(["triceps"]), "front");
    assert.equal(viewForMuscles([]), "front");
  });
});
