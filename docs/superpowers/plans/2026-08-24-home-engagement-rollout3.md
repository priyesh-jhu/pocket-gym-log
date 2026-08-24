# Home Engagement Rollout 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a required per-set RPE (6-10) rating to live session logging, surface it in History (read + optional edit), and add a new "grinding too much" insight card on Home.

**Architecture:** `rpe` becomes a new optional key on the existing set object shape (uniform across tracking types, exactly like `weight` already is). The live-session "mark done" flow enforces it via the same inline validation-with-status-banner pattern `toggleSetDone` already uses for weight/reps completeness — not a disabled button, matching the codebase's existing convention more closely. History's write path already round-trips unknown fields; only its read display and edit-draft mapping need explicit updates to surface RPE. A new pure-function module, styled after the existing `trainingInsights.js`, computes the "grinding too much" signal from the same "3 sessions in a row" windowing convention already established there.

**Tech Stack:** React 19, Node's native test runner (`node --test src`), no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-24-home-engagement-rollout3-design.md`

## Global Constraints

- `rpe` is optional on the set object; whole-number 6-10 only.
- `isCompleteSet` (`src/draft.js`) is NOT changed — it continues to validate only weight/reps. RPE requirement is enforced only in the live session's `toggleSetDone`, never at History-edit-save time.
- History edits are never gated on RPE — the edit sheet's RPE control is optional there, and existing historical sets are never forced to backfill it.
- `src/backup.js` needs no changes — it already round-trips unknown set fields with no whitelist.
- New pure-function tests follow this project's minimal-test convention (a handful of direct `node:test` cases, no exhaustive matrices).
- Run `npm test` and `npm run build` before every commit.

---

### Task 1: `rpe` on the set data model

**Files:**
- Modify: `src/draft.js`
- Modify: `src/draft.test.js`

**Interfaces:**
- Produces: `emptySets()` now returns `[{ weight:"", reps:"", unit:"lb", done:false, rpe:null }]`. New export `RPE_OPTIONS = [6, 7, 8, 9, 10]`.

- [ ] **Step 1: Update the existing failing test**

`src/draft.test.js` currently has (around line 7-9):
```js
test("emptySets returns one blank set defaulting to lb", () => {
  assert.deepEqual(emptySets(), [{ weight: "", reps: "", unit: "lb", done: false }]);
});
```
Change the expected object to include the new field:
```js
test("emptySets returns one blank set defaulting to lb", () => {
  assert.deepEqual(emptySets(), [{ weight: "", reps: "", unit: "lb", done: false, rpe: null }]);
});
```
Add one new test near it:
```js
test("RPE_OPTIONS is the whole-number 6-10 scale", () => {
  assert.deepEqual(RPE_OPTIONS, [6, 7, 8, 9, 10]);
});
```
Add `RPE_OPTIONS` to the existing import line from `"./draft.js"` at the top of the test file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test 2>&1 | grep -B2 -A5 "emptySets returns one blank set"`
Expected: FAIL — the `deepEqual` mismatch (missing `rpe` key) and `RPE_OPTIONS is not defined`.

- [ ] **Step 3: Implement**

In `src/draft.js`, change:
```js
export function emptySets() { return [{ weight:"", reps:"", unit:"lb", done:false }]; }
```
to:
```js
export function emptySets() { return [{ weight:"", reps:"", unit:"lb", done:false, rpe:null }]; }
```
Add, near the top of the file (after the imports, before `isCompleteSet`):
```js
/** Whole-number RPE scale this app supports, lowest to highest effort. */
export const RPE_OPTIONS = [6, 7, 8, 9, 10];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add src/draft.js src/draft.test.js
git commit -m "Add rpe field to the set data model and RPE_OPTIONS scale"
```

---

### Task 2: RPE input + required-before-done enforcement in live session logging

**Files:**
- Modify: `src/screens/SessionScreen.jsx`
- Modify: `src/screens/SessionScreen.css`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `RPE_OPTIONS` from `src/draft.js` (Task 1); the existing generic `updateSet(ei, si, field, val)` handler (no change needed — already field-name-agnostic); the existing `toggleSetDone(ei, si)` function in `src/App.jsx`, which already has an inline validation-with-status-banner pattern for weight/reps completeness (lines 595-607) that this task extends with one more check.

- [ ] **Step 1: Add the RPE select to the set row**

In `src/screens/SessionScreen.jsx`, add `RPE_OPTIONS` to the existing import from `"../draft.js"`:
```js
import { countEnteredSets, RPE_OPTIONS } from "../draft.js";
```

Find the set row rendering (the `ex.sets.map((set, si) => { ... })` block, currently ending with the reps input and the remove button):
```jsx
                    <input className="session-set-input" type="number" inputMode="numeric" placeholder={trackingCopy.measure} value={set.reps} onChange={e => updateSet(ei, si, "reps", e.target.value)} />
                    <button className="session-set-remove" onClick={() => removeSet(ei, si)} disabled={ex.sets.length <= 1}>×</button>
