import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { newSession } from "./draft.js";
import { clearDraft, draftHasContent, loadDraft, saveDraft } from "./draftStorage.js";

function fakeStorage() {
  const data = {};
  return { data, get:key=>data[key]??null, set(key,value){data[key]=value;return true;}, remove(key){delete data[key];return true;} };
}

describe("in-progress draft storage", () => {
  test("does not save a pristine draft", () => {
    const storage = fakeStorage();
    assert.equal(saveDraft(storage, "user-a", newSession("MON")), false);
    assert.equal(loadDraft(storage, "user-a"), null);
  });

  test("round-trips entered sets with a timestamp", () => {
    const storage = fakeStorage();
    const draft = newSession("TUE");
    draft.exercises[0].sets[0].weight = "135";
    assert.equal(saveDraft(storage, "user-a", draft, new Date("2026-08-13T12:00:00Z")), true);
    assert.deepEqual(loadDraft(storage, "user-a"), { draft, savedAt:"2026-08-13T12:00:00.000Z" });
  });

  test("namespaces isolate users and guest mode", () => {
    const storage = fakeStorage();
    const draft = newSession("WED"); draft.notes = "Knees felt good";
    saveDraft(storage, "user-a", draft);
    assert.equal(loadDraft(storage, "user-b"), null);
    assert.equal(loadDraft(storage, "guest"), null);
  });

  test("rejects malformed or obsolete drafts without throwing", () => {
    const storage = fakeStorage();
    storage.data["workout-draft:user-a"] = JSON.stringify({ savedAt:"x", draft:{day:"NOPE"} });
    assert.equal(loadDraft(storage, "user-a"), null);
  });

  test("machine selection, extra sets, completed sets, and notes count as content", () => {
    const machine = newSession("MON"); machine.exercises[0].equipment = "machine"; machine.exercises[0].name = "Chest Press Machine";
    const extra = newSession("MON"); extra.exercises[0].sets.push({weight:"",reps:"",unit:"lb",done:false});
    const done = newSession("MON"); done.exercises[0].sets[0].done = true;
    const notes = newSession("MON"); notes.notes = "Low energy";
    for (const draft of [machine, extra, done, notes]) assert.equal(draftHasContent(draft), true);
  });

  test("clear removes the saved draft", () => {
    const storage = fakeStorage();
    const draft = newSession("FRI"); draft.notes = "saved";
    saveDraft(storage, "user-a", draft);
    assert.equal(clearDraft(storage, "user-a"), true);
    assert.equal(loadDraft(storage, "user-a"), null);
  });
});
