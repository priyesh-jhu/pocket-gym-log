# Home Engagement Rollout 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four Home-screen/session engagement features: a PR celebration toast, a week/month training summary card, a "last time you did this day" comparison (pre-session preview + post-save recap), and an exercise-history sparkline in the exercise picker.

**Architecture:** All four features read from data that already exists in `sessions` — no schema changes. Two new pure functions land in `src/stats.js` (`monthSummary`, `lastSameDaySummary`), mirroring the existing `weekSummary` shape. A new non-modal `Toast` component follows the project's existing `status-banner` visual pattern. `HomeScreen.jsx` gains a summary card and a same-day preview. `App.jsx`'s post-save workout-summary panel gains a same-day recap block. `sessions` gets threaded one level deeper (`App.jsx` → `SessionScreen` → `LibraryPickerSheet`) so a new `ExerciseSparkline` component can render per-row history using the existing `exerciseE1RMSeries` helper and `recharts` (already a dependency).

**Tech Stack:** React 19, Vite, `recharts` (already installed), Node's native test runner (`node --test src`), no test framework/mocking library.

**Spec:** `docs/superpowers/specs/2026-08-24-home-engagement-rollout1-design.md`

## Global Constraints

- No changes to the stored session/exercise/set data shape.
- New pure functions in `src/stats.js` follow the file's existing conventions: local-calendar-date math via `src/dateUtils.js` (never `toISOString()` for a training date), volume computed in lb internally, unit conversion only at the render layer.
- Tests are minimal and direct — one `describe`/`test` pair per behavior, no framework beyond `node:test` + `node:assert/strict`, matching `src/stats.test.js`'s existing style. Do not add a component-testing library.
- New UI components live in `src/components/`, each with its own co-located `ComponentName.css` that only references tokens from `src/design/tokens.css` (no ad hoc colors/hex values in component CSS).
- Any new chart must use `useThemeTokens()` (`src/charts/useThemeTokens.js`) for its colors, matching `ProgressScreen.jsx`'s existing `E1RMGroup` pattern — never hardcode chart colors.
- Run `npm test` and `npm run build` before every commit, per this project's established gate.

---

### Task 1: `monthSummary` and `lastSameDaySummary` in `src/stats.js`

**Files:**
- Modify: `src/stats.js` (add two new exported functions, after `weekVolumeDelta`, around line 122)
- Modify: `src/stats.test.js` (add test coverage; extend `mkSession` helper with an optional `day` param)

**Interfaces:**
- Consumes: `sessionVolume(session)`, `toLb(weight, unit)`, `todayISO()` from `src/dateUtils.js` — all already imported at the top of `src/stats.js`.
- Produces:
  - `monthSummary(sessions, todayIso = todayISO())` → `{ sessions: number, volume: number, prevVolume: number, deltaPct: number|null }` (current calendar month vs. the immediately preceding calendar month; `deltaPct` is `null` when `prevVolume` is 0).
  - `lastSameDaySummary(sessions, day, beforeDate)` → `null`, or `{ date: string, volume: number, exercises: [{ name: string, weight: number, unit: "lb"|"kg", reps: number }] }` — the most recent prior session where `session.day === day` and `session.date < beforeDate`, with each exercise's top set (heaviest set by lb) by name.

- [ ] **Step 1: Write the failing tests**

Add to `src/stats.test.js`. First, extend the existing `mkSession` helper (top of the file) to accept an optional `day`, defaulting to today's behavior so no existing test changes:

```js
function mkSession(date, exercises, day = "MON") { return { id: date, date, day, notes: "", exercises }; }
```

Add `monthSummary` and `lastSameDaySummary` to the existing import list from `"./stats.js"`, then add these `describe` blocks (place after the existing `describe("weekVolumeDelta", ...)` block):

