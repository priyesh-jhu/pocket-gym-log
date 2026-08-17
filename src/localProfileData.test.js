import test from "node:test";
import assert from "node:assert/strict";
import { readLocalProfileResult, runLocalProfileLoad, sessionKey, weightKey } from "./localProfileData.js";

const PROFILE = "guest";

function fakeStorage(entries = {}, throwOnKey = null) {
  return {
    get(key) {
      if (throwOnKey && key === throwOnKey) throw new Error("device storage refused the read");
      return Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : null;
    },
    set() { return true; },
    remove() { return true; },
  };
}

const loadPrefs = () => ({ "Barbell Bench Press": "machine" });

test("absent keys read as genuinely empty data, not as an error", () => {
  const result = readLocalProfileResult({ storage: fakeStorage(), profile: PROFILE, loadPrefs });
  assert.equal(result.ok, true);
  assert.equal(result.error, null);
  assert.deepEqual(result.data.sessions, []);
  assert.deepEqual(result.data.bodyweights, []);
  assert.deepEqual(result.data.equipmentPrefs, { "Barbell Bench Press": "machine" });
});

test("valid stored arrays pass through unchanged", () => {
  const sessions = [{ id: "s1", date: "2026-08-14", exercises: [] }];
  const bodyweights = [{ id: "w1", date: "2026-08-14", weight: 180, unit: "lb" }];
  const storage = fakeStorage({
    [sessionKey(PROFILE)]: JSON.stringify(sessions),
    [weightKey(PROFILE)]: JSON.stringify(bodyweights),
  });
  const result = readLocalProfileResult({ storage, profile: PROFILE, loadPrefs });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.sessions, sessions);
  assert.deepEqual(result.data.bodyweights, bodyweights);
});

test("thrown storage access reports an error and applies no data", () => {
  const result = readLocalProfileResult({ storage: fakeStorage({}, sessionKey(PROFILE)), profile: PROFILE, loadPrefs });
  assert.equal(result.ok, false);
  assert.equal(result.data, null);
  assert.ok(result.error instanceof Error);
});

test("malformed session JSON is an error rather than an empty history", () => {
  const storage = fakeStorage({ [sessionKey(PROFILE)]: "{not json" });
  const result = readLocalProfileResult({ storage, profile: PROFILE, loadPrefs });
  assert.equal(result.ok, false);
  assert.equal(result.data, null);
  assert.ok(result.error instanceof Error);
});

test("malformed weigh-in JSON is an error rather than an empty list", () => {
  const storage = fakeStorage({
    [sessionKey(PROFILE)]: "[]",
    [weightKey(PROFILE)]: "[1,",
  });
  const result = readLocalProfileResult({ storage, profile: PROFILE, loadPrefs });
  assert.equal(result.ok, false);
  assert.equal(result.data, null);
});

test("a persisted non-array collection is an error for either key", () => {
  const badSessions = readLocalProfileResult({
    storage: fakeStorage({ [sessionKey(PROFILE)]: JSON.stringify({ id: "s1" }) }),
    profile: PROFILE,
    loadPrefs,
  });
  const badWeights = readLocalProfileResult({
    storage: fakeStorage({ [sessionKey(PROFILE)]: "[]", [weightKey(PROFILE)]: JSON.stringify("180") }),
    profile: PROFILE,
    loadPrefs,
  });
  assert.equal(badSessions.ok, false);
  assert.equal(badSessions.data, null);
  assert.equal(badWeights.ok, false);
  assert.equal(badWeights.data, null);
});

test("an unusable storage object is reported instead of throwing", () => {
  const result = readLocalProfileResult({ storage: null, profile: PROFILE, loadPrefs });
  assert.equal(result.ok, false);
  assert.ok(result.error instanceof Error);
});

test("a failed load enters loading, clears then reports the error, and applies no data", () => {
  const calls = [];
  const result = runLocalProfileLoad({
    readResult: () => ({ ok: false, data: null, error: new Error("unreadable") }),
    setLoading: value => calls.push(`loading:${value}`),
    setError: value => calls.push(value === null ? "error:cleared" : "error:set"),
    applyData: () => calls.push("apply"),
  });
  assert.equal(result.ok, false);
  assert.deepEqual(calls, ["loading:true", "error:cleared", "error:set", "loading:false"]);
});

test("a retry after failure re-enters loading and applies data before loading ends", () => {
  const calls = [];
  let attempt = 0;
  const readResult = () => {
    attempt += 1;
    return attempt === 1
      ? { ok: false, data: null, error: new Error("unreadable") }
      : { ok: true, data: { sessions: [{ id: "s1" }], bodyweights: [], equipmentPrefs: {} }, error: null };
  };
  const options = {
    readResult,
    setLoading: value => calls.push(`loading:${value}`),
    setError: value => calls.push(value === null ? "error:cleared" : "error:set"),
    applyData: data => calls.push(`apply:${data.sessions.length}`),
  };

  runLocalProfileLoad(options);
  calls.length = 0;
  const retry = runLocalProfileLoad(options);

  assert.equal(retry.ok, true);
  assert.deepEqual(calls, ["loading:true", "error:cleared", "apply:1", "loading:false"]);
});

test("a throwing reader still reports an error and always ends loading", () => {
  const calls = [];
  const result = runLocalProfileLoad({
    readResult: () => { throw new Error("reader exploded"); },
    setLoading: value => calls.push(`loading:${value}`),
    setError: value => calls.push(value === null ? "error:cleared" : "error:set"),
    applyData: () => calls.push("apply"),
  });
  assert.equal(result.ok, false);
  assert.deepEqual(calls, ["loading:true", "error:cleared", "error:set", "loading:false"]);
});
