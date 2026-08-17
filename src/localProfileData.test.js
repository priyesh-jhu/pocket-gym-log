import test from "node:test";
import assert from "node:assert/strict";
import { profileLoadErrors, readLocalProfileResult, runLocalProfileLoad, sessionKey, weightKey } from "./localProfileData.js";

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

// ─── PER-COLLECTION ISOLATION ─────────────────────────────────────────────────
// Workouts and weigh-ins are separate keys and separate destinations. A corrupt
// blob in one must never make the other unreachable, or a user with a perfectly
// good training history is told it cannot be shown.

const VALID_SESSIONS = [{ id: "s1", date: "2026-08-14", exercises: [{ name: "Squat", sets: [{ weight: "225", reps: "5", unit: "lb" }] }] }];
const VALID_WEIGHTS = [{ id: "w1", date: "2026-08-14", weight: 180, unit: "lb" }];

test("a corrupt weigh-in blob leaves the workout history readable", () => {
  const storage = fakeStorage({
    [sessionKey(PROFILE)]: JSON.stringify(VALID_SESSIONS),
    [weightKey(PROFILE)]: "{not json",
  });
  const result = readLocalProfileResult({ storage, profile: PROFILE, loadPrefs });

  assert.equal(result.sessions.ok, true);
  assert.deepEqual(result.sessions.data, VALID_SESSIONS);
  assert.equal(result.sessions.error, null);
  assert.equal(result.bodyweights.ok, false);
  assert.ok(result.bodyweights.error instanceof Error);
  // The coarse answer still reports a failure, but History's own error is clear.
  assert.equal(result.ok, false);
  assert.equal(profileLoadErrors(result).sessions, null);
  assert.ok(profileLoadErrors(result).bodyweights instanceof Error);
});

test("a corrupt workout blob leaves the weigh-ins readable", () => {
  const storage = fakeStorage({
    [sessionKey(PROFILE)]: JSON.stringify({ id: "s1" }),
    [weightKey(PROFILE)]: JSON.stringify(VALID_WEIGHTS),
  });
  const result = readLocalProfileResult({ storage, profile: PROFILE, loadPrefs });

  assert.equal(result.bodyweights.ok, true);
  assert.deepEqual(result.bodyweights.data, VALID_WEIGHTS);
  assert.equal(result.sessions.ok, false);
  assert.ok(profileLoadErrors(result).sessions instanceof Error);
  assert.equal(profileLoadErrors(result).bodyweights, null);
});

test("both collections can fail independently", () => {
  const storage = fakeStorage({
    [sessionKey(PROFILE)]: "[1,",
    [weightKey(PROFILE)]: "{not json",
  });
  const result = readLocalProfileResult({ storage, profile: PROFILE, loadPrefs });
  const errors = profileLoadErrors(result);

  assert.equal(result.ok, false);
  assert.equal(result.data, null);
  assert.ok(errors.sessions instanceof Error);
  assert.ok(errors.bodyweights instanceof Error);
});

test("thrown access on one key does not fail the other", () => {
  const storage = fakeStorage({ [weightKey(PROFILE)]: JSON.stringify(VALID_WEIGHTS) }, sessionKey(PROFILE));
  const result = readLocalProfileResult({ storage, profile: PROFILE, loadPrefs });
  assert.equal(result.sessions.ok, false);
  assert.equal(result.bodyweights.ok, true);
  assert.deepEqual(result.bodyweights.data, VALID_WEIGHTS);
});

test("an unusable storage object fails both collections without throwing", () => {
  const result = readLocalProfileResult({ storage: null, profile: PROFILE, loadPrefs });
  assert.equal(result.sessions.ok, false);
  assert.equal(result.bodyweights.ok, false);
  assert.deepEqual(result.equipmentPrefs, { "Barbell Bench Press": "machine" });
});

test("nothing failed means no per-collection errors at all", () => {
  const clean = readLocalProfileResult({ storage: fakeStorage(), profile: PROFILE, loadPrefs });
  assert.equal(profileLoadErrors(clean), null);
});

test("a load applies the readable collections even when the other one fails", () => {
  const applied = [];
  const errors = [];
  const storage = fakeStorage({
    [sessionKey(PROFILE)]: JSON.stringify(VALID_SESSIONS),
    [weightKey(PROFILE)]: "{not json",
  });
  runLocalProfileLoad({
    readResult: () => readLocalProfileResult({ storage, profile: PROFILE, loadPrefs }),
    setLoading: () => {},
    setError: value => errors.push(value),
    applyData: data => applied.push(data),
  });

  assert.equal(applied.length, 1);
  assert.deepEqual(applied[0].sessions, VALID_SESSIONS);
  assert.equal("bodyweights" in applied[0], false, "an unreadable collection must not be applied");
  assert.equal(errors.at(-1).sessions, null);
  assert.ok(errors.at(-1).bodyweights instanceof Error);
});

test("a retry that repairs only the weigh-ins keeps History readable throughout", () => {
  const entries = {
    [sessionKey(PROFILE)]: JSON.stringify(VALID_SESSIONS),
    [weightKey(PROFILE)]: "{not json",
  };
  const options = {
    readResult: () => readLocalProfileResult({ storage: fakeStorage(entries), profile: PROFILE, loadPrefs }),
    setLoading: () => {},
    setError: () => {},
    applyData: () => {},
  };

  const first = runLocalProfileLoad(options);
  assert.equal(first.sessions.ok, true);
  assert.equal(profileLoadErrors(first).sessions, null);

  entries[weightKey(PROFILE)] = JSON.stringify(VALID_WEIGHTS);
  const retry = runLocalProfileLoad(options);
  assert.equal(retry.ok, true);
  assert.equal(profileLoadErrors(retry), null);
  assert.deepEqual(retry.sessions.data, VALID_SESSIONS);
});

test("a retry that repairs the workouts clears the History error and applies them", () => {
  const entries = { [sessionKey(PROFILE)]: "[1," };
  const applied = [];
  const errors = [];
  const options = {
    readResult: () => readLocalProfileResult({ storage: fakeStorage(entries), profile: PROFILE, loadPrefs }),
    setLoading: () => {},
    setError: value => errors.push(value),
    applyData: data => applied.push(data),
  };

  runLocalProfileLoad(options);
  assert.ok(errors.at(-1).sessions instanceof Error);
  assert.equal(applied.length, 1, "readable weigh-ins are still applied");
  assert.equal("sessions" in applied[0], false);

  entries[sessionKey(PROFILE)] = JSON.stringify(VALID_SESSIONS);
  runLocalProfileLoad(options);
  assert.equal(errors.at(-1), null);
  assert.deepEqual(applied.at(-1).sessions, VALID_SESSIONS);
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