```js
describe("monthSummary", () => {
  test("computes current-month sessions/volume and delta vs previous month", () => {
    const sessions = [
      mkSession("2026-07-15", [{ name: "A", sets: [mkSet("100", "10")] }]), // prev month: 1000 lb
      mkSession("2026-08-05", [{ name: "A", sets: [mkSet("110", "10")] }]), // current month
      mkSession("2026-08-20", [{ name: "A", sets: [mkSet("110", "10")] }]), // current month
    ];
    const result = monthSummary(sessions, "2026-08-24");
    assert.equal(result.sessions, 2);
    assert.equal(result.volume, 2200);
    assert.equal(result.prevVolume, 1000);
    assert.equal(result.deltaPct, 120);
  });

  test("deltaPct is null with no prior-month baseline", () => {
    const sessions = [mkSession("2026-08-05", [{ name: "A", sets: [mkSet("100", "10")] }])];
    const result = monthSummary(sessions, "2026-08-24");
    assert.equal(result.prevVolume, 0);
    assert.equal(result.deltaPct, null);
  });

  test("buckets correctly across a year boundary", () => {
    const sessions = [mkSession("2025-12-15", [{ name: "A", sets: [mkSet("100", "10")] }])];
    const result = monthSummary(sessions, "2026-01-10");
    assert.equal(result.prevVolume, 1000);
  });
});

describe("lastSameDaySummary", () => {
  test("finds the most recent prior session with a matching day and reports top sets", () => {
    const sessions = [
      mkSession("2026-08-01", [{ name: "Bench Press", sets: [mkSet("135", "8"), mkSet("155", "5")] }], "PUSH"),
      mkSession("2026-08-03", [{ name: "Squat", sets: [mkSet("200", "5")] }], "LEGS"),
      mkSession("2026-08-08", [{ name: "Bench Press", sets: [mkSet("145", "6")] }], "PUSH"),
    ];
    const result = lastSameDaySummary(sessions, "PUSH", "2026-08-15");
    assert.equal(result.date, "2026-08-08");
    assert.equal(result.exercises.length, 1);
    assert.deepEqual(result.exercises[0], { name: "Bench Press", weight: 145, unit: "lb", reps: 6 });
  });

  test("returns null when no prior session matches the day", () => {
    const sessions = [mkSession("2026-08-01", [{ name: "Squat", sets: [mkSet("200", "5")] }], "LEGS")];
    assert.equal(lastSameDaySummary(sessions, "PUSH", "2026-08-15"), null);
  });

  test("ignores sessions on or after beforeDate", () => {
    const sessions = [mkSession("2026-08-15", [{ name: "Bench Press", sets: [mkSet("135", "8")] }], "PUSH")];
    assert.equal(lastSameDaySummary(sessions, "PUSH", "2026-08-15"), null);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -A5 "monthSummary\|lastSameDaySummary"`
Expected: FAIL — `monthSummary is not defined` / `lastSameDaySummary is not defined`.

- [ ] **Step 3: Implement `monthSummary` and `lastSameDaySummary`**

Add to `src/stats.js`, directly after `weekVolumeDelta` (after line 122):

```js
function monthKey(iso) { return iso.slice(0, 7); }

function prevMonthKey(iso) {
  const [year, month] = iso.slice(0, 7).split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Current calendar month vs the immediately preceding one. deltaPct is null if prevVolume is 0. */
export function monthSummary(sessions, todayIso = todayISO()) {
  const list = Array.isArray(sessions) ? sessions : [];
  const currentKey = monthKey(todayIso);
  const prevKey = prevMonthKey(todayIso);
  let sessionsCount = 0, volume = 0, prevVolume = 0;
  for (const s of list) {
    if (!s?.date) continue;
    const key = monthKey(s.date);
    if (key === currentKey) {
      sessionsCount += 1;
      volume += sessionVolume(s);
    } else if (key === prevKey) {
      prevVolume += sessionVolume(s);
    }
  }
  const deltaPct = prevVolume > 0 ? Math.round(((volume - prevVolume) / prevVolume) * 100) : null;
  return { sessions: sessionsCount, volume, prevVolume, deltaPct };
}

/** The most recent prior session sharing `day`, strictly before `beforeDate`, with each exercise's top set. */
export function lastSameDaySummary(sessions, day, beforeDate) {
  const list = Array.isArray(sessions) ? sessions : [];
  let match = null;
  for (const session of list) {
    if (!session?.date || session.day !== day || session.date >= beforeDate) continue;
    if (!match || session.date > match.date) match = session;
  }
  if (!match) return null;

  const exercises = (Array.isArray(match.exercises) ? match.exercises : []).map(exercise => {
    let best = null;
    for (const set of Array.isArray(exercise?.sets) ? exercise.sets : []) {
      const weightLb = toLb(set?.weight, set?.unit);
      if (weightLb <= 0) continue;
      if (!best || weightLb > best.weightLb) {
        best = { weightLb, weight: Number(set.weight), unit: set.unit === "kg" ? "kg" : "lb", reps: Number(set.reps) || 0 };
      }
    }
    return best ? { name: exercise.name, weight: best.weight, unit: best.unit, reps: best.reps } : null;
  }).filter(Boolean);

  return { date: match.date, volume: Math.round(sessionVolume(match)), exercises };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# pass <N>` with `# fail 0` (N is the total across the whole suite, since `node --test src` runs everything).

