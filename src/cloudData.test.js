import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { reconcileCloudData } from "./cloudData.js";

describe("cloud data reconciliation", () => {
  const empty = { sessions:[], bodyweights:[], equipmentPrefs:{} };

  test("merges local, legacy, and collection-based records", () => {
    const result = reconcileCloudData(
      { ...empty, sessions:[{id:"local",date:"2026-01-01"}] },
      {
        ...empty,
        sessions:[{id:"cloud",date:"2026-01-02"}],
        legacy:{ ...empty, sessions:[{id:"legacy",date:"2026-01-03"}] },
      },
    );
    assert.deepEqual(result.sessions.map(s=>s.id).sort(), ["cloud","legacy","local"]);
  });

  test("cloud tombstones prevent stale local sessions from returning", () => {
    const result = reconcileCloudData(
      { ...empty, sessions:[{id:"deleted-on-phone",date:"2026-01-01"}] },
      { ...empty, deletedSessionIds:["deleted-on-phone"], deletedWeightDates:[] },
    );
    assert.deepEqual(result.sessions, []);
  });

  test("bodyweight tombstones are keyed by date", () => {
    const result = reconcileCloudData(
      { ...empty, bodyweights:[{id:"old-id",date:"2026-01-01",weight:180}] },
      { ...empty, deletedSessionIds:[], deletedWeightDates:["2026-01-01"] },
    );
    assert.deepEqual(result.bodyweights, []);
  });
});
