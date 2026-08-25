# Home Engagement Rollout 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface "days since last trained" for the most-overdue muscles directly on Home, and add a deload-week reminder when overall training volume has climbed for 4 weeks straight with no lighter week.

**Architecture:** Both pieces reuse existing `src/stats.js` helpers (`musclePriorities`, `muscleSetVolume`, `weeklyVolume`) with no changes to that file. A new, small, single-purpose file (`src/deloadInsight.js`) computes the deload signal, mirroring the existing pattern of `trainingInsights.js`/`rpeInsights.js` each owning one insight type. `HomeScreen.jsx` gains one new line under its existing "Muscle freshness" section and one new insight card, both reusing components/CSS classes already on that screen — no new visual patterns.

**Tech Stack:** React 19, Node's native test runner (`node --test src`), no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-25-home-engagement-rollout4-design.md`

## Global Constraints

- No changes to `src/stats.js`, the Progress dashboard's Body heatmap card, its targets, or its Customize settings.
- New UI must reuse existing components/CSS classes already on `HomeScreen.jsx` (`Chip`, `.home-insight`) — no new visual patterns, per the user's explicit "must look sleek everywhere" requirement.
- New pure-function tests follow this project's minimal-test convention (a handful of direct `node:test` cases, no exhaustive matrices).
- Run `npm test` and `npm run build` before every commit.

---

### Task 1: Deload reminder

**Files:**
- Create: `src/deloadInsight.js`
- Create: `src/deloadInsight.test.js`

**Interfaces:**
- Consumes: `weeklyVolume(sessions, weeks, todayIso)` from `src/stats.js` (existing export — zero-filled, oldest-first buckets, always exactly `weeks` entries, `{weekStart, label, volume, sessions}`); `todayISO()` from `src/dateUtils.js` (existing export).
- Produces: `deloadReminder(sessions, todayIso = todayISO())` → `null`, or `{ type: "deload-week", weeks: [{weekStart, volume}], action, message }`.

- [ ] **Step 1: Write the failing tests**

Create `src/deloadInsight.test.js`:
```js
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { deloadReminder } from "./deloadInsight.js";

function mkSet(weight, reps) { return { weight, reps, unit: "lb" }; }
function mkSession(date, weight, reps) { return { date, day: "MON", exercises: [{ name: "Squat", sets: [mkSet(weight, reps)] }] }; }

// "2026-08-25" is a Tuesday in the week starting Monday 2026-08-24, which
// stays the CURRENT (excluded, possibly-partial) week throughout these
// tests. The 4 completed weeks checked are 2026-07-27, 2026-08-03,
// 2026-08-10, 2026-08-17 (oldest to newest).
const TODAY = "2026-08-25";

describe("deloadReminder", () => {
  test("flags 4 weeks of rising volume with no down week", () => {
    const sessions = [
      mkSession("2026-07-28", "100", "5"), // week of 07-27: 500
      mkSession("2026-08-04", "100", "6"), // week of 08-03: 600
      mkSession("2026-08-11", "100", "7"), // week of 08-10: 700
      mkSession("2026-08-18", "100", "8"), // week of 08-17: 800
    ];
    const result = deloadReminder(sessions, TODAY);
    assert.equal(result.type, "deload-week");
    assert.equal(result.weeks.length, 4);
    assert.deepEqual(result.weeks.map(w => w.volume), [500, 600, 700, 800]);
  });

  test("flat volume across 4 weeks still counts as \"held\" and flags", () => {
    const sessions = [
      mkSession("2026-07-28", "100", "5"),
      mkSession("2026-08-04", "100", "5"),
      mkSession("2026-08-11", "100", "5"),
      mkSession("2026-08-18", "100", "5"),
    ];
    assert.notEqual(deloadReminder(sessions, TODAY), null);
  });

  test("a down week clears the flag", () => {
    const sessions = [
      mkSession("2026-07-28", "100", "5"), // 500
      mkSession("2026-08-04", "100", "6"), // 600
      mkSession("2026-08-11", "100", "4"), // 400 -- drop vs previous week
      mkSession("2026-08-18", "100", "8"), // 800
    ];
    assert.equal(deloadReminder(sessions, TODAY), null);
  });

  test("returns null when any of the 4 completed weeks has no volume", () => {
    const sessions = [
      mkSession("2026-08-11", "100", "7"), // week of 08-10 only
      mkSession("2026-08-18", "100", "8"), // week of 08-17 only
    ];
    assert.equal(deloadReminder(sessions, TODAY), null);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -A3 "deloadReminder"`