```
Insert a new `<select>` between the reps input and the remove button:
```jsx
                    <input className="session-set-input" type="number" inputMode="numeric" placeholder={trackingCopy.measure} value={set.reps} onChange={e => updateSet(ei, si, "reps", e.target.value)} />
                    <select className="session-set-rpe" aria-label={`RPE for set ${si + 1}`} value={set.rpe ?? ""} onChange={e => updateSet(ei, si, "rpe", e.target.value ? Number(e.target.value) : null)}>
                      <option value="">RPE</option>
                      {RPE_OPTIONS.map(value => <option key={value} value={value}>{value}</option>)}
                    </select>
                    <button className="session-set-remove" onClick={() => removeSet(ei, si)} disabled={ex.sets.length <= 1}>×</button>
```

- [ ] **Step 2: Add supporting CSS**

In `src/screens/SessionScreen.css`, find the existing `.session-set-unit` rule (the unit `<select>` styling) and add a sibling rule for the new RPE select right after it, matching the same declarations but a narrower width (RPE only ever shows 2-digit numbers, unlike the unit select's "lb"/"kg" text) — read the existing `.session-set-unit` rule first, then add:
```css
.session-set-rpe { width: 56px; }
```
(If `.session-set-unit` already sets shared properties like `height`/`border`/`font-size` that `.session-set-rpe` should also have, extend the selector list instead of duplicating: change `.session-set-unit { ... }` to `.session-set-unit, .session-set-rpe { ... }` and keep the width difference as a separate, more specific rule below it.)

- [ ] **Step 3: Enforce RPE before a set can be marked done**

In `src/App.jsx`, `toggleSetDone` currently reads (lines 595-607):
```js
function toggleSetDone(ei, si) {
  const selectedSet=draft.exercises[ei]?.sets[si];
  const tracking=trackingForExercise(draft.exercises[ei]);
  const becomingDone=!selectedSet?.done;
  if(becomingDone&&!isCompleteSet(selectedSet,tracking)) {
    const labels=trackingLabels(tracking);
    setSaveStatus("error"); setStatusMsg(tracking===TRACKING_TYPES.WEIGHTED?"Enter both weight and reps before completing a set.":`Enter ${labels.measure.toLowerCase()} before completing a set.`);
    setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},2500);
    return;
  }
  setDraft(prev => ({ ...prev, startedAt:prev.startedAt || new Date().toISOString(), exercises: prev.exercises.map((ex,i) => i!==ei?ex:{ ...ex, sets: ex.sets.map((s,j)=>j!==si?s:{...s,done:becomingDone}) }) }));
  if (becomingDone) startRestTimer(getRestTimerSeconds(equipmentPrefs));
}
```
Add a second guard, right after the existing one, before the `setDraft(...)` call:
```js
function toggleSetDone(ei, si) {
  const selectedSet=draft.exercises[ei]?.sets[si];
  const tracking=trackingForExercise(draft.exercises[ei]);
  const becomingDone=!selectedSet?.done;
  if(becomingDone&&!isCompleteSet(selectedSet,tracking)) {
    const labels=trackingLabels(tracking);
    setSaveStatus("error"); setStatusMsg(tracking===TRACKING_TYPES.WEIGHTED?"Enter both weight and reps before completing a set.":`Enter ${labels.measure.toLowerCase()} before completing a set.`);
    setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},2500);
    return;
  }
  if(becomingDone&&!selectedSet?.rpe) {
    setSaveStatus("error"); setStatusMsg("Rate this set's RPE (6-10) before marking it done.");
    setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},2500);
    return;
  }
  setDraft(prev => ({ ...prev, startedAt:prev.startedAt || new Date().toISOString(), exercises: prev.exercises.map((ex,i) => i!==ei?ex:{ ...ex, sets: ex.sets.map((s,j)=>j!==si?s:{...s,done:becomingDone}) }) }));
  if (becomingDone) startRestTimer(getRestTimerSeconds(equipmentPrefs));
}
```
(Marking a set back to *not* done — `becomingDone === false` — is unaffected, exactly like the existing weight/reps guard: both checks are skipped when un-completing a set.)

- [ ] **Step 4: Verify manually**

Run: `npm test && npm run build`
Expected: full suite passes (this task adds no new automated tests — `toggleSetDone` is a closure inside `App.jsx` with no existing direct unit test for its weight/reps guard either, consistent with this project's convention of verifying `SessionScreen`/`App.jsx` UI behavior manually rather than through component tests), build succeeds.

Run `npm run dev`, start a workout, enter weight and reps for a set, and try to mark it done WITHOUT selecting an RPE — confirm the existing red status banner now reads "Rate this set's RPE (6-10) before marking it done." instead of completing the set. Then select an RPE value and confirm the set can be marked done normally, exactly as before this change.

- [ ] **Step 5: Commit**

```bash
git add src/screens/SessionScreen.jsx src/screens/SessionScreen.css src/App.jsx
git commit -m "Require RPE before a set can be marked done in live sessions"
```

---

### Task 3: RPE in History (read display + optional edit)

**Files:**
- Modify: `src/historyRecords.js`
- Modify: `src/historyRecords.test.js`
- Modify: `src/screens/HistoryScreen.jsx`

**Interfaces:**
- Consumes: `RPE_OPTIONS` from `src/draft.js` (Task 1).
- Produces: `normalizeSet` now includes `rpe` in its returned object; `setDisplay` appends RPE text when present; `createHistoryDraft`'s per-set objects gain an editable `rpe` string field; `preparedSet` writes `rpe` back onto the persisted set.

- [ ] **Step 1: Write the failing tests**

In `src/historyRecords.test.js`, the existing `confirmed()` fixture (around line 154-167) already has `{ name: "Hanging Leg Raises", tracking: "bodyweight", sets: [{ weight: "", reps: "12", unit: "lb", rpe: 7 }] }` and an existing test at line 231 already asserts `assert.equal(session.exercises[1].sets[0].rpe, 7);` after an edit that never touches that set — this must keep passing unchanged (verifies RPE survives an untouched edit through the new code, not just the old pass-through).

Add these new tests (find a sensible spot near the existing `setDisplay`/normalization tests — check the file for where display-string tests already live and place these alongside them):
```js
test("a normalized set includes rpe and its display text includes it when present", () => {
  const record = normalizeHistorySessions([confirmed()])[0];
  const rated = record.exercises[1].sets[0];
  assert.equal(rated.rpe, 7);
  assert.equal(rated.display.includes("RPE 7"), true);
});