- [ ] **Step 5: Commit**

```bash
git add src/stats.js src/stats.test.js
git commit -m "Add monthSummary and lastSameDaySummary stats helpers"
```

---

### Task 2: PR celebration toast

**Files:**
- Create: `src/components/Toast.jsx`
- Create: `src/components/Toast.css`
- Modify: `src/components/index.js` (export `Toast`)
- Modify: `src/App.jsx` (add `toastPRs` state, set it in `saveSession()`, render `<Toast>`)

**Interfaces:**
- Consumes: `createWorkoutSummary(...)`'s existing `prs` field (`{ name, weight, unit, reps }[]`) — already computed in `saveSession()` (`src/App.jsx:618`).
- Produces: `Toast({ open, onClose, children })` — a reusable, non-modal, auto-dismissing notification component other features can reuse later.

- [ ] **Step 1: Create the `Toast` component**

`src/components/Toast.jsx`:

```jsx
import { useEffect } from "react";
import "./Toast.css";

export default function Toast({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="m3-toast" role="status" onClick={onClose}>
      {children}
    </div>
  );
}
```

`src/components/Toast.css`:

```css
.m3-toast {
  position: fixed;
  top: var(--sp4);
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  max-width: min(92vw, 420px);
  background: color-mix(in srgb, var(--success) 16%, var(--surface-container-high));
  border: 1px solid color-mix(in srgb, var(--success) 30%, transparent);
  color: var(--on-surface);
  border-radius: var(--shape-lg);
  padding: var(--sp3) var(--sp4);
  font-size: var(--text-body-sm);
  line-height: 1.5;
  box-shadow: var(--elev-2);
  cursor: pointer;
  animation: m3-toast-in var(--dur-med) var(--ease-emph);
}

@keyframes m3-toast-in {
  from { opacity: 0; transform: translate(-50%, -8px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
```

Add the export to `src/components/index.js` (after the `StatTile` line):

```js
export { default as Toast } from "./Toast.jsx";
```

- [ ] **Step 2: Wire the toast into `saveSession()`**

In `src/App.jsx`, add `Toast` to the existing components import (line 22):

```js
import { AppBar, Button, NavBar, Toast } from "./components/index.js";
```

Add state near the existing `workoutSummary` state (line 116):

```js
const [workoutSummary, setWorkoutSummary] = useState(null);
const [toastPRs, setToastPRs] = useState(null);
```

In `saveSession()` (`src/App.jsx:613`), replace this line:

```js
    setWorkoutSummary(createWorkoutSummary(saved, sessions, completedAt));
```

with:

```js
    const summary = createWorkoutSummary(saved, sessions, completedAt);
    setWorkoutSummary(summary);
    setToastPRs(summary.prs.length > 0 ? summary.prs : null);
```

- [ ] **Step 3: Render the toast**

In `src/App.jsx`, directly above the existing status-banner block (line 887-888), add:

```jsx
        <Toast open={!!toastPRs} onClose={() => setToastPRs(null)}>
          {toastPRs && `🏆 New PR${toastPRs.length !== 1 ? "s" : ""}: ${toastPRs.map(pr => `${pr.name} ${pr.weight}${pr.unit} × ${pr.reps}`).join(" · ")}`}
        </Toast>

        {/* Status banners */}
```

- [ ] **Step 4: Verify manually**

