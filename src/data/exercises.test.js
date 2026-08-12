import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { dayOrder, dayTemplates } from "./exercises.js";

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
