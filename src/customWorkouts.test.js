import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { addExerciseToDraft, applyWorkoutTemplate, createCustomExercise, createCustomExerciseFromLibrary, getCustomExercises, getWorkoutTemplates, saveWorkoutTemplate } from "./customWorkouts.js";

describe("custom exercises and templates", () => {
  test("creates, validates, and reads a custom exercise", () => {
    const result = createCustomExercise({}, {name:"Sled Push",target:"4 x 20 meters",tip:"Stay low"}, 1);
    assert.equal(result.ok,true);
    assert.deepEqual(getCustomExercises(result.prefs), [{id:"custom-1",name:"Sled Push",target:"4 x 20 meters",tip:"Stay low"}]);
    assert.equal(createCustomExercise(result.prefs,{name:"sled push"},2).ok,false);
    assert.equal(createCustomExercise({}, {name:"Overhead Press"},2).ok,false);
  });

  test("adds a custom exercise without mutating the draft", () => {
    const draft={exercises:[]};
    const updated=addExerciseToDraft(draft,{name:"Sled Push",target:"4 x 20 meters"});
    assert.equal(draft.exercises.length,0);
    assert.equal(updated.exercises[0].equipment,"custom");
  });

  test("saves a reusable template and replaces one with the same name", () => {
    const draft={day:"MON",exercises:[{name:"Overhead Press",equipment:"free",sets:[{},{}]}]};
    const first=saveWorkoutTemplate({},"Quick Push",draft,1,{restSeconds:120});
    const second=saveWorkoutTemplate(first.prefs,"quick push",draft,2);
    assert.equal(getWorkoutTemplates(second.prefs).length,1);
    assert.equal(getWorkoutTemplates(second.prefs)[0].id,"template-2");
    assert.equal(getWorkoutTemplates(first.prefs)[0].restSeconds,120);
    assert.equal(getWorkoutTemplates(first.prefs)[0].exercises[0].setCount,2);
  });

  test("applies a template with fresh blank sets", () => {
    const draft={day:"MON",notes:"old",startedAt:"x",exercises:[]};
    const template={day:"TUE",exercises:[{name:"Sled Push",equipment:"custom",target:"4 x 20 meters",tip:"Low",setCount:2}]};
    const result=applyWorkoutTemplate(draft,template);
    assert.equal(result.day,"TUE");
    assert.equal(result.notes,"");
    assert.equal(result.startedAt,null);
    assert.equal(result.exercises[0].sets.length,2);
  });

  test("creates a custom exercise from a library entry, carrying its muscle mapping", () => {
    const libraryEntry = { id: "Zottman_Curl", name: "Zottman Curl", primaryMuscles: ["hamstrings", "glutes"], secondaryMuscles: ["lowerBack"] };
    const result = createCustomExerciseFromLibrary({}, libraryEntry, 1);
    assert.equal(result.ok, true);
    assert.deepEqual(result.exercise, {
      id: "custom-1", name: "Zottman Curl", target: "3 x 8-12", tip: "",
      libraryId: "Zottman_Curl", primaryMuscles: ["hamstrings", "glutes"], secondaryMuscles: ["lowerBack"],
    });
    assert.deepEqual(getCustomExercises(result.prefs), [result.exercise]);
  });

  test("rejects a library exercise whose name collides with an existing one", () => {
    const first = createCustomExerciseFromLibrary({}, { id: "a", name: "Sled Push", primaryMuscles: ["quads"], secondaryMuscles: [] }, 1);
    const second = createCustomExerciseFromLibrary(first.prefs, { id: "b", name: "sled push", primaryMuscles: ["quads"], secondaryMuscles: [] }, 2);
    assert.equal(second.ok, false);
    assert.equal(createCustomExerciseFromLibrary({}, { id: "c", name: "Overhead Press", primaryMuscles: ["chest"], secondaryMuscles: [] }, 2).ok, false);
  });

  test("existing free-text custom exercises keep their original 4-key shape with no library fields", () => {
    const result = createCustomExercise({}, { name: "Farmer Walk", target: "3 x 40m" }, 1);
    assert.deepEqual(getCustomExercises(result.prefs), [{ id: "custom-1", name: "Farmer Walk", target: "3 x 40m", tip: "" }]);
  });

  test("addExerciseToDraft carries libraryId and muscle fields through when present", () => {
    const draft = { exercises: [] };
    const libraryExercise = { name: "Romanian Deadlift", target: "3 x 8-12", tip: "", libraryId: "Romanian_Deadlift", primaryMuscles: ["hamstrings"], secondaryMuscles: [] };
    const updated = addExerciseToDraft(draft, libraryExercise);
    assert.equal(updated.exercises[0].libraryId, "Romanian_Deadlift");
    assert.deepEqual(updated.exercises[0].primaryMuscles, ["hamstrings"]);
  });
});
