import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { MUSCLES, formGuide } from "./formGuide.js";

describe("formGuide integrity", () => {
  const names = Object.keys(formGuide);

  test("has an entry for every exercise currently in the plan", () => {
    assert.equal(names.length, 25);
  });

  test("every guide has all required sections, non-empty", () => {
    for (const [name, g] of Object.entries(formGuide)) {
      assert.ok(Array.isArray(g.setup) && g.setup.length > 0, `${name}: setup`);
      assert.ok(Array.isArray(g.execution) && g.execution.length > 0, `${name}: execution`);
      assert.ok(typeof g.breathing === "string" && g.breathing.length > 0, `${name}: breathing`);
      assert.ok(Array.isArray(g.mistakes) && g.mistakes.length > 0, `${name}: mistakes`);
      for (const step of [...g.setup, ...g.execution, ...g.mistakes]) {
        assert.ok(typeof step === "string" && step.trim().length > 0, `${name}: blank line`);
      }
    }
  });

  test("every view is front or back", () => {
    for (const [name, g] of Object.entries(formGuide)) {
      assert.ok(g.view === "front" || g.view === "back", `${name}: view=${g.view}`);
    }
  });

  test("every muscle key exists in MUSCLES", () => {
    for (const [name, g] of Object.entries(formGuide)) {
      assert.ok(Array.isArray(g.primary), `${name}: primary must be an array`);
      assert.ok(Array.isArray(g.secondary), `${name}: secondary must be an array`);
      for (const m of [...g.primary, ...g.secondary]) {
        assert.ok(m in MUSCLES, `${name}: unknown muscle "${m}"`);
      }
    }
  });

  test("every guide names at least one primary muscle", () => {
    for (const [name, g] of Object.entries(formGuide)) {
      assert.ok(g.primary.length > 0, `${name}: no primary muscle`);
    }
  });

  test("primary and secondary never list the same muscle", () => {
    for (const [name, g] of Object.entries(formGuide)) {
      for (const m of g.primary) {
        assert.ok(!g.secondary.includes(m), `${name}: "${m}" in both primary and secondary`);
      }
    }
  });
});