test("a set without rpe displays with no RPE text", () => {
  const record = normalizeHistorySessions([confirmed()])[0];
  const unrated = record.exercises[0].sets[0];
  assert.equal(unrated.rpe, null);
  assert.equal(unrated.display.includes("RPE"), false);
});

test("a draft's set rpe is editable and round-trips through an update", () => {
  const original = confirmed();
  const draft = createHistoryDraft(original);
  assert.equal(draft.exercises[1].sets[0].rpe, "7");
  draft.exercises[1].sets[0].rpe = "9";
  const { session } = prepareHistoryUpdate(original, draft);
  assert.equal(session.exercises[1].sets[0].rpe, 9);
});

test("clearing a draft's rpe stores null", () => {
  const original = confirmed();
  const draft = createHistoryDraft(original);
  draft.exercises[1].sets[0].rpe = "";
  const { session } = prepareHistoryUpdate(original, draft);
  assert.equal(session.exercises[1].sets[0].rpe, null);
});
```
(`normalizeHistorySessions`, `createHistoryDraft`, `prepareHistoryUpdate`, and `confirmed` are already imported/defined earlier in this file — no new imports needed for these four tests.)

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test 2>&1 | grep -B2 -A5 "rpe"`
Expected: FAIL — `rated.rpe` is `undefined` (not `7`), display text doesn't include "RPE", `draft.exercises[1].sets[0].rpe` is `undefined`.

