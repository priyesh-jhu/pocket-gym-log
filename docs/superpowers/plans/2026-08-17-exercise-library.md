# Exercise Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every exercise — built-in or custom — access to muscle-group data and a visual demonstration, and let users pick a custom exercise from a searchable ~800-exercise library instead of typing a free-text name.

**Architecture:** Vendor a trimmed, public-domain exercise dataset (free-exercise-db) into the repo as a static JSON file + static images at build-prep time (no runtime network calls). Extend the existing custom-exercise data model with optional library-linked fields. Add a searchable picker sheet and extend the existing session form-guide modal to render library-sourced guides alongside the existing hand-authored ones.

**Tech Stack:** React (existing app), Node's built-in test runner (`node --test`), plain CSS with the project's existing design tokens, no new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-08-17-exercise-library-design.md`

## Global Constraints

- No live network calls at runtime — all exercise data and images ship bundled in the repo. (Spec: "Goals" #4, "Data source")
- Do not modify or re-author the existing 30 hand-authored `formGuide.js` entries. (Spec: "Non-goals")
- No hand-curated per-exercise muscle mapping beyond the coarse category table — accept the coarser grouping (e.g. `"shoulders"` lighting up all three delt regions together). (Spec: "Design" §1)
- Library picking only applies to the custom-exercise flow; built-in day-template exercises are not swappable via the picker. (Spec: "Non-goals")
- No animated GIFs — two static pose images per exercise, tap-to-toggle. (Spec: "Media format")
- Components/screens are not unit-tested in this project (established convention) — only pure logic gets automated tests; UI changes are verified through the existing manual 360/390px + light/dark human-verification pass.

---

### Task 1: Muscle-name mapping module

**Files:**
- Create: `src/data/muscleMap.js`
- Test: `src/data/muscleMap.test.js`

**Interfaces:**
- Produces: `mapMuscles(names: string[]) => string[]` — maps free-exercise-db muscle names to this app's `MUSCLES` keys (from `src/data/formGuide.js`), deduped, unknown names dropped silently.
- Produces: `viewForMuscles(muscleKeys: string[]) => "front" | "back"` — `"back"` if any key is back-only, `"front"` otherwise (including the empty-array default).

free-exercise-db's full muscle vocabulary (confirmed by inspecting its `dist/exercises.json`) is exactly: `abdominals, abductors, adductors, biceps, calves, chest, forearms, glutes, hamstrings, lats, lower back, middle back, neck, quadriceps, shoulders, traps, triceps`. This app's `MUSCLES` taxonomy (`src/data/formGuide.js`) has no equivalent for `neck` (dropped entirely) or a dedicated hip-abductor region (mapped to the closest region, `glutes`).

- [ ] **Step 1: Write the failing test**

```js
// src/data/muscleMap.test.js
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mapMuscles, viewForMuscles } from "./muscleMap.js";

