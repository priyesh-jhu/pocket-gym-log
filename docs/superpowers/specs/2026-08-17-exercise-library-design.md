# Exercise Library: Muscle Data, Images, and a Searchable Picker

## Problem

The app tracks sets/reps but gives the user almost no information about the
exercises themselves. Muscle-group data and a form-guide modal already exist,
but only for the ~30 hand-authored exercises baked into the fixed day
templates (`src/data/formGuide.js`). Custom exercises — anything the user
types in themselves — get no muscle data, no image, and no guide at all.
There is also no way to discover exercises beyond the fixed plan; a user who
wants a specific alternative has to know its exact name and type it in blind.

## Goals

1. A large (~800-exercise) searchable library the user can pick from when
   adding a custom exercise, instead of typing a free-text name.
2. Every library exercise carries muscle-group data compatible with the
   app's existing body-map visualization (`MuscleHeatmap.jsx` /
   `BodyMap` in `SessionScreen.jsx`).
3. Every library exercise has a visual demonstration (static start/end pose
   images — see "Media format" below).
4. None of this introduces a live network dependency at runtime — the app
   stays offline-first.

## Non-goals

- Replacing or re-authoring the existing 30 hand-authored `formGuide` entries
  (setup/execution/breathing/mistakes text). Those stay as-is; they're
  higher quality than anything the library provides.
- True animated GIFs. Evaluated and explicitly rejected — see "Alternatives
  considered."
- Letting a user swap a *built-in day-template* exercise for a library one.
  Scope is limited to the custom-exercise flow.
- Hand-curating muscle mapping for individual library exercises beyond the
  coarse category mapping described below.
- A standalone browsable "exercise library" screen/tab, independent of
  logging a workout. May be a future phase; not part of this design.

## Data source