- [ ] **Step 3: Implement**

In `src/historyRecords.js`, update `setDisplay` (currently lines 57-69) to append RPE when present:
```js
function setDisplay(set, tracking) {
  const weight = numberOrNull(set.weight);
  const measure = numberOrNull(set.reps);
  const unit = unitOf(set);
  const rpe = numberOrNull(set.rpe);
  const measureText = measure === null ? "" :
    tracking === TRACKING_TYPES.TIMED ? `${measure} sec` :
    tracking === TRACKING_TYPES.DISTANCE ? `${measure} m` :
    `${measure} reps`;
  // A missing optional weight is omitted rather than rendered as a misleading 0.
  const weightText = weight === null ? "" : `${weight} ${unit}`;
  const base = weightText && measureText ? `${weightText} × ${measureText}` : (weightText || measureText);
  return rpe === null ? base : `${base} · RPE ${rpe}`;
}
```
Update `normalizeSet` (currently lines 71-77) to include `rpe`:
```js
function normalizeSet(set, tracking) {
  if (!isPlainObject(set)) return null;
  const weight = numberOrNull(set.weight);
  const reps = numberOrNull(set.reps);
  if (weight === null && reps === null) return null;
  return { weight, reps, unit: unitOf(set), rpe: numberOrNull(set.rpe), display: setDisplay(set, tracking) };
}
```
Update `createHistoryDraft`'s per-set mapping (currently lines 194-200) to add an editable `rpe` string field, following the exact same string-conversion convention already used for `weight`/`reps`:
```js
        sets: sets.map((set, setIndex) => ({
          key: `e${exerciseIndex}s${setIndex}`,
          sourceIndex: setIndex,
          weight: set?.weight === null || set?.weight === undefined ? "" : String(set.weight),
          reps: set?.reps === null || set?.reps === undefined ? "" : String(set.reps),
          unit: unitOf(set),
          rpe: set?.rpe === null || set?.rpe === undefined ? "" : String(set.rpe),
        })),
```
Update `createDraftSet` (currently lines 207-210) so a newly-added blank set row also carries the field:
```js
export function createDraftSet(exercise, key) {
  const lastUnit = exercise?.sets?.at(-1)?.unit;
  return { key, sourceIndex: null, weight: "", reps: "", unit: lastUnit === "kg" ? "kg" : "lb", rpe: "" };
}
```
Update `preparedSet` (currently lines 212-222) to write `rpe` back onto the persisted set:
```js
function preparedSet(originalSet, draftSet) {
  const base = isPlainObject(originalSet) ? { ...originalSet } : {};
  // `done` is a live-workout flag; completed records never store it.
  delete base.done;
  const rpe = text(draftSet.rpe).trim();
  return {
    ...base,
    weight: text(draftSet.weight).trim(),
    reps: text(draftSet.reps).trim(),
    unit: draftSet.unit === "kg" ? "kg" : "lb",
    rpe: rpe === "" ? null : Number(rpe),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`.

- [ ] **Step 5: Add the RPE select to the History edit sheet**