Expected: FAIL — `Cannot find module './deloadInsight.js'`.

- [ ] **Step 3: Implement `src/deloadInsight.js`**

```js
// ─── DELOAD INSIGHT ─────────────────────────────────────────────────────────────
// A separate signal from trainingInsights.js (per-exercise stall/decline) and
// rpeInsights.js (per-exercise grinding): this one looks at whole-program
// weekly volume, not any single exercise.
import { weeklyVolume } from "./stats.js";
import { todayISO } from "./dateUtils.js";

/**
 * Flags a sustained volume ramp with no lighter week: the 4 most recent
 * FULLY COMPLETED weeks (the current, possibly-partial week is excluded)
 * each had volume greater than or equal to the previous week in that
 * 4-week span, and none of the 4 weeks had zero volume.
 */
export function deloadReminder(sessions, todayIso = todayISO()) {
  const weeks = weeklyVolume(sessions, 5, todayIso);
  const completed = weeks.slice(0, 4);
  if (completed.some(week => week.volume <= 0)) return null;
  const rising = completed.every((week, index) => index === 0 || week.volume >= completed[index - 1].volume);
  if (!rising) return null;
  return {
    type: "deload-week",
    weeks: completed.map(week => ({ weekStart: week.weekStart, volume: week.volume })),
    action: "Take one week at ~40-50% less volume.",
    message: "Volume's climbed for 4 weeks straight with no lighter week. Consider a deload week.",
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add src/deloadInsight.js src/deloadInsight.test.js
git commit -m "Add deload-week reminder based on 4-week volume trend"
```

---

### Task 2: Surface "overdue muscles" and the deload reminder on Home

**Files:**
- Modify: `src/screens/HomeScreen.jsx`
- Modify: `src/screens/HomeScreen.css`

**Interfaces:**
- Consumes: `musclePriorities(setVolume, targets, plannedDays, todayIso)` and `muscleSetVolume(sessions, days, todayIso)` from `src/stats.js` (existing exports — `musclePriorities` returns, per muscle, `{muscle, done, target, remaining, pct, lastTrained, daysSince}`, `daysSince` is `null` if never trained); `MUSCLES` from `src/data/formGuide.js` (existing export, `{muscleKey: "Friendly Label"}`); `deloadReminder(sessions, todayIso)` from `src/deloadInsight.js` (Task 1).

- [ ] **Step 1: Compute the overdue-muscles list and the deload reminder**

In `src/screens/HomeScreen.jsx`, update imports:
```js
import { currentStreak, dominantUnit, lastSameDaySummary, monthSummary, muscleFreshness, muscleSetVolume, musclePriorities, personalRecords, weekVolumeDelta } from "../stats.js";
import { MUSCLES } from "../data/formGuide.js";
import { deloadReminder } from "../deloadInsight.js";
```
Add, near the existing `const freshness = muscleFreshness(sessions);` line:
```js
  const overdue = musclePriorities(muscleSetVolume(sessions, 7))
    .filter(item => item.daysSince !== null && item.daysSince >= 4)
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 2);
  const deload = deloadReminder(sessions);
```

- [ ] **Step 2: Render the overdue chips under the Muscle freshness heatmap**