Run: `npm run build`
Expected: build succeeds with no errors.

Then run `npm run dev`, complete and save a workout with a set heavier than any prior set for that exercise (or, on a fresh profile, any completed set — first-ever sets count as PRs since there's no prior data), and confirm:
- The toast appears at the top of the screen listing the new PR(s), and auto-dismisses after ~4 seconds (or dismisses immediately on tap).
- Saving a workout with no new PRs shows no toast.
- The existing `workout-summary__prs` line in the summary panel still renders unchanged (this task adds the toast; it does not remove the existing recap line).

- [ ] **Step 5: Commit**

```bash
git add src/components/Toast.jsx src/components/Toast.css src/components/index.js src/App.jsx
git commit -m "Add PR celebration toast on session save"
```

---

### Task 3: Week/month summary card and same-day preview on Home

**Files:**
- Modify: `src/screens/HomeScreen.jsx`
- Modify: `src/screens/HomeScreen.css`

**Interfaces:**
- Consumes: `monthSummary(sessions, todayIso)` and `lastSameDaySummary(sessions, day, beforeDate)` from Task 1 (`src/stats.js`); `weekVolumeDelta`, `dominantUnit`, `todayISO` (from `src/dateUtils.js`) already imported/available in this file; `SegmentedButtons` from `src/components/index.js`.
- Produces: no new exports — this task only changes `HomeScreen.jsx`'s rendered output. `dayMeta.day` (already passed into `HomeScreen` as part of `dayMeta`) is read here; confirm this field's exact name in Step 1 before using it (see note below).

- [ ] **Step 1: Pass `currentDay` into `HomeScreen`**

`src/App.jsx:841` sets `const dayMeta = dayTemplates[currentDay];` — `dayMeta` is the resolved *display* template, while `currentDay` is the day *key* (e.g. `"PUSH"`) that stored sessions record as `session.day`. `HomeScreen` currently only receives `dayMeta`, not `currentDay`, so `lastSameDaySummary` (which needs the key, not the label) has nothing to compare against. Modify the `<HomeScreen>` call site in `src/App.jsx` (around line 933) to add one more prop:

```jsx
          <HomeScreen
            sessions={sessions}
            dayMeta={dayMeta}
            currentDay={currentDay}
            displayName={firebaseUser?.displayName}
            hasDraft={draftHasContent(draft)}
            draftSavedAt={draftSavedAt}
            onStart={startSession}
            onProgress={() => switchTab("progress")}
          />
```

- [ ] **Step 2: Add the week/month summary toggle**

In `src/screens/HomeScreen.jsx`, update imports:

```js
import { Button, Card, Chip, SegmentedButtons, StatTile } from "../components/index.js";
import { currentStreak, dominantUnit, lastSameDaySummary, monthSummary, muscleFreshness, personalRecords, weekVolumeDelta } from "../stats.js";
import { todayISO } from "../dateUtils.js";
import { useState } from "react";
```

Update the function signature to accept `currentDay`:

```js
export default function HomeScreen({ sessions, dayMeta, currentDay, displayName, hasDraft, draftSavedAt, onStart, onProgress }) {
```

Inside the component, after the existing `const week = weekVolumeDelta(sessions);` line, add:

```js
  const [range, setRange] = useState("week");
  const month = monthSummary(sessions);
  const activeSummary = range === "week" ? week : month;
  const activeLabel = range === "week" ? "week" : "month";
  const activeDelta = activeSummary.deltaPct === null
    ? "No prior-period baseline"
    : `${activeSummary.deltaPct >= 0 ? "+" : ""}${activeSummary.deltaPct}% volume vs last ${activeLabel}`;
  const sameDay = lastSameDaySummary(sessions, currentDay, todayISO());
```

Replace the existing hero card block:

```jsx
      <Card variant="raised" className="home-hero">
        <p>This week's volume</p>
        <strong>{displayVolume(week.volume, unit)}</strong><span>{unit}</span>
        <Chip>{delta}</Chip>
      </Card>
```

with:

```jsx
      <Card variant="raised" className="home-hero">
        <div className="home-hero__head">
          <p>You trained {activeSummary.sessions}× this {activeLabel}</p>
          <SegmentedButtons
            ariaLabel="Summary range"
            options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }]}
            value={range}
            onChange={setRange}
          />
        </div>
        <strong>{displayVolume(activeSummary.volume, unit)}</strong><span>{unit}</span>
        <Chip>{activeDelta}</Chip>
      </Card>
```

(This removes the now-unused `delta` local variable from the original code — leave the `week` variable itself in place, since it still feeds `range === "week"`.)

- [ ] **Step 3: Add the same-day preview to "Today's plan"**

In the existing "Today's plan" card, after the `<Button ...>{hasDraft ? "Resume workout" : "Start workout"}</Button>` line, add:

```jsx
        {sameDay && <small className="home-plan__lastday">Last {dayMeta.label} day ({sameDay.date}): {displayVolume(sameDay.volume, unit)} {unit} total</small>}
```

- [ ] **Step 4: Add supporting CSS**

In `src/screens/HomeScreen.css`, add:

```css
.home-hero__head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp2); margin-bottom: var(--sp1); }
.home-plan__lastday { display: block; margin-top: var(--sp2); color: var(--on-surface-dim); font-size: var(--text-label-sm); }
```

- [ ] **Step 5: Verify manually**

Run: `npm run build`
Expected: build succeeds.

Run `npm run dev`, open Home, and confirm:
- The hero card shows "You trained N× this week" with a Week/Month toggle; switching to Month recomputes the headline and delta using the current calendar month.
- With no prior-week (or prior-month) data, the delta line reads "No prior-period baseline" instead of a bogus percentage.
- If a prior session shares today's day-type, "Today's plan" shows a "Last {Day} day (...)" line; on a profile with no such history, that line is simply absent.

- [ ] **Step 6: Commit**

```bash
git add src/screens/HomeScreen.jsx src/screens/HomeScreen.css src/App.jsx
git commit -m "Add week/month summary toggle and same-day preview to Home"
```

---

### Task 4: Same-day-type comparison in the post-save recap

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `lastSameDaySummary(sessions, day, beforeDate)` from Task 1; `sessions` (pre-save array, already in scope inside `saveSession()`); `saved` (the just-saved session object, already in scope).

**Note:** the per-exercise weight deltas need each *current* exercise's top set, which `workoutSummary` does not carry (it only stores aggregate counts) — so `saved.exercises` (available in `saveSession()`'s closure) is used to compute those top sets directly, stored alongside the prior-day data.