In `src/screens/HistoryScreen.jsx`, add `RPE_OPTIONS` to the imports:
```js
import { RPE_OPTIONS } from "../draft.js";
```
Find the set edit row (the `exercise.sets.map((set, index) => (...))` block inside the `<ul className="history-editor__sets">`, currently ending with the reps `TextField` and the "Remove" `Button`):
```jsx
                      <TextField
                        label={`${measureLabel(exercise.tracking)} · set ${index + 1}`}
                        type="number"
                        inputMode="numeric"
                        step="any"
                        placeholder={measurePlaceholder(exercise.tracking)}
                        value={set.reps}
                        data-field={index === 0 ? "sets" : undefined}
                        aria-describedby={saveError?.field === "sets" && index === 0 ? errorId : undefined}
                        onChange={event => updateSet(exercise.key, set.key, { reps: event.target.value })}
                      />
                      <Button
                        variant="text"
                        aria-label={`Remove set ${index + 1} of ${exercise.name || "this exercise"}`}
                        onClick={() => removeSet(exercise.key, set.key)}
                      >Remove</Button>
```
Insert a new RPE `<select>` between the reps field and the Remove button, using the same generic `updateSet(exercise.key, set.key, change)` handler this file already uses for every other set field:
```jsx
                      <TextField
                        label={`${measureLabel(exercise.tracking)} · set ${index + 1}`}
                        type="number"
                        inputMode="numeric"
                        step="any"
                        placeholder={measurePlaceholder(exercise.tracking)}
                        value={set.reps}
                        data-field={index === 0 ? "sets" : undefined}
                        aria-describedby={saveError?.field === "sets" && index === 0 ? errorId : undefined}
                        onChange={event => updateSet(exercise.key, set.key, { reps: event.target.value })}
                      />
                      <label className="history-field">
                        <span className="history-field__label">RPE</span>
                        <select
                          className="history-select"
                          value={set.rpe}
                          aria-label={`RPE for ${exercise.name || "exercise"} set ${index + 1}`}
                          onChange={event => updateSet(exercise.key, set.key, { rpe: event.target.value })}
                        >
                          <option value="">—</option>
                          {RPE_OPTIONS.map(value => <option key={value} value={value}>{value}</option>)}
                        </select>
                      </label>
                      <Button
                        variant="text"
                        aria-label={`Remove set ${index + 1} of ${exercise.name || "this exercise"}`}
                        onClick={() => removeSet(exercise.key, set.key)}
                      >Remove</Button>
```
(This reuses the exact `.history-field`/`.history-select` classes already applied to the existing unit `<select>` a few lines above — no new CSS needed.)

- [ ] **Step 6: Verify manually**

Run: `npm run build`
Expected: build succeeds.

Run `npm run dev`, open History, expand a workout that has an RPE-rated set (or complete a new one first via Task 2's flow), and confirm the set's line shows "· RPE {n}" in the read view. Open that workout's edit sheet, confirm the RPE select shows the stored value, change it, save, and confirm the read view reflects the new value. Also confirm editing an OLD workout that predates this feature (no `rpe` on its sets) shows "—" in the edit sheet and can be saved without ever touching RPE.

- [ ] **Step 7: Commit**

```bash
git add src/historyRecords.js src/historyRecords.test.js src/screens/HistoryScreen.jsx
git commit -m "Surface RPE in History's read view and edit sheet"
```

---

### Task 4: "Grinding too much" insight

**Files:**
- Create: `src/rpeInsights.js`
- Create: `src/rpeInsights.test.js`
- Modify: `src/screens/HomeScreen.jsx`
- Modify: `src/screens/HomeScreen.css`

**Interfaces:**
- Produces: `grindingInsights(sessions, limit = 5)` → `Array<{ type: "grinding", name: string, date: string, evidence: [{date, avgRpe}], action: string, message: string }>`, newest-first, capped at `limit`.

- [ ] **Step 1: Write the failing tests**

Create `src/rpeInsights.test.js`:
```js
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { grindingInsights } from "./rpeInsights.js";

const session = (date, name, rpes) => ({
  date,
  exercises: [{ name, sets: rpes.map(rpe => ({ weight: "100", reps: "5", unit: "lb", rpe })) }],
});

describe("grindingInsights", () => {
  test("flags an exercise averaging RPE 9+ across the last 3 sessions", () => {
    const result = grindingInsights([
      session("2026-08-01", "Squat", [9, 9]),
      session("2026-08-03", "Squat", [9, 10]),
      session("2026-08-05", "Squat", [9, 9]),
    ]);
    assert.equal(result.length, 1);
    assert.equal(result[0].type, "grinding");
    assert.equal(result[0].name, "Squat");
    assert.equal(result[0].evidence.length, 3);
  });

  test("does not flag when only 2 of the last 3 sessions qualify", () => {
    const result = grindingInsights([
      session("2026-08-01", "Squat", [9, 9]),
      session("2026-08-03", "Squat", [7, 8]),
      session("2026-08-05", "Squat", [9, 9]),
    ]);
    assert.deepEqual(result, []);
  });

  test("returns no insights when no sets carry an rpe", () => {
    const sessions = [{ date: "2026-08-01", exercises: [{ name: "Squat", sets: [{ weight: "100", reps: "5", unit: "lb" }] }] }];
    assert.deepEqual(grindingInsights(sessions), []);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -A3 "grindingInsights"`
Expected: FAIL — `Cannot find module './rpeInsights.js'`.

- [ ] **Step 3: Implement `src/rpeInsights.js`**

```js
// ─── RPE INSIGHTS ──────────────────────────────────────────────────────────────
// A separate signal from trainingInsights.js's stall/deload detection: flags
// sustained near-failure training (RPE 9+ for 3 sessions running) rather than
// a plateau or decline in load. Same "3 in a row" windowing convention.

function averageRpe(session, name) {
  const values = [];
  for (const exercise of session?.exercises || []) {
    if (exercise?.name !== name) continue;
    for (const set of exercise.sets || []) {
      const rpe = Number(set?.rpe);
      if (Number.isFinite(rpe) && rpe > 0) values.push(rpe);
    }
  }
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Flags an exercise whose last 3 logged sessions (sessions containing at
 * least one rated set for that exercise) all averaged RPE 9 or higher.
 */
export function grindingInsights(sessions, limit = 5) {
  const history = new Map();
  for (const session of [...(Array.isArray(sessions) ? sessions : [])].sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    for (const exercise of session?.exercises || []) {
      const avg = averageRpe(session, exercise.name);
      if (avg === null) continue;
      const entries = history.get(exercise.name) || [];
      entries.push({ date: session.date, avgRpe: Math.round(avg * 10) / 10 });
      history.set(exercise.name, entries);
    }
  }

  const insights = [];
  for (const [name, entries] of history) {
    if (entries.length < 3) continue;
    const recent = entries.slice(-3);
    if (recent.every(item => item.avgRpe >= 9)) {
      insights.push({
        type: "grinding",
        name,
        date: recent.at(-1).date,
        evidence: recent,
        action: "Reduce load ~10% or add a rest day",
        message: `You've rated the last 3 sessions of ${name} at RPE 9+. Consider a lighter week or backing off load a bit.`,
      });
    }
  }
  return insights.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, limit);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`.

- [ ] **Step 5: Surface it on Home**

In `src/screens/HomeScreen.jsx`, add the import:
```js
import { grindingInsights } from "../rpeInsights.js";
```
Add, near the existing `const insight = trainingInsights(sessions, 1)[0];` line:
```js
  const grinding = grindingInsights(sessions, 1)[0];
