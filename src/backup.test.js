import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildBackup, validateBackup, mergeBackup, replaceBackup } from "./backup.js";

describe("backup validate/merge", () => {
  test("validates a v1 file (no version, no equipmentPrefs)", () => {
    const r = validateBackup({
      exportedAt: "2026-01-01T00:00:00.000Z", profile: "alice",
      loggedSessions: [{ id: "s1", date: "2026-01-01", exercises: [] }],
      bodyweights: [{ id: "w1", date: "2026-01-01", weight: 180, unit: "lb" }],
    });
    assert.equal(r.ok, true);
    assert.equal(r.data.sessions.length, 1);
    assert.equal(r.data.bodyweights.length, 1);
    assert.deepEqual(r.data.equipmentPrefs, {});
    assert.deepEqual(r.data.skipped, { sessions: 0, bodyweights: 0 });
  });

  test("validates a v2 file with equipmentPrefs", () => {
    const r = validateBackup({
      version: 2, exportedAt: "x", profile: "bob",
      loggedSessions: [], bodyweights: [],
      equipmentPrefs: { "Bench Press": "machine" },
    });
    assert.equal(r.ok, true);
    assert.deepEqual(r.data.equipmentPrefs, { "Bench Press": "machine" });
  });

  test("rejects garbage input cleanly", () => {
    assert.equal(validateBackup(null).ok, false);
    assert.equal(validateBackup(undefined).ok, false);
    assert.equal(validateBackup("not an object").ok, false);
    assert.equal(validateBackup([1, 2, 3]).ok, false);
    assert.equal(validateBackup({ loggedSessions: "nope" }).ok, false);
    assert.equal(typeof validateBackup(null).error, "string");
  });

  test("skips a malformed session entry rather than failing the whole file", () => {
    const r = validateBackup({
      loggedSessions: [
        { id: "s1", date: "2026-01-01", exercises: [] },
        { id: "s2" }, // no date
        { date: "2026-01-02", exercises: [] }, // no id
        { id: "s3", date: "2026-01-03", exercises: "nope" }, // exercises not an array
      ],
      bodyweights: [],
    });
    assert.equal(r.ok, true);
    assert.equal(r.data.sessions.length, 1);
    assert.equal(r.data.skipped.sessions, 3);
  });

  test("rejects a session whose exercise has a non-array sets (the render-crash payload)", () => {
    // This is the exact shape that used to pass validation and then crash
    // buildPRMap's `ex.sets.forEach(...)` on every render, permanently
    // bricking the app once persisted (CRITICAL-1).
    const r = validateBackup({
      loggedSessions: [{ id: "s1", date: "2026-01-01", exercises: [{ name: "Bench", sets: "not-an-array" }] }],
      bodyweights: [],
    });
    assert.equal(r.ok, true);
    assert.equal(r.data.sessions.length, 0);
    assert.equal(r.data.skipped.sessions, 1);
  });

  test("rejects a session whose exercise has a non-object set", () => {
    const r = validateBackup({
      loggedSessions: [{ id: "s1", date: "2026-01-01", exercises: [{ name: "Bench", sets: ["not-an-object"] }] }],
      bodyweights: [],
    });
    assert.equal(r.data.sessions.length, 0);
    assert.equal(r.data.skipped.sessions, 1);
  });

  test("skips a malformed bodyweight entry and counts it", () => {
    const r = validateBackup({
      loggedSessions: [],
      bodyweights: [
        { id: "w1", date: "2026-01-01", weight: 180, unit: "lb" },
        { id: "w2", weight: 180 }, // no date
        { id: "w3", date: "2026-01-02", weight: "not-a-number" },
      ],
    });
    assert.equal(r.ok, true);
    assert.equal(r.data.bodyweights.length, 1);
    assert.equal(r.data.skipped.bodyweights, 2);
  });

  test("rejects weights parseFloat would let through, and stores good ones as numbers", () => {
    const r = validateBackup({
      loggedSessions: [],
      bodyweights: [
        { id: "w1", date: "2026-01-01", weight: "150abc" }, // parseFloat("150abc") is 150 — must be rejected
        { id: "w2", date: "2026-01-02", weight: [180] },     // parseFloat([180]) is 180 — must be rejected
        { id: "w3", date: "2026-01-03", weight: "  165.5  " }, // parses cleanly once trimmed — must survive
      ],
    });
    assert.equal(r.data.bodyweights.length, 1);
    assert.equal(r.data.skipped.bodyweights, 2);
    assert.equal(r.data.bodyweights[0].weight, 165.5);
    assert.equal(typeof r.data.bodyweights[0].weight, "number");
  });

  test("merge is a union: local-only and incoming-only entries both survive", () => {
    const current = { sessions: [{ id: "b", date: "2026-01-02" }], bodyweights: [], equipmentPrefs: {} };
    const incoming = { sessions: [{ id: "a", date: "2026-01-01" }], bodyweights: [], equipmentPrefs: {} };
    const merged = mergeBackup(current, incoming);
    assert.equal(merged.sessions.length, 2);
    assert.deepEqual(merged.sessions.map(s => s.id).sort(), ["a", "b"]);
    // Sorted with .sort() above so a reversed/dropped date comparator would
    // still pass that assertion — pin the actual output order too.
    assert.deepEqual(merged.sessions.map(s => s.date), ["2026-01-01", "2026-01-02"]);
  });

  test("merge keeps the LOCAL session on id collision", () => {
    const current = { sessions: [{ id: "a", date: "2026-01-01", notes: "local" }], bodyweights: [], equipmentPrefs: {} };
    const incoming = { sessions: [{ id: "a", date: "2026-01-01", notes: "imported" }], bodyweights: [], equipmentPrefs: {} };
    const merged = mergeBackup(current, incoming);
    assert.equal(merged.sessions.length, 1);
    assert.equal(merged.sessions[0].notes, "local");
  });

  test("merge keeps the INCOMING bodyweight entry on date collision", () => {
    const current = { sessions: [], bodyweights: [{ id: "w1", date: "2026-01-01", weight: 180, unit: "lb" }], equipmentPrefs: {} };
    const incoming = { sessions: [], bodyweights: [{ id: "w2", date: "2026-01-01", weight: 175, unit: "lb" }], equipmentPrefs: {} };
    const merged = mergeBackup(current, incoming);
    assert.equal(merged.bodyweights.length, 1);
    assert.equal(merged.bodyweights[0].weight, 175);
  });

  test("merge does not mutate its inputs", () => {
    const current = { sessions: [{ id: "a", date: "2026-01-01" }], bodyweights: [{ id: "w1", date: "2026-01-01", weight: 180, unit: "lb" }], equipmentPrefs: { x: "free" } };
    const incoming = { sessions: [{ id: "b", date: "2026-01-02" }], bodyweights: [{ id: "w2", date: "2026-01-02", weight: 170, unit: "lb" }], equipmentPrefs: { y: "machine" } };
    const currentSnapshot = JSON.parse(JSON.stringify(current));
    const incomingSnapshot = JSON.parse(JSON.stringify(incoming));
    mergeBackup(current, incoming);
    assert.deepEqual(current, currentSnapshot);
    assert.deepEqual(incoming, incomingSnapshot);
  });

  test("merge reports overwritten bodyweights on collision with a different value (Merge is 'recommended' but must not silently clobber)", () => {
    const current = { sessions: [], bodyweights: [{ id: "w1", date: "2026-01-01", weight: 180, unit: "lb" }], equipmentPrefs: {} };
    const incoming = { sessions: [], bodyweights: [{ id: "w2", date: "2026-01-01", weight: 175, unit: "lb" }], equipmentPrefs: {} };
    const merged = mergeBackup(current, incoming);
    assert.deepEqual(merged.added, { sessions: 0, bodyweights: 0 });
    assert.deepEqual(merged.overwritten, { bodyweights: 1 });
  });

  test("merge does not count a same-value collision as overwritten", () => {
    const current = { sessions: [], bodyweights: [{ id: "w1", date: "2026-01-01", weight: 180, unit: "lb" }], equipmentPrefs: {} };
    const incoming = { sessions: [], bodyweights: [{ id: "w2", date: "2026-01-01", weight: 180, unit: "lb" }], equipmentPrefs: {} };
    const merged = mergeBackup(current, incoming);
    assert.deepEqual(merged.overwritten, { bodyweights: 0 });
  });

  test("added counts only genuinely new entries", () => {
    const current = { sessions: [{ id: "a", date: "2026-01-01" }], bodyweights: [{ id: "w1", date: "2026-01-01", weight: 180, unit: "lb" }], equipmentPrefs: {} };
    const incoming = {
      sessions: [{ id: "a", date: "2026-01-01" }, { id: "b", date: "2026-01-02" }],
      bodyweights: [{ id: "w1", date: "2026-01-01", weight: 179, unit: "lb" }, { id: "w2", date: "2026-01-02", weight: 178, unit: "lb" }],
      equipmentPrefs: {},
    };
    const merged = mergeBackup(current, incoming);
    assert.deepEqual(merged.added, { sessions: 1, bodyweights: 1 });
  });

  test("round trip: buildBackup output passes validateBackup", () => {
    const backup = buildBackup({
      profile: "carol",
      sessions: [{ id: "s1", date: "2026-01-01", day: "MON", notes: "", exercises: [] }],
      bodyweights: [{ id: "w1", date: "2026-01-01", weight: 150, unit: "lb" }],
      equipmentPrefs: { "Bench Press": "free" },
    });
    const r = validateBackup(backup);
    assert.equal(r.ok, true);
    assert.equal(r.data.sessions.length, 1);
    assert.equal(r.data.bodyweights.length, 1);
    assert.deepEqual(r.data.equipmentPrefs, { "Bench Press": "free" });
    assert.deepEqual(r.data.skipped, { sessions: 0, bodyweights: 0 });
  });

  test("replaceBackup returns the incoming data as-is", () => {
    const incoming = { sessions: [{ id: "a", date: "2026-01-01" }], bodyweights: [{ id: "w1", date: "2026-01-01", weight: 180 }], equipmentPrefs: { x: "machine" } };
    assert.deepEqual(replaceBackup(incoming), incoming);
  });
});