Find the existing heatmap block:
```jsx
      <button type="button" className="home-heatmap" onClick={onProgress}>
        <div className="home-section-title"><div><h3>Muscle freshness</h3><p>Volt areas are ready to train</p></div><ArrowRight size={19} /></div>
        <MuscleHeatmap scores={freshness} mode="freshness" height={172} />
      </button>
```
Add the overdue-chip row inside the same button, after the heatmap, rendered only when exactly 2 muscles qualify:
```jsx
      <button type="button" className="home-heatmap" onClick={onProgress}>
        <div className="home-section-title"><div><h3>Muscle freshness</h3><p>Volt areas are ready to train</p></div><ArrowRight size={19} /></div>
        <MuscleHeatmap scores={freshness} mode="freshness" height={172} />
        {overdue.length === 2 && (
          <div className="home-heatmap__overdue">
            <span>Overdue:</span>
            {overdue.map(item => <Chip key={item.muscle}>{MUSCLES[item.muscle] || item.muscle} ({item.daysSince}d)</Chip>)}
          </div>
        )}
      </button>
```

- [ ] **Step 3: Add supporting CSS**

In `src/screens/HomeScreen.css`, add, near the existing `.home-heatmap`/`.home-section-title` rules:
```css
.home-heatmap__overdue { display: flex; align-items: center; flex-wrap: wrap; gap: var(--sp2); margin-top: var(--sp3); }
.home-heatmap__overdue span:first-child { color: var(--on-surface-variant); font-size: var(--text-body-sm); }
```

- [ ] **Step 4: Render the deload reminder card**

Directly after the existing "Effort check" card:
```jsx
      {insight && <Card className="home-insight"><p>Training insight</p><strong>{insight.name}</strong><span>{insight.message}</span></Card>}
      {grinding && <Card className="home-insight"><p>Effort check</p><strong>{grinding.name}</strong><span>{grinding.message}</span></Card>}
```
add a fourth insight card, reusing the same `.home-insight` class, with no `strong` exercise-name line (this insight is program-wide, not per-exercise):
```jsx
      {insight && <Card className="home-insight"><p>Training insight</p><strong>{insight.name}</strong><span>{insight.message}</span></Card>}
      {grinding && <Card className="home-insight"><p>Effort check</p><strong>{grinding.name}</strong><span>{grinding.message}</span></Card>}
      {deload && <Card className="home-insight"><p>Recovery signal</p><span>{deload.message}</span></Card>}
```

- [ ] **Step 5: Verify manually**

Run: `npm run build`
Expected: build succeeds.

Run `npm run dev`, and confirm:
- On a profile with at least 2 muscles untrained for 4+ days, the "Muscle freshness" section shows an "Overdue: {Muscle} ({N}d) · {Muscle} ({N}d)" chip row beneath the heatmap, styled consistently with the rest of the screen (same chip look as the streak badge/week-delta pill).
- On a profile with 0 or 1 overdue muscle, that row doesn't render at all.
- Log 4 consecutive weeks of rising or flat volume (with no lighter week) and confirm a "Recovery signal" card appears, styled identically to the existing "Training insight"/"Effort check" cards.
- Confirm the whole Home screen still reads as one coherent, uncluttered design — no new visual style was introduced by this task.

- [ ] **Step 6: Commit**

```bash
git add src/screens/HomeScreen.jsx src/screens/HomeScreen.css
git commit -m "Surface overdue muscles and a deload reminder on Home"
```

---

## Final Verification

After both tasks:

- [ ] Run `npm test` — full suite passes.
- [ ] Run `npm run build` — succeeds with no errors.
- [ ] Run `npm run lint` — no new warnings/errors introduced by this rollout's files.
- [ ] Manually walk through, in one `npm run dev` session: confirm the overdue-muscle chips and deload card render correctly (or stay absent) against real logged data, and that Home's overall visual density/style is unchanged from before this rollout.
- [ ] Bump version (`npm version minor --no-git-tag-version` — new feature, not a bug fix), rebuild, commit, `firebase deploy --only hosting`, `git push` — per this project's established release process.