- [ ] **Step 1: Import `lastSameDaySummary` and `toLb`**

`src/App.jsx` does not currently import from `src/stats.js` at all. Add this new import line near the other local imports (e.g. next to the `createWorkoutSummary` import at line 13):

```js
import { lastSameDaySummary, toLb } from "./stats.js";
```

- [ ] **Step 2: Compute and store the comparison at save time**

In `saveSession()` (`src/App.jsx:613`), add a `sameDayCompare` state near `toastPRs`:

```js
const [sameDayCompare, setSameDayCompare] = useState(null);
```

In `saveSession()`, after the `const summary = createWorkoutSummary(saved, sessions, completedAt);` line (added in Task 2), add:

```js
    const priorSameDay = lastSameDaySummary(sessions, saved.day, saved.date);
    if (priorSameDay) {
      const currentTopSets = saved.exercises.map(exercise => {
        let best = null;
        for (const set of exercise.sets) {
          const weightLb = toLb(set.weight, set.unit);
          if (weightLb <= 0) continue;
          if (!best || weightLb > best.weightLb) best = { weightLb, weight: Number(set.weight), unit: set.unit === "kg" ? "kg" : "lb" };
        }
        return best ? { name: exercise.name, weight: best.weight, unit: best.unit, weightLb: best.weightLb } : null;
      }).filter(Boolean);
      setSameDayCompare({ priorSameDay, volumeLb: summary.volumeLb, currentTopSets });
    } else {
      setSameDayCompare(null);
    }
```

- [ ] **Step 3: Render the comparison in the summary panel**

In `src/App.jsx`, inside the `{workoutSummary && (...)}` block, directly after the existing `workoutSummary.improvements` line (line 902), add:

```jsx
            {sameDayCompare && (() => {
              const { priorSameDay, volumeLb, currentTopSets } = sameDayCompare;
              const volumeDeltaPct = priorSameDay.volume > 0 ? Math.round(((volumeLb - priorSameDay.volume) / priorSameDay.volume) * 100) : null;
              const priorByName = new Map(priorSameDay.exercises.map(ex => [ex.name, ex]));
              const exerciseDeltas = currentTopSets
                .filter(current => priorByName.has(current.name))
                .map(current => {
                  const prior = priorByName.get(current.name);
                  const priorLb = toLb(String(prior.weight), prior.unit);
                  const deltaLb = Math.round((current.weightLb - priorLb) * 10) / 10;
                  return { name: current.name, deltaLb };
                })
                .filter(item => Math.abs(item.deltaLb) >= 0.1);
              return (
                <div className="workout-summary__sameday">
                  vs last {dayTemplates[workoutSummary.day]?.label || workoutSummary.day} day ({priorSameDay.date}):{" "}
                  {volumeDeltaPct === null ? "no prior volume to compare" : `volume ${volumeDeltaPct >= 0 ? "up" : "down"} ${Math.abs(volumeDeltaPct)}%`}
                  {exerciseDeltas.length > 0 && " · " + exerciseDeltas.map(item => `${item.name} ${item.deltaLb >= 0 ? "+" : ""}${item.deltaLb}lb`).join(" · ")}
                </div>
              );
            })()}
```

- [ ] **Step 4: Add supporting CSS**

In `src/index.css`, directly after the existing `.workout-summary__improvements` rule, add:

```css
.workout-summary__sameday { font-size: var(--text-label-sm); color: var(--on-surface-variant); line-height: 1.55; margin-top: var(--sp2); }
```

- [ ] **Step 5: Verify manually**

Run: `npm run build`
Expected: build succeeds.

Run `npm run dev`, save two workouts on the same day-type on different dates (e.g. two "PUSH" days), and confirm the second save's summary panel shows a "vs last {Day} day (...)" line with a volume delta and, where the same exercise appears in both, a per-exercise weight delta. Saving the very first workout of a given day-type should show no such line (state resets to `null`).

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/index.css
git commit -m "Add same-day-type comparison to post-save workout recap"
```

---

### Task 5: Exercise-history sparkline in the picker

**Files:**
- Create: `src/components/ExerciseSparkline.jsx`
- Modify: `src/components/index.js` (export `ExerciseSparkline`)
- Modify: `src/components/LibraryPickerSheet.jsx` (accept `sessions`, render sparkline per row)
- Modify: `src/components/LibraryPickerSheet.css` (row layout for the sparkline)
- Modify: `src/screens/SessionScreen.jsx` (accept and forward `sessions`)
- Modify: `src/App.jsx` (pass `sessions` into `<SessionScreen>`)

**Interfaces:**
- Consumes: `exerciseE1RMSeries(sessions, name)` from `src/stats.js` (existing export); `useThemeTokens()` from `src/charts/useThemeTokens.js` (existing export).
- Produces: `ExerciseSparkline({ series })` — renders `null` if `series.length < 2`, otherwise a small `recharts` line chart. Reusable by any future per-exercise view.

- [ ] **Step 1: Create `ExerciseSparkline`**

`src/components/ExerciseSparkline.jsx`:

```jsx
import { LineChart, Line, ResponsiveContainer } from "recharts";
import useThemeTokens from "../charts/useThemeTokens.js";

