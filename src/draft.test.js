import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { emptySets, hasEnteredData, countEnteredSets, buildDraftExercise, isCompleteSet, newSession } from "./draft.js";
import { dayTemplates, variantFor } from "./data/exercises.js";

describe("draft construction", () => {
  test("emptySets returns one blank set defaulting to lb", () => {
    assert.deepEqual(emptySets(), [{ weight: "", reps: "", unit: "lb", done: false }]);
  });

  test("emptySets returns a fresh array each call", () => {
    const a = emptySets();
    a[0].weight = "135";
    assert.equal(emptySets()[0].weight, "", "must not share state between calls");
  });

  test("hasEnteredData is false for blank sets", () => {
    assert.equal(hasEnteredData(emptySets()), false);
    assert.equal(hasEnteredData([{ weight: "", reps: "", unit: "lb", done: false }]), false);
    assert.equal(hasEnteredData([]), false);
  });

  test("hasEnteredData is false for whitespace-only entries", () => {
    assert.equal(hasEnteredData([{ weight: "   ", reps: "", unit: "lb" }]), false);
  });

  test("hasEnteredData is true when either weight or reps is filled", () => {
    assert.equal(hasEnteredData([{ weight: "135", reps: "", unit: "lb" }]), true);
    assert.equal(hasEnteredData([{ weight: "", reps: "8", unit: "lb" }]), true);
  });

  test("a savable set requires both weight and reps", () => {
    assert.equal(isCompleteSet({weight:"100",reps:""}),false);
    assert.equal(isCompleteSet({weight:"",reps:"10"}),false);
    assert.equal(isCompleteSet({weight:"100",reps:"10"}),true);
  });

  test("bodyweight, timed, and distance sets need a result but not weight",()=>{
    assert.equal(isCompleteSet({weight:"",reps:"12"},"bodyweight"),true);
    assert.equal(isCompleteSet({weight:"",reps:"45"},"timed"),true);
    assert.equal(isCompleteSet({weight:"",reps:"30"},"distance"),true);
    assert.equal(isCompleteSet({weight:"20",reps:""},"bodyweight"),false);
  });

  test("rejects zero, negative, and non-numeric results",()=>{
    assert.equal(isCompleteSet({weight:"",reps:"0"},"bodyweight"),false);
    assert.equal(isCompleteSet({weight:"",reps:"-2"},"timed"),false);
    assert.equal(isCompleteSet({weight:"",reps:"many"},"distance"),false);
  });

  test("hasEnteredData ignores a ticked done flag with no numbers", () => {
    assert.equal(hasEnteredData([{ weight: "", reps: "", unit: "lb", done: true }]), false);
  });

  test("countEnteredSets counts only sets with data", () => {
    assert.equal(countEnteredSets([
      { weight: "135", reps: "8" },
      { weight: "", reps: "" },
      { weight: "", reps: "10" },
    ]), 2);
  });

  test("buildDraftExercise carries name and equipment, with one blank set", () => {
    const v = { equipment: "machine", name: "Chest Press Machine", target: "3 x 10-12" };
    assert.deepEqual(buildDraftExercise(v), {
      name: "Chest Press Machine", equipment: "machine",
      sets: [{ weight: "", reps: "", unit: "lb", done: false }],
    });
  });

  test("newSession defaults every exercise to its free variant", () => {
    const s = newSession("MON", {}, new Date(2026, 7, 11, 21, 0));
    assert.equal(s.exercises.length, 5);
    for (const ex of s.exercises) assert.equal(ex.equipment, "free");
    assert.equal(s.exercises[0].name, dayTemplates.MON.exercises[0].variants[0].name);
  });

  test("newSession honours a stored machine preference", () => {
    const freeName = dayTemplates.MON.exercises[0].variants[0].name;
    const machineName = variantFor(dayTemplates.MON.exercises[0], "machine").name;
    const s = newSession("MON", { [freeName]: "machine" }, new Date(2026, 7, 11, 21, 0));
    assert.equal(s.exercises[0].equipment, "machine");
    assert.equal(s.exercises[0].name, machineName);
    assert.equal(s.exercises[1].equipment, "free", "other exercises unaffected");
  });

  test("newSession dates the session with the LOCAL calendar day", () => {
    // 9pm local. Before the 2026-08-11 fix this produced tomorrow's date.
    const s = newSession("MON", {}, new Date(2026, 7, 11, 21, 0));
    assert.equal(s.date, "2026-08-11");
  });

  test("newSession records the day key and starts with empty notes", () => {
    const s = newSession("WED", {}, new Date(2026, 7, 12, 9, 0));
    assert.equal(s.day, "WED");
    assert.equal(s.notes, "");
    assert.match(s.id, /^session_\d+$/);
  });

  test("newSession ignores a preference naming an unknown exercise", () => {
    const s = newSession("MON", { "Nonexistent Lift": "machine" }, new Date(2026, 7, 11, 9, 0));
    for (const ex of s.exercises) assert.equal(ex.equipment, "free");
  });
});