describe("muscleMap", () => {
  test("maps direct 1:1 muscle names", () => {
    assert.deepEqual(mapMuscles(["chest", "biceps"]), ["chest", "biceps"]);
  });

  test("expands shoulders to all three delt regions", () => {
    assert.deepEqual(mapMuscles(["shoulders"]), ["frontDelts", "sideDelts", "rearDelts"]);
  });

  test("maps multi-word upstream names", () => {
    assert.deepEqual(mapMuscles(["lower back", "middle back"]), ["lowerBack", "midBack"]);
  });

  test("drops unmappable names and dedupes", () => {
    assert.deepEqual(mapMuscles(["neck", "chest", "chest"]), ["chest"]);
  });

  test("returns an empty array for no input", () => {
    assert.deepEqual(mapMuscles([]), []);
    assert.deepEqual(mapMuscles(undefined), []);
  });

  test("picks back view when any muscle is back-only", () => {
    assert.equal(viewForMuscles(["lats"]), "back");
    assert.equal(viewForMuscles(["chest", "lowerBack"]), "back");
  });

  test("defaults to front view", () => {
    assert.equal(viewForMuscles(["chest"]), "front");
    assert.equal(viewForMuscles(["triceps"]), "front");
    assert.equal(viewForMuscles([]), "front");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/data/muscleMap.test.js`
Expected: FAIL — `Cannot find module './muscleMap.js'`

- [ ] **Step 3: Write the implementation**

```js
// src/data/muscleMap.js

/** free-exercise-db muscle name -> this app's MUSCLES keys (formGuide.js). */
export const LIBRARY_MUSCLE_MAP = {
  abdominals: ["abs"],
  abductors: ["glutes"], // closest region in this app's taxonomy — no dedicated abductor zone
  adductors: ["adductors"],
  biceps: ["biceps"],
  calves: ["calves"],
  chest: ["chest"],
  forearms: ["forearms"],
  glutes: ["glutes"],
  hamstrings: ["hamstrings"],
  lats: ["lats"],
  "lower back": ["lowerBack"],
  "middle back": ["midBack"],
  quadriceps: ["quads"],
  shoulders: ["frontDelts", "sideDelts", "rearDelts"],
  traps: ["traps"],
  triceps: ["triceps"],
  // "neck" intentionally omitted — no equivalent region in this app's body map.
};

export function mapMuscles(names) {
  const out = new Set();
  for (const name of names || []) {
    for (const key of LIBRARY_MUSCLE_MAP[name] || []) out.add(key);
  }
  return [...out];
}

const BACK_ONLY_MUSCLES = new Set(["traps", "rearDelts", "midBack", "lats", "lowerBack", "glutes", "hamstrings"]);

export function viewForMuscles(muscleKeys) {
  return (muscleKeys || []).some(key => BACK_ONLY_MUSCLES.has(key)) ? "back" : "front";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/data/muscleMap.test.js`
Expected: PASS, all 7 subtests green.

- [ ] **Step 5: Commit**

```bash
git add src/data/muscleMap.js src/data/muscleMap.test.js
git commit -m "Add muscle-name mapping for the exercise library"
```

---

### Task 2: Vendor the exercise-library dataset

**Files:**
- Create: `scripts/build-exercise-library.mjs`
- Create (generated by running the script in Step 2 below, then committed): `src/data/exerciseLibrary.json`
- Create (generated, then committed): `public/exercise-images/<id>/0.jpg`, `public/exercise-images/<id>/1.jpg` (one pair per kept exercise)
- Test: `src/data/exerciseLibrary.test.js`
- Modify: `package.json` — add a `build:exercise-library` script entry

**Interfaces:**
- Consumes: `mapMuscles` from `src/data/muscleMap.js` (Task 1).
- Produces: `src/data/exerciseLibrary.json` — an array of
  `{ id, name, primaryMuscles, secondaryMuscles, equipment, category, instructions }`,
  where `primaryMuscles`/`secondaryMuscles` are already-mapped `MUSCLES` keys
  (not upstream names). Every kept entry has at least one `primaryMuscles`
  entry. Image files live at `public/exercise-images/<id>/0.jpg` and `1.jpg`
  by convention — the JSON does not repeat image filenames.

This script makes real network calls (it downloads ~800 exercises' worth of
JSON and up to ~1,600 images from GitHub's raw content host) and is **not**
run by the test suite or CI — it's a one-time data-prep step whose *output*
gets committed to the repo. Running it will take a few minutes.

- [ ] **Step 1: Write the script**

```js
// scripts/build-exercise-library.mjs
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { mapMuscles } from "../src/data/muscleMap.js";

const SOURCE_JSON = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const OUT_JSON = resolve(import.meta.dirname, "../src/data/exerciseLibrary.json");
const OUT_IMAGES_DIR = resolve(import.meta.dirname, "../public/exercise-images");

async function main() {
  const response = await fetch(SOURCE_JSON);
  if (!response.ok) throw new Error(`Failed to fetch exercise data: ${response.status}`);
  const upstream = await response.json();

  const kept = [];
  let droppedNoPrimary = 0;

  for (const entry of upstream) {
    const primaryMuscles = mapMuscles(entry.primaryMuscles);
    if (!primaryMuscles.length) { droppedNoPrimary++; continue; }
    const secondaryMuscles = mapMuscles(entry.secondaryMuscles).filter(m => !primaryMuscles.includes(m));
    kept.push({
      id: entry.id,
      name: entry.name,
      primaryMuscles,
      secondaryMuscles,
      equipment: entry.equipment || "",
      category: entry.category || "",
      instructions: Array.isArray(entry.instructions) ? entry.instructions : [],
      _images: Array.isArray(entry.images) ? entry.images.slice(0, 2) : [],
    });
  }

  kept.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`Kept ${kept.length} exercises, dropped ${droppedNoPrimary} with no mappable primary muscle.`);

  await mkdir(OUT_IMAGES_DIR, { recursive: true });
  let imageCount = 0;
  for (const entry of kept) {
    if (!entry._images.length) continue;
    const dir = resolve(OUT_IMAGES_DIR, entry.id);
    await mkdir(dir, { recursive: true });
    for (let i = 0; i < entry._images.length; i++) {
      const imageResponse = await fetch(IMAGE_BASE + entry._images[i]);
      if (!imageResponse.ok) { console.warn(`Image fetch failed for ${entry.id}/${i}: ${imageResponse.status}`); continue; }
      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      await writeFile(resolve(dir, `${i}.jpg`), buffer);
      imageCount++;
    }
  }
  console.log(`Downloaded ${imageCount} images.`);

  const output = kept.map(({ _images, ...rest }) => rest);
  await writeFile(OUT_JSON, JSON.stringify(output, null, 2) + "\n");
  console.log(`Wrote ${OUT_JSON}`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Add the package.json script entry**

In `package.json`'s `"scripts"` block (alongside `"test:tz"`, `"lint"`, etc.), add:

```json
"build:exercise-library": "node scripts/build-exercise-library.mjs"
```

- [ ] **Step 3: Run the script to generate and commit the data**

Run: `npm run build:exercise-library`

Expected output: `Kept <N> exercises, dropped <M> with no mappable primary muscle.` followed by
`Downloaded <count> images.` and a final `Wrote .../src/data/exerciseLibrary.json` line. This will
take a few minutes due to the number of image downloads. Confirm afterward:

```bash
ls public/exercise-images | wc -l   # should roughly match the "Kept" count
node -e "console.log(require('./src/data/exerciseLibrary.json').length)"
```

- [ ] **Step 4: Write the failing shape test**

```js
// src/data/exerciseLibrary.test.js
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import exerciseLibrary from "./exerciseLibrary.json" with { type: "json" };
import { MUSCLES } from "./formGuide.js";

describe("exerciseLibrary.json", () => {
  test("is a non-empty array", () => {
    assert.ok(Array.isArray(exerciseLibrary));
    assert.ok(exerciseLibrary.length > 0);
  });

  test("every entry has at least one valid primary muscle, and all muscles are valid MUSCLES keys", () => {
    const validKeys = new Set(Object.keys(MUSCLES));
    for (const entry of exerciseLibrary) {
      assert.ok(entry.primaryMuscles.length > 0, `${entry.id} has no primary muscles`);
      for (const key of [...entry.primaryMuscles, ...entry.secondaryMuscles]) {
        assert.ok(validKeys.has(key), `${entry.id} has invalid muscle key "${key}"`);
      }
    }
  });

  test("every entry has a unique id and non-empty name", () => {
    const ids = new Set();
    for (const entry of exerciseLibrary) {
      assert.ok(entry.id && !ids.has(entry.id), `duplicate or missing id: ${entry.id}`);
      ids.add(entry.id);
      assert.ok(entry.name && entry.name.trim().length > 0);
    }
  });
});
```

- [ ] **Step 5: Run test to verify it fails or passes**

Run: `node --test src/data/exerciseLibrary.test.js`
Expected: PASS if Step 3 ran correctly (the file already satisfies these invariants by construction — this test guards against future re-runs of the script against a changed upstream dataset introducing drift). If it fails, fix `muscleMap.js` (Task 1) or the script (Step 1) and re-run Step 3.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-exercise-library.mjs src/data/exerciseLibrary.json src/data/exerciseLibrary.test.js public/exercise-images package.json
git commit -m "Vendor free-exercise-db as the bundled exercise library"
```

---

### Task 3: Extend the custom-exercise data model

**Files:**
- Modify: `src/customWorkouts.js`
- Modify: `src/customWorkouts.test.js`

**Interfaces:**
- Consumes: nothing new from earlier tasks (this task is independent of Tasks 1-2's data, only shapes how a library entry — `{id, name, primaryMuscles, secondaryMuscles}` — flows into a custom exercise record).
- Produces: `createCustomExerciseFromLibrary(prefs, libraryEntry, now=Date.now()) => { ok, error?, exercise?, prefs }` — same result shape as the existing `createCustomExercise`.
- Produces: `getCustomExercises` and `addExerciseToDraft` now pass through three additional *optional* fields — `libraryId`, `primaryMuscles`, `secondaryMuscles` — present only when an exercise originated from the library. Exercises created via the existing free-text `createCustomExercise` continue to produce the exact same 4-key shape as before (no new keys added when absent).

- [ ] **Step 1: Write the failing tests**

Add to `src/customWorkouts.test.js` (inside the existing `describe` block, alongside the existing tests — do not remove any existing test):

```js
  test("creates a custom exercise from a library entry, carrying its muscle mapping", () => {
    const libraryEntry = { id: "Romanian_Deadlift", name: "Romanian Deadlift", primaryMuscles: ["hamstrings", "glutes"], secondaryMuscles: ["lowerBack"] };
    const result = createCustomExerciseFromLibrary({}, libraryEntry, 1);
    assert.equal(result.ok, true);
    assert.deepEqual(result.exercise, {
      id: "custom-1", name: "Romanian Deadlift", target: "3 x 8-12", tip: "",
      libraryId: "Romanian_Deadlift", primaryMuscles: ["hamstrings", "glutes"], secondaryMuscles: ["lowerBack"],
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
```

Update the import line at the top of `src/customWorkouts.test.js` to include the new function:

```js
import { addExerciseToDraft, applyWorkoutTemplate, createCustomExercise, createCustomExerciseFromLibrary, getCustomExercises, getWorkoutTemplates, saveWorkoutTemplate } from "./customWorkouts.js";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/customWorkouts.test.js`
Expected: FAIL — `createCustomExerciseFromLibrary is not a function`, and the "keeps original 4-key shape" test currently passes already (that's fine, it's a regression guard) but the others fail.

- [ ] **Step 3: Implement the changes**

Replace `getCustomExercises` in `src/customWorkouts.js`:

```js
export function getCustomExercises(prefs) {
  const raw = prefs?.[CUSTOM_EXERCISES_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(item => item && text(item.name)).map(item => {
    const base = {
      id:text(item.id) || `custom-${text(item.name).toLowerCase().replace(/[^a-z0-9]+/g,"-")}`,
      name:text(item.name), target:text(item.target) || "3 x 8-12", tip:text(item.tip,160),
    };
    if (item.libraryId) {
      base.libraryId = text(item.libraryId, 60);
      base.primaryMuscles = Array.isArray(item.primaryMuscles) ? item.primaryMuscles.filter(m => text(m)).slice(0,6) : [];
      base.secondaryMuscles = Array.isArray(item.secondaryMuscles) ? item.secondaryMuscles.filter(m => text(m)).slice(0,6) : [];
    }
    return base;
  });
}
```

Add, directly after `createCustomExercise`:

```js
export function createCustomExerciseFromLibrary(prefs, libraryEntry, now=Date.now()) {
  const name = text(libraryEntry?.name);
  if (!name) return { ok:false, error:"Choose an exercise from the library.", prefs:{...(prefs||{})} };
  const existing = getCustomExercises(prefs);
  if (existing.some(item => item.name.toLowerCase() === name.toLowerCase()) || exerciseForVariantName(name)) {
    return { ok:false, error:"An exercise with that name already exists.", prefs:{...(prefs||{})} };
  }
  const exercise = {
    id:`custom-${now}`, name, target:"3 x 8-12", tip:"",
    libraryId:text(libraryEntry.id, 60),
    primaryMuscles:Array.isArray(libraryEntry.primaryMuscles) ? libraryEntry.primaryMuscles.slice(0,6) : [],
    secondaryMuscles:Array.isArray(libraryEntry.secondaryMuscles) ? libraryEntry.secondaryMuscles.slice(0,6) : [],
  };
  return { ok:true, exercise, prefs:{...(prefs||{}),[CUSTOM_EXERCISES_KEY]:[...existing,exercise]} };
}
```

Replace `addExerciseToDraft`:

```js
export function addExerciseToDraft(draft, exercise) {
  if (!draft || !exercise?.name) return draft;
  const entry = { name:exercise.name, equipment:"custom", target:exercise.target||"3 x 8-12", tip:exercise.tip||"", sets:[{weight:"",reps:"",unit:"lb",done:false}] };
  if (exercise.libraryId) {
    entry.libraryId = exercise.libraryId;
    entry.primaryMuscles = exercise.primaryMuscles || [];
    entry.secondaryMuscles = exercise.secondaryMuscles || [];
  }
  return { ...draft, exercises:[...(draft.exercises||[]), entry] };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/customWorkouts.test.js`
Expected: PASS, all tests including the pre-existing ones (they must still pass unchanged — confirms the free-text path is unaffected).

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npm test`
Expected: PASS, 238 + 4 new = 242 tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add src/customWorkouts.js src/customWorkouts.test.js
git commit -m "Let custom exercises carry library-sourced muscle data"
```

---

### Task 4: Guide-lookup helper (hand-authored vs. library fallback)

**Files:**
- Create: `src/data/exerciseGuide.js`
- Test: `src/data/exerciseGuide.test.js`

**Interfaces:**
- Consumes: `formGuide` from `src/data/formGuide.js`; `viewForMuscles` from `src/data/muscleMap.js` (Task 1); `exerciseLibrary.json` (Task 2); the shape of a draft exercise produced by `addExerciseToDraft` (Task 3) — specifically its optional `libraryId`/`primaryMuscles`/`secondaryMuscles` fields.
- Produces: `guideFor(name: string, draftExercise: object|undefined) => Guide | null`, where `Guide` is either
  `{ kind: "authored", view, primary, secondary, setup, execution, breathing, mistakes }` (the existing `formGuide` shape, tagged) or
  `{ kind: "library", view, primary, secondary, instructions, images: [string, string] }` or `null` if neither applies.

- [ ] **Step 1: Write the failing test**

```js
// src/data/exerciseGuide.test.js
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { guideFor } from "./exerciseGuide.js";
import exerciseLibrary from "./exerciseLibrary.json" with { type: "json" };

describe("guideFor", () => {
  test("returns the hand-authored guide when one exists, ignoring any draft libraryId", () => {
    const guide = guideFor("Barbell/DB Bench Press", { libraryId: "irrelevant" });
    assert.equal(guide.kind, "authored");
    assert.ok(Array.isArray(guide.setup));
  });

  test("returns a library guide for a library-sourced draft exercise with no hand-authored entry", () => {
    const entry = exerciseLibrary[0];
    const draftExercise = { libraryId: entry.id, primaryMuscles: entry.primaryMuscles, secondaryMuscles: entry.secondaryMuscles };
    const guide = guideFor(entry.name, draftExercise);
    assert.equal(guide.kind, "library");
    assert.deepEqual(guide.primary, entry.primaryMuscles);
    assert.deepEqual(guide.instructions, entry.instructions);
    assert.deepEqual(guide.images, [`/exercise-images/${entry.id}/0.jpg`, `/exercise-images/${entry.id}/1.jpg`]);
  });

  test("returns null for a plain custom exercise with no library link", () => {
    assert.equal(guideFor("Some Typed Exercise", { name: "Some Typed Exercise" }), null);
  });

  test("returns null when no draft exercise is provided and there is no hand-authored entry", () => {
    assert.equal(guideFor("Some Typed Exercise", undefined), null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/data/exerciseGuide.test.js`
Expected: FAIL — `Cannot find module './exerciseGuide.js'`

- [ ] **Step 3: Write the implementation**

```js
// src/data/exerciseGuide.js
import { formGuide } from "./formGuide.js";
import { viewForMuscles } from "./muscleMap.js";
import exerciseLibrary from "./exerciseLibrary.json" with { type: "json" };

const libraryById = new Map(exerciseLibrary.map(entry => [entry.id, entry]));

export function guideFor(name, draftExercise) {
  const authored = formGuide[name];
  if (authored) return { kind: "authored", ...authored };

  const libraryId = draftExercise?.libraryId;
  const entry = libraryId && libraryById.get(libraryId);
  if (!entry) return null;

  const primary = draftExercise.primaryMuscles?.length ? draftExercise.primaryMuscles : entry.primaryMuscles;
  const secondary = draftExercise.secondaryMuscles?.length ? draftExercise.secondaryMuscles : entry.secondaryMuscles;
  return {
    kind: "library",
    view: viewForMuscles([...primary, ...secondary]),
    primary, secondary,
    instructions: entry.instructions,
    images: [`/exercise-images/${entry.id}/0.jpg`, `/exercise-images/${entry.id}/1.jpg`],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/data/exerciseGuide.test.js`
Expected: PASS, all 4 subtests green.

- [ ] **Step 5: Commit**

```bash
git add src/data/exerciseGuide.js src/data/exerciseGuide.test.js
git commit -m "Add guide-lookup helper falling back to library data"
```

---

### Task 5: Searchable library picker component

**Files:**
- Create: `src/components/LibraryPickerSheet.jsx`
- Create: `src/components/LibraryPickerSheet.css`
- Modify: `src/components/index.js`

**Interfaces:**
- Consumes: `Sheet`, `Button`, `Chip`, `ListItem`, `TextField` from `./index.js`; `MUSCLES` from `../data/formGuide.js`; `exerciseLibrary.json` (Task 2).
- Produces: `<LibraryPickerSheet open={bool} onClose={fn} onSelect={fn(libraryEntry)} />` — a self-contained component with its own search-text state. `onSelect` receives the full matched entry object from `exerciseLibrary.json`.

No automated test for this component — matches this project's existing convention that screens/components aren't unit-tested (see `03-02-SUMMARY.md` and the `Sheet`/`ListItem`/other component files, none of which have `.test.jsx` siblings). Verified instead by the manual human-verification pass in Task 8.

- [ ] **Step 1: Write the component**

```jsx
// src/components/LibraryPickerSheet.jsx
import { useMemo, useState } from "react";
import { Button, Chip, ListItem, Sheet, TextField } from "./index.js";
import { MUSCLES } from "../data/formGuide.js";
import exerciseLibrary from "../data/exerciseLibrary.json" with { type: "json" };
import "./LibraryPickerSheet.css";

const MAX_RESULTS = 50;

export default function LibraryPickerSheet({ open, onClose, onSelect }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q ? exerciseLibrary.filter(item => item.name.toLowerCase().includes(q)) : exerciseLibrary;
    return matches.slice(0, MAX_RESULTS);
  }, [query]);

  return (
    <Sheet open={open} title="Exercise library" onClose={onClose}>
      <TextField label="Search exercises" value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. Romanian deadlift" />
      <div className="library-picker__count">
        {query
          ? `${results.length}${results.length === MAX_RESULTS ? "+" : ""} match${results.length === 1 ? "" : "es"}`
          : `${exerciseLibrary.length} exercises — type to search`}
      </div>
      <div className="library-picker__list">
        {results.map(item => (
          <button key={item.id} type="button" className="library-picker__row" onClick={() => onSelect(item)}>
            <ListItem
              title={item.name}
              subtitle={item.equipment || undefined}
              trailing={<Chip>{MUSCLES[item.primaryMuscles[0]] || item.primaryMuscles[0]}</Chip>}
            />
          </button>
        ))}
        {results.length === 0 && <div className="library-picker__empty">No exercises match "{query}".</div>}
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 2: Write the stylesheet**

```css
/* src/components/LibraryPickerSheet.css */
.library-picker__count { margin: var(--sp2) 0 var(--sp3); font-size: var(--text-label-sm); color: var(--on-surface-dim); }
.library-picker__list { display: flex; flex-direction: column; gap: var(--sp2); max-height: 60vh; overflow-y: auto; }
.library-picker__row { display: block; width: 100%; text-align: left; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; border-radius: var(--shape-md); min-height: 48px; }
.library-picker__row:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.library-picker__row .m3-list-item { background: var(--surface-container); border-radius: var(--shape-md); padding: var(--sp3); }
.library-picker__empty { padding: var(--sp5) var(--sp4); text-align: center; color: var(--on-surface-dim); font-size: var(--text-body-sm); }
```

- [ ] **Step 3: Export it from the component barrel**

In `src/components/index.js`, add:

```js
export { default as LibraryPickerSheet } from "./LibraryPickerSheet.jsx";
```

- [ ] **Step 4: Run the full test suite and build to confirm nothing broke**

Run: `npm test && npm run build`
Expected: PASS / clean build (this task adds no new automated tests, so this step is the regression guard).

- [ ] **Step 5: Commit**

```bash
git add src/components/LibraryPickerSheet.jsx src/components/LibraryPickerSheet.css src/components/index.js
git commit -m "Add searchable exercise library picker sheet"
```

---

### Task 6: Wire the picker and library guides into SessionScreen

**Files:**
- Modify: `src/screens/SessionScreen.jsx`
- Modify: `src/screens/SessionScreen.css`

**Interfaces:**
- Consumes: `LibraryPickerSheet` (Task 5), `guideFor` (Task 4), `MUSCLES`/`formGuide` (already imported).
- Consumes new props (defined and passed down in Task 7): `guideImageIndex` (number), `toggleGuideImage` (fn), `openGuide` (fn(name)), `addLibraryExercise` (fn(libraryEntry)).
- No new exports — this task only changes JSX/behavior inside the existing default-exported `SessionScreen` component.

- [ ] **Step 1: Update imports**

At the top of `src/screens/SessionScreen.jsx`, there are two separate existing import lines to change.

Change:

```js
import { Button, Sheet } from "../components/index.js";
```

to:

```js
import { Button, LibraryPickerSheet, Sheet } from "../components/index.js";
```

And change:

```js
import { MUSCLES, formGuide } from "../data/formGuide.js";
```

to:

```js
import { MUSCLES, formGuide } from "../data/formGuide.js";
import { guideFor } from "../data/exerciseGuide.js";
```

- [ ] **Step 2: Accept the new props**

In the `SessionScreen({ ... })` destructured prop list, add these alongside the existing `guideExercise, setGuideExercise,` line:

```js
  guideExercise, setGuideExercise, guideImageIndex, toggleGuideImage, openGuide,
```

and alongside the existing `customExercises, customExerciseId, setCustomExerciseId, addSavedCustomExercise,` line:

```js
  customExercises, customExerciseId, setCustomExerciseId, addSavedCustomExercise, addLibraryExercise,
```

- [ ] **Step 3: Replace the `guide` lookup**

Change:

```js
  const guide = guideExercise && formGuide[guideExercise];
```

to:

```js
  const draftGuideExercise = guideExercise && draft.exercises.find(ex => ex.name === guideExercise);
  const guide = guideExercise && guideFor(guideExercise, draftGuideExercise);
```

- [ ] **Step 4: Update the exercise-name badge gating**

Find (inside the exercises map, in the `exercise-head` block):

```jsx
              <button className="session-exercise-name" onClick={() => formGuide[ex.name] && setGuideExercise(ex.name)} disabled={!formGuide[ex.name]}>
                <span className="session-exercise-name__label">{ex.name}</span>
                {formGuide[ex.name] && <span className="session-exercise-name__badge">ⓘ form</span>}
              </button>
```

Replace with:

```jsx
              <button className="session-exercise-name" onClick={() => (formGuide[ex.name] || ex.libraryId) && openGuide(ex.name)} disabled={!(formGuide[ex.name] || ex.libraryId)}>
                <span className="session-exercise-name__label">{ex.name}</span>
                {(formGuide[ex.name] || ex.libraryId) && <span className="session-exercise-name__badge">ⓘ form</span>}
              </button>
```

- [ ] **Step 5: Add the library picker entry point in the tools row**

Find:

```jsx
        {customExercises.length > 0 && <div className="session-tools__row">
          <select className="session-tools__select" value={customExerciseId} onChange={e => setCustomExerciseId(e.target.value)}><option value="">Add a saved exercise…</option>{customExercises.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <Button variant="filled" onClick={addSavedCustomExercise} disabled={!customExerciseId}>Add</Button>
        </div>}
```

Add immediately after that block (still inside `<div className="session-tools">`, before the `session-tools__grid` div):

```jsx
        <div className="session-tools__row">
          <Button variant="text" onClick={() => setSessionSheet("library")}>Search exercise library</Button>
        </div>
```

- [ ] **Step 6: Render the picker sheet**

Right after the closing `</Sheet>` tag of the `sessionSheet === "options"` sheet, and before the `{(restRunning || restComplete) && (` block, add:

```jsx
      <LibraryPickerSheet
        open={sessionSheet === "library"}
        onClose={() => setSessionSheet(null)}
        onSelect={entry => { addLibraryExercise(entry); setSessionSheet(null); }}
      />
```

- [ ] **Step 7: Render the library branch of the guide modal**

Replace the entire `session-guide__body` block:

```jsx
              <div className="session-guide__body">
                <div className="session-guide__cols">
                  <div>
                    <div className="session-bodymap">
                      <div className="session-bodymap__label">MUSCLES · {g.view === "back" ? "BACK" : "FRONT"}</div>
                      <BodyMap view={g.view} primary={g.primary} secondary={g.secondary} color={dayMeta.color} />
                      <div className="session-bodymap__legend">
                        {g.primary.map(m => <span key={m} className="session-bodymap__chip session-bodymap__chip--primary">{MUSCLES[m]}</span>)}
                        {g.secondary.map(m => <span key={m} className="session-bodymap__chip session-bodymap__chip--secondary">{MUSCLES[m]}</span>)}
                      </div>
                      <div className="session-bodymap__caption">● primary ○ secondary</div>
                    </div>
                  </div>
                  <div>
                    <GuideSection icon="🧩" title="SETUP & POSITION" items={g.setup} />
                    <GuideSection icon="🎯" title="EXECUTION" items={g.execution} />
                    <div className="session-guide-breathing">
                      <div className="session-guide-breathing__title">💨 BREATHING</div>
                      <div>{g.breathing}</div>
                    </div>
                    <div className="session-guide-mistakes">
                      <div className="session-guide-mistakes__title">⚠️ COMMON MISTAKES</div>
                      {g.mistakes.map((c, i) => (
                        <div key={i} className="session-guide-mistakes__item"><span>✕</span><span>{c}</span></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
```

with:

```jsx
              <div className="session-guide__body">
                <div className="session-guide__cols">
                  <div>
                    <div className="session-bodymap">
                      <div className="session-bodymap__label">MUSCLES · {g.view === "back" ? "BACK" : "FRONT"}</div>
                      <BodyMap view={g.view} primary={g.primary} secondary={g.secondary} color={dayMeta.color} />
                      <div className="session-bodymap__legend">
                        {g.primary.map(m => <span key={m} className="session-bodymap__chip session-bodymap__chip--primary">{MUSCLES[m]}</span>)}
                        {g.secondary.map(m => <span key={m} className="session-bodymap__chip session-bodymap__chip--secondary">{MUSCLES[m]}</span>)}
                      </div>
                      <div className="session-bodymap__caption">● primary ○ secondary</div>
                    </div>
                    {g.kind === "library" && (
                      <button type="button" className="session-guide-image" onClick={toggleGuideImage}>
                        <img className="session-guide-image__img" src={g.images[guideImageIndex]} alt={`${guideExercise} demonstration`} />
                        <div className="session-guide-image__hint">Tap to see {guideImageIndex === 0 ? "end" : "start"} position</div>
                      </button>
                    )}
                  </div>
                  <div>
                    {g.kind === "authored" ? (
                      <>
                        <GuideSection icon="🧩" title="SETUP & POSITION" items={g.setup} />
                        <GuideSection icon="🎯" title="EXECUTION" items={g.execution} />
                        <div className="session-guide-breathing">
                          <div className="session-guide-breathing__title">💨 BREATHING</div>
                          <div>{g.breathing}</div>
                        </div>
                        <div className="session-guide-mistakes">
                          <div className="session-guide-mistakes__title">⚠️ COMMON MISTAKES</div>
                          {g.mistakes.map((c, i) => (
                            <div key={i} className="session-guide-mistakes__item"><span>✕</span><span>{c}</span></div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <GuideSection icon="📋" title="INSTRUCTIONS" items={g.instructions} />
                    )}
                  </div>
                </div>
              </div>
```

- [ ] **Step 8: Add the new CSS for the image toggle**

Append to `src/screens/SessionScreen.css`:

```css
.session-guide-image { display: block; width: 100%; padding: 0; margin-top: var(--sp3); border: 1px solid var(--outline-variant); border-radius: var(--shape-md); background: var(--surface-container-highest); cursor: pointer; overflow: hidden; }
.session-guide-image__img { display: block; width: 100%; height: auto; }
.session-guide-image__hint { padding: var(--sp2) var(--sp3); font-size: var(--text-label-sm); color: var(--on-surface-dim); text-align: center; }
```

- [ ] **Step 9: Run the full test suite and build**

Run: `npm test && npm run build`
Expected: PASS / clean build. This task changes JSX only, no new automated tests (matches this project's UI-testing convention) — Task 8 covers manual verification.

- [ ] **Step 10: Commit**

```bash
git add src/screens/SessionScreen.jsx src/screens/SessionScreen.css
git commit -m "Wire the library picker and library-sourced guides into SessionScreen"
```

---

### Task 7: Wire library-exercise state and handlers into App.jsx

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `createCustomExerciseFromLibrary` from `./customWorkouts.js` (Task 3).
- Produces (new props passed to `SessionScreen`): `guideImageIndex`, `toggleGuideImage`, `openGuide`, `addLibraryExercise` — matching exactly what Task 6 consumes.

- [ ] **Step 1: Add the new import**

Change line 14:

```js
import { addExerciseToDraft, applyWorkoutTemplate, createCustomExercise, getCustomExercises, getWorkoutTemplates, saveWorkoutTemplate } from "./customWorkouts.js";
```

to:

```js
import { addExerciseToDraft, applyWorkoutTemplate, createCustomExercise, createCustomExerciseFromLibrary, getCustomExercises, getWorkoutTemplates, saveWorkoutTemplate } from "./customWorkouts.js";
```

- [ ] **Step 2: Add the new state**

Immediately after the existing `const [guideExercise, setGuideExercise] = useState(null);` line, add:

```js
  const [guideImageIndex, setGuideImageIndex] = useState(0);
```

- [ ] **Step 3: Add the new handlers**

Immediately after the existing `addSavedCustomExercise` function definition:

```js
  function addSavedCustomExercise() {
    const exercise = getCustomExercises(equipmentPrefs).find(item=>item.id===customExerciseId);
    if (!exercise) return;
    setDraft(prev=>addExerciseToDraft(prev,exercise));
    setWorkoutToolsMsg(`Added ${exercise.name}.`);
  }
```

add:

```js

  function addLibraryExercise(libraryEntry) {
    const result = createCustomExerciseFromLibrary(equipmentPrefs, libraryEntry);
    if (!result.ok) { setWorkoutToolsMsg(result.error); return; }
    saveAccountPrefs(result.prefs);
    setDraft(prev=>addExerciseToDraft(prev,result.exercise));
    setWorkoutToolsMsg(`Added ${result.exercise.name}.`);
  }

  function openGuide(name) {
    setGuideExercise(name);
    setGuideImageIndex(0);
  }

  function toggleGuideImage() {
    setGuideImageIndex(index => (index + 1) % 2);
  }
```

- [ ] **Step 4: Pass the new props down to `SessionScreen`**

Find:

```jsx
            guideExercise={guideExercise} setGuideExercise={setGuideExercise}
            customExercises={customExercises} customExerciseId={customExerciseId} setCustomExerciseId={setCustomExerciseId} addSavedCustomExercise={addSavedCustomExercise}
```

Replace with:

```jsx
            guideExercise={guideExercise} setGuideExercise={setGuideExercise} guideImageIndex={guideImageIndex} toggleGuideImage={toggleGuideImage} openGuide={openGuide}
            customExercises={customExercises} customExerciseId={customExerciseId} setCustomExerciseId={setCustomExerciseId} addSavedCustomExercise={addSavedCustomExercise} addLibraryExercise={addLibraryExercise}
```

- [ ] **Step 5: Run the full test suite and build**

Run: `npm test && npm run build`
Expected: PASS / clean build.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "Wire library-exercise handlers and state into App"
```

---

### Task 8: Full gate and human verification

**Files:** none (verification-only task)

- [ ] **Step 1: Run the complete automated gate**

Run: `npm test && npm run test:tz && npm run build && node scripts/verify-lint-baseline.mjs`
Expected: all green, no new lint-baseline findings, no regressions in the timezone matrix.

- [ ] **Step 2: Grep for stray inline styles**

Run: `! grep -rn "style={{" src/App.jsx src/screens/*.jsx src/components/LibraryPickerSheet.jsx`
Expected: no output (exit 0) other than the pre-existing accepted CSS-custom-property exceptions in `HomeScreen.jsx`/`SessionScreen.jsx`/`SettingsScreen.jsx` (this new component introduces none).

- [ ] **Step 3: Manual verification checkpoint**

Start the dev server (`npm run dev`) and manually verify, at 360px and 390px, in both Light and Dark:

- Starting a session, opening "Customize workout" → "Search exercise library", searching for a few names (e.g. "squat", "curl"), and confirming results filter live and tapping one adds it to the draft with the correct name.
- Opening the "ⓘ form" guide for a library-added exercise: confirm the body map lights up plausible muscles, the image is visible, tapping the image toggles between the two poses, and the instructions list renders.
- Opening the "ⓘ form" guide for a hand-authored built-in exercise (e.g. Bench Press): confirm it's completely unchanged from before this feature (setup/execution/breathing/mistakes text, no image).
- A custom exercise added via free-text (not the library) still has no "ⓘ form" badge at all.
- No horizontal scroll, no stale colors across a theme switch, 48px touch targets in the picker list.

- [ ] **Step 4: Record the outcome**

If all checks pass, this plan is complete. If a defect is found, fix it minimally and re-run Step 1 before re-checking.
