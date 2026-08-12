import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { EQUIPMENT_PREFIX, loadPrefs, savePrefs, prefFor, setPref } from "./equipmentPrefs.js";

/** Stand-in for the storage wrapper in App.jsx. */
function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    get: k => (k in data ? data[k] : null),
    set: (k, v) => { data[k] = v; return true; },
    remove: k => { delete data[k]; return true; },
  };
}

/** Storage that throws, as it does in Safari private mode or when over quota. */
function brokenStorage() {
  return {
    get() { throw new Error("SecurityError"); },
    set() { throw new Error("QuotaExceededError"); },
    remove() { throw new Error("SecurityError"); },
  };
}

describe("equipmentPrefs", () => {
  test("prefFor defaults to free when the exercise is unknown", () => {
    assert.equal(prefFor({}, "Barbell/DB Bench Press"), "free");
  });

  test("prefFor returns a stored machine preference", () => {
    assert.equal(prefFor({ "Barbell/DB Bench Press": "machine" }, "Barbell/DB Bench Press"), "machine");
  });

  test("prefFor ignores a stored value that is not a known equipment type", () => {
    assert.equal(prefFor({ "Bicep Curls": "hovercraft" }, "Bicep Curls"), "free");
  });

  test("setPref returns a new object and does not mutate the original", () => {
    const before = { "Bicep Curls": "machine" };
    const after = setPref(before, "Overhead Press", "machine");
    assert.equal(after["Overhead Press"], "machine");
    assert.equal(after["Bicep Curls"], "machine");
    assert.equal(before["Overhead Press"], undefined, "original must not be mutated");
  });

  test("preferences round-trip through storage under the profile key", () => {
    const s = fakeStorage();
    savePrefs(s, "priyesh", { "Overhead Press": "machine" });
    assert.ok(EQUIPMENT_PREFIX + "priyesh" in s.data, "must write under the profile-scoped key");
    assert.deepEqual(loadPrefs(s, "priyesh"), { "Overhead Press": "machine" });
  });

  test("profiles do not share preferences", () => {
    const s = fakeStorage();
    savePrefs(s, "a", { "Overhead Press": "machine" });
    savePrefs(s, "b", { "Bicep Curls": "machine" });
    assert.deepEqual(loadPrefs(s, "a"), { "Overhead Press": "machine" });
    assert.deepEqual(loadPrefs(s, "b"), { "Bicep Curls": "machine" });
  });

  test("loadPrefs returns {} when nothing is stored", () => {
    assert.deepEqual(loadPrefs(fakeStorage(), "nobody"), {});
  });

  test("loadPrefs returns {} on corrupt JSON rather than throwing", () => {
    const s = fakeStorage({ [EQUIPMENT_PREFIX + "x"]: "{not json" });
    assert.deepEqual(loadPrefs(s, "x"), {});
  });

  test("loadPrefs returns {} when the stored value is an array or null", () => {
    assert.deepEqual(loadPrefs(fakeStorage({ [EQUIPMENT_PREFIX + "x"]: "[1,2]" }), "x"), {});
    assert.deepEqual(loadPrefs(fakeStorage({ [EQUIPMENT_PREFIX + "x"]: "null" }), "x"), {});
  });

  test("loadPrefs survives storage that throws", () => {
    assert.deepEqual(loadPrefs(brokenStorage(), "x"), {});
  });

  test("savePrefs reports false instead of throwing when storage fails", () => {
    assert.equal(savePrefs(brokenStorage(), "x", { a: "machine" }), false);
  });

  test("loadPrefs returns {} when there is no active profile", () => {
    assert.deepEqual(loadPrefs(fakeStorage(), null), {});
  });

  test("savePrefs is a no-op returning false with no active profile", () => {
    const s = fakeStorage();
    assert.equal(savePrefs(s, null, { a: "machine" }), false);
    assert.deepEqual(s.data, {});
  });
});