```
Directly after the existing Training insight card:
```jsx
      {insight && <Card className="home-insight"><p>Training insight</p><strong>{insight.name}</strong><span>{insight.message}</span></Card>}
```
add a second, separate card reusing the same `.home-insight` visual styling (not merged into the same `Card` element — a distinct card, distinct condition, sharing only the CSS class):
```jsx
      {insight && <Card className="home-insight"><p>Training insight</p><strong>{insight.name}</strong><span>{insight.message}</span></Card>}
      {grinding && <Card className="home-insight"><p>Effort check</p><strong>{grinding.name}</strong><span>{grinding.message}</span></Card>}
```

- [ ] **Step 6: Verify manually**

Run: `npm run build`
Expected: build succeeds.

Run `npm run dev`, log 3 sessions of the same exercise all with every set rated RPE 9 or 10, and confirm an "Effort check" card appears on Home showing that exercise's name and message — separate from (and not replacing) the existing "Training insight" card if one is also showing. Confirm the card is absent entirely on a profile with no qualifying data.

- [ ] **Step 7: Commit**

```bash
git add src/rpeInsights.js src/rpeInsights.test.js src/screens/HomeScreen.jsx src/screens/HomeScreen.css
git commit -m "Add grinding-too-much insight card to Home"
```

(No new CSS is actually required in `src/screens/HomeScreen.css` for this task — the new card reuses `.home-insight` entirely. If a review finds the `HomeScreen.css` modify listed above unnecessary, that's correct; only stage it if you end up adding something.)

---

## Final Verification

After all four tasks:

- [ ] Run `npm test` — full suite passes.
- [ ] Run `npm run build` — succeeds with no errors.
- [ ] Run `npm run lint` — no new warnings/errors introduced by this rollout's files.
- [ ] Manually walk through, in one `npm run dev` session: start a workout, try to mark a set done without RPE (blocked with the new message), rate it and confirm it completes; save the session; open History and confirm the RPE shows in the read view and is editable (optionally) in the edit sheet; log 3 sessions at RPE 9+ for one exercise and confirm the new "Effort check" card appears on Home.
- [ ] Bump version (`npm version minor --no-git-tag-version` — this is a new feature, not a bug fix), rebuild, commit, `firebase deploy --only hosting`, `git push` — per this project's established release process.