export default function ExerciseSparkline({ series }) {
  const chartTheme = useThemeTokens();
  if (!Array.isArray(series) || series.length < 2) return null;

  return (
    <div className="m3-sparkline" role="img" aria-label="Estimated one-rep max trend">
      <ResponsiveContainer width={60} height={24}>
        <LineChart data={series} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line type="monotone" dataKey="value" stroke={chartTheme.primary} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

Add a small CSS file, `src/components/ExerciseSparkline.css`:

```css
.m3-sparkline { width: 60px; height: 24px; flex-shrink: 0; }
```

Import it in `ExerciseSparkline.jsx` (add `import "./ExerciseSparkline.css";` at the top).

Add the export to `src/components/index.js`:

```js
export { default as ExerciseSparkline } from "./ExerciseSparkline.jsx";
```

- [ ] **Step 2: Thread `sessions` into `LibraryPickerSheet`**

In `src/screens/SessionScreen.jsx`, add `sessions` to the destructured props (line 102-123) — insert it next to the existing `prMap, getLastTime, copyLastTime, progressionIncrements,` line:

```js
  prMap, getLastTime, copyLastTime, progressionIncrements, sessions,
```

In the same file, update the `<LibraryPickerSheet>` usage (around line 418) to forward it:

```jsx
      <LibraryPickerSheet
        open={sessionSheet === "library"}
        onClose={() => setSessionSheet(null)}
        onSelect={entry => { addLibraryExercise(entry); setSessionSheet(null); }}
        sessions={sessions}
      />
```

In `src/App.jsx`, add `sessions` to the `<SessionScreen>` call site (around line 946-967) — it's already in scope as the top-level `sessions` state, so just add the prop:

```jsx
          <SessionScreen
            draft={draft} setDraft={setDraft} dayMeta={dayMeta} currentDay={currentDay} switchDay={switchDay}
            sessions={sessions}
            ...
```

(Insert `sessions={sessions}` on its own line right after the first line of the existing multi-line prop list; do not reformat the rest of the existing props.)

- [ ] **Step 3: Render the sparkline in the picker rows**

In `src/components/LibraryPickerSheet.jsx`, update imports:

```js
import { Chip, ExerciseSparkline, ListItem, Sheet, TextField } from "./index.js";
import { exerciseE1RMSeries } from "../stats.js";
```

Update the function signature:

```js
export default function LibraryPickerSheet({ open, onClose, onSelect, sessions }) {
```

Update the row rendering (inside `results.map(item => ...)`, currently a `ListItem` with a `trailing` `Chip`) to add the sparkline alongside the trailing chip:

```jsx
            {results.map(item => (
              <button key={item.id} type="button" className="library-picker__row" onClick={() => onSelect(item)}>
                <ListItem
                  title={item.name}
                  subtitle={item.equipment || undefined}
                  trailing={
                    <div className="library-picker__trailing">
                      <ExerciseSparkline series={exerciseE1RMSeries(sessions, item.name)} />
                      <Chip>{MUSCLES[item.primaryMuscles[0]] || item.primaryMuscles[0]}</Chip>
                    </div>
                  }
                />
              </button>
            ))}
```

- [ ] **Step 4: Add supporting CSS**

In `src/components/LibraryPickerSheet.css`, add:

```css
.library-picker__trailing { display: flex; align-items: center; gap: var(--sp2); }
```

- [ ] **Step 5: Verify manually**

Run: `npm run build`
Expected: build succeeds.

Run `npm run dev`, log at least two sessions containing the same exercise with different weights (so `exerciseE1RMSeries` has ≥2 points for that name), then open the exercise library picker and confirm:
- That exercise's row shows a small trend line next to its muscle-group chip.
- An exercise with 0 or 1 prior logged instance shows its row unchanged, with no sparkline and no layout gap/shift.

- [ ] **Step 6: Commit**

```bash
git add src/components/ExerciseSparkline.jsx src/components/ExerciseSparkline.css src/components/index.js src/components/LibraryPickerSheet.jsx src/components/LibraryPickerSheet.css src/screens/SessionScreen.jsx src/App.jsx
git commit -m "Add exercise-history sparkline to the library picker"
```

---

## Final Verification

After all five tasks:

- [ ] Run `npm test` — full suite passes.
- [ ] Run `npm run build` — succeeds with no errors.
- [ ] Run `npm run lint` — no new warnings/errors introduced by this rollout's files.
- [ ] Manually walk through, in one `npm run dev` session: start a workout, confirm the same-day preview and sparklines render as expected, complete it with at least one new PR, confirm the toast, the PR recap line, and the same-day recap all appear correctly, then check Home's week/month toggle reflects the just-saved session.
- [ ] Bump version (`npm version patch --no-git-tag-version`), rebuild, commit, `firebase deploy --only hosting`, `git push` — per this project's established release process.