**[free-exercise-db](https://github.com/yuhonas/free-exercise-db)** —
Unlicense (public domain), 800+ exercises, JSON with two static JPGs per
exercise (start/end pose).

### Alternatives considered

| Source | Why not |
|---|---|
| wger | Self-hosted OSS project is AGPL-3.0; individual exercise *data/images* are separately CC-BY-SA, requiring per-exercise attribution bookkeeping. Static images only (no GIFs), and its API is a live network call unless scraped/exported. More licensing overhead than free-exercise-db for the same static-image outcome. |
| ExerciseDB (exercisedb.dev / RapidAPI) | Has real animated GIFs (11,000+ exercises), but is API-first: RapidAPI free tier is 10 requests/day (unusable), paid tiers otherwise, and redistribution/bundling licensing for the media assets is unclear. Requires a live network call, conflicting with this app's offline-first architecture. Third-party "free GIF" wrapper services around this data are scrapes of uncertain licensing and longevity. |

**Decision:** free-exercise-db. Public domain, no attribution required, no
network dependency, no rate limits — at the cost of static images instead of
animated GIFs.

### Media format

Two static JPGs per exercise (start pose, end pose). Displayed with
tap-to-toggle between the two in the guide modal. Not a true animation, but
adequate for form reference, and keeps the feature entirely offline with
zero licensing risk.

## Design

### 1. Data layer

A one-time, manually-run script — `scripts/build-exercise-library.mjs` — not
part of the build or test pipeline (it makes network calls to fetch upstream
data). Running it:

1. Downloads free-exercise-db's `exercises.json` and the two pose images per
   exercise.
2. Trims each entry to the fields this app needs:
   `{id, name, primaryMuscles, secondaryMuscles, equipment, category, instructions, images}`.
3. Maps each muscle name through `src/data/muscleMap.js` (new file) onto this
   app's existing `MUSCLES` keys (from `formGuide.js`). Coarser upstream
   categories expand to multiple keys — e.g. `"shoulders"` →
   `["frontDelts","sideDelts","rearDelts"]` (all three light up together on
   the body map, since free-exercise-db doesn't distinguish them).
4. Drops any exercise whose muscles don't map to anything in `MUSCLES` (e.g.
   neck-only movements), logging a count of what was excluded.
5. Writes `src/data/exerciseLibrary.json` (trimmed metadata, committed to the
   repo) and `public/exercise-images/<id>/{0,1}.jpg` (served as static
   assets, lazy-loaded on demand — not bundled into the JS chunk).

The script is re-run only when the upstream dataset needs refreshing; its
output is what ships.

### 2. Custom exercise model

`src/customWorkouts.js` currently stores custom exercises as
`{id, name, target, tip}`. Extend the record with optional fields, populated
only when the exercise came from the library:

```js
{ id, name, target, tip, libraryId, primaryMuscles, secondaryMuscles }
```

- The existing "type a new exercise" flow (`createCustomExercise`) is
  unchanged — `libraryId`/muscle fields stay absent for typed-in exercises.
- A new `createCustomExerciseFromLibrary(prefs, libraryEntry)` copies name +
  mapped muscle keys + `libraryId` from a chosen library entry in one step,
  reusing the same duplicate-name collision check as `createCustomExercise`.
- `getCustomExercises` passes the new fields through unchanged. No change to
  how custom exercises persist or sync — they ride through the same
  prefs-backed local storage / Firebase sync path that exists today.

### 3. Picker UI

A new `LibraryPickerSheet` component, built on the app's existing `Sheet`
(same pattern as `SessionScreen.jsx`'s session sheets):

- A single text input filters the ~800 names client-side as you type
  (case-insensitive substring match — no fuzzy search needed at this size).
- Results render as a tappable list: name + a primary-muscle chip, using
  existing list/row styling conventions.
- Surfaced as a new entry point alongside today's "type a new exercise" and
  "pick a previously-saved exercise" options in the custom-exercise section
  (`App.jsx` / `SessionScreen.jsx`'s tools area) — additive, not a
  replacement for either existing path.
- Selecting a result calls `createCustomExerciseFromLibrary`, then adds it to
  the draft the same way `addSavedCustomExercise` does today.

### 4. Form-guide modal

Today, `formGuide[ex.name]` gates the "ⓘ form" badge in `SessionScreen.jsx` —
only hand-authored built-ins qualify. Extend the gate to:

```
formGuide[ex.name] OR the exercise record has a libraryId
```

- **Hand-authored exercises:** completely unchanged — same setup/execution
  /breathing/mistakes text, same body map, no image.
- **Library-sourced custom exercises:** the modal shows the body map (using
  the mapped muscle keys) plus the two pose images from
  `public/exercise-images/<libraryId>/`, tap-to-toggle between them, and the
  library's plain `instructions` array in place of the hand-authored
  setup/execution sections. No breathing/mistakes section — free-exercise-db
  doesn't have that granularity and it won't be fabricated.
- `BodyMap`'s existing `primary`/`secondary` props already accept multiple
  muscle keys, so no component change is needed to support the
  one-upstream-category-to-many-keys expansion — just pass the expanded
  arrays.

## Testing

- `scripts/build-exercise-library.mjs` itself is not covered by the
  automated suite (it makes network calls) — but its *output* is: a unit
  test asserts every entry in the committed `exerciseLibrary.json` resolves
  entirely to valid `MUSCLES` keys via `muscleMap.js`, catching drift if the
  script is re-run against an updated upstream dataset.
- `customWorkouts.js`: extend existing `createCustomExercise`/
  `getCustomExercises` tests to cover the new optional fields; add new tests
  for `createCustomExerciseFromLibrary` (name/muscle copy, `libraryId`
  round-trip, duplicate-name collision).
- `LibraryPickerSheet`: no component-level UI test, matching this project's
  existing convention (screens/components aren't unit-tested, only pure
  logic is). Covered by the same manual 360/390px + light/dark
  human-verification pass used in prior phases.
- Guide-modal fallback branch selection (hand-authored vs. library-sourced)
  gets a pure-function unit test alongside existing `formGuide`-adjacent
  tests.

## Open item carried forward, not in scope here

The user separately noted the app has no update-notification/prompt when a
new version is deployed (PWA service-worker update flow). This is an
unrelated concern and will be brainstormed as its own follow-up after this
feature ships.
