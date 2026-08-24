# Home Engagement Rollout 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a "Strength levels" Progress-dashboard card showing the big 3 lifts (bench/squat/deadlift) as current estimated 1RM, ratio to bodyweight, and a strength-standard tier, plus the sex-selection setting the tier lookup needs.

**Architecture:** A new pure-function module (`src/strengthStandards.js`) holds the exercise-name fallback chains, the standards thresholds table, and the sex-preference getter/setter — all operating on data that already exists (`exerciseE1RMSeries` for e1RM, `bodyweights` for bodyweight, the shared `equipmentPrefs` blob for the sex setting). A new dashboard group (`StrengthGroup`) plugs into the Progress screen's existing extensible group system exactly like `E1RMGroup`/`BalanceGroup` do today. A small Settings addition lets the user pick which standards table applies to them.

**Tech Stack:** React 19, Node's native test runner (`node --test src`), no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-24-home-engagement-rollout2-design.md`

## Global Constraints

- No changes to how bodyweight or session/exercise/set data is stored.
- New pure functions/tests follow this project's existing minimal-test convention (a handful of direct `node:test` cases, no exhaustive matrices).
- The new Progress dashboard group must reuse the existing `PROGRESS_GROUP_IDS`/`hiddenCards`/`cardOrder` system in `src/progressDashboardSettings.js` rather than introducing a separate show/hide mechanism.
- All new UI reuses existing CSS classes/tokens where an equivalent already exists in `src/screens/ProgressScreen.css` (e.g. `.progress-eyebrow`, `.progress-section-heading`, `.progress-chart-empty`) rather than redefining them.
- Run `npm test` and `npm run build` before every commit.

---

### Task 1: `src/strengthStandards.js` — fallback chains, standards table, sex preference, summary function

**Files:**
- Create: `src/strengthStandards.js`
- Create: `src/strengthStandards.test.js`

**Interfaces:**
- Consumes: `exerciseE1RMSeries(sessions, name)` from `src/stats.js` (existing export, returns oldest-first `{date, value}` in lb).
- Produces:
  - `LIFT_VARIANTS` — `{ bench: string[], squat: string[], deadlift: string[] }`, each array ordered canonical-name-first.
  - `STANDARDS` — `{ male: {...}, female: {...} }`, each `{ bench, squat, deadlift }`, each `{ novice, intermediate, advanced, elite }` (bodyweight-ratio numbers).
  - `getStandardsSex(prefs)` → `"male" | "female" | null`.
  - `setStandardsSex(prefs, sex)` → new prefs object with `__standardsSex` set to `"male"` or `"female"` (any other input normalizes to `"male"`, matching the existing `equipmentPrefs.js` normalize-on-write convention).
  - `bigLiftSummary(sessions, bodyweightLb, sex)` → `Array<{ lift: "bench"|"squat"|"deadlift", exerciseName: string, isFallback: boolean, e1rmLb: number, ratio: number, tier: "novice"|"intermediate"|"advanced"|"elite"|null }>`.

- [ ] **Step 1: Write the failing tests**

Create `src/strengthStandards.test.js`:

```js
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { bigLiftSummary, getStandardsSex, setStandardsSex } from "./strengthStandards.js";

function mkSet(weight, reps, unit = "lb") { return { weight, reps, unit }; }
function mkSession(date, exercises) { return { id: date, date, day: "MON", notes: "", exercises }; }

describe("bigLiftSummary", () => {
  test("falls back to a variant when the canonical lift name has no data", () => {
    const sessions = [mkSession("2026-08-01", [{ name: "Smith Machine Deadlift", sets: [mkSet("300", "5")] }])];
    const result = bigLiftSummary(sessions, 200, "male");
    const deadlift = result.find(item => item.lift === "deadlift");
    assert.equal(deadlift.exerciseName, "Smith Machine Deadlift");
    assert.equal(deadlift.isFallback, true);
  });

  test("assigns the correct tier at a threshold boundary", () => {
    // Single set of 150lb x 1 rep -> e1RM = 150lb (Epley: reps===1 returns load unchanged).
    // 150 / 200 bodyweight = 0.75, which is exactly the male bench "intermediate" threshold.
    const sessions = [mkSession("2026-08-01", [{ name: "Barbell/DB Bench Press", sets: [mkSet("150", "1")] }])];
    const result = bigLiftSummary(sessions, 200, "male");
    const bench = result.find(item => item.lift === "bench");
    assert.equal(bench.ratio, 0.75);
    assert.equal(bench.tier, "intermediate");
  });

  test("tier is null when sex hasn't been set", () => {
    const sessions = [mkSession("2026-08-01", [{ name: "Barbell/DB Bench Press", sets: [mkSet("150", "1")] }])];
    const result = bigLiftSummary(sessions, 200, null);
    assert.equal(result[0].tier, null);
  });

  test("returns an empty array when there is no data for any of the 3 lifts", () => {
    const sessions = [mkSession("2026-08-01", [{ name: "Bicep Curl", sets: [mkSet("30", "10")] }])];
    assert.deepEqual(bigLiftSummary(sessions, 200, "male"), []);
  });
});

describe("getStandardsSex / setStandardsSex", () => {
  test("round-trips through prefs", () => {
    const prefs = setStandardsSex({}, "female");
    assert.equal(getStandardsSex(prefs), "female");
  });

  test("defaults to null when unset", () => {
    assert.equal(getStandardsSex({}), null);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -A3 "strengthStandards"`
Expected: FAIL — `Cannot find module './strengthStandards.js'` (the file doesn't exist yet).

- [ ] **Step 3: Implement `src/strengthStandards.js`**

```js
// ─── STRENGTH STANDARDS ────────────────────────────────────────────────────────
// Pure helpers behind the Progress dashboard's "Strength levels" card. The
// exercise library names equivalent-equipment variants of the same lift with
// a "/" (e.g. "Barbell/DB Bench Press"); genuinely distinct lifts get their
// own name. LIFT_VARIANTS lists each big lift's canonical name first, then
// fallback variants to use when the canonical name has no logged data yet.
import { exerciseE1RMSeries } from "./stats.js";

export const LIFT_VARIANTS = {
  bench: ["Barbell/DB Bench Press", "Incline DB Press", "Chest Press Machine", "Incline Chest Press Machine"],
  squat: ["Back Squat/Goblet Squat", "Leg Press Machine", "Bulgarian Split Squat", "Single-Leg Leg Press"],
  deadlift: ["Conventional Deadlift", "Smith Machine Deadlift", "Romanian Deadlift"],
};

/** Approximate, publicly-common bodyweight-ratio thresholds per lift and sex. */
export const STANDARDS = {
  male: {
    bench: { novice: 0.5, intermediate: 0.75, advanced: 1.25, elite: 1.75 },
    squat: { novice: 0.75, intermediate: 1.25, advanced: 1.75, elite: 2.5 },
    deadlift: { novice: 1.0, intermediate: 1.5, advanced: 2.0, elite: 2.75 },
  },
  female: {
    bench: { novice: 0.25, intermediate: 0.5, advanced: 0.75, elite: 1.0 },
    squat: { novice: 0.5, intermediate: 0.75, advanced: 1.25, elite: 1.75 },
    deadlift: { novice: 0.75, intermediate: 1.0, advanced: 1.5, elite: 2.0 },
  },
};

const STANDARDS_SEX_KEY = "__standardsSex";

/** null until the user has chosen a standards table in Settings. */
export function getStandardsSex(prefs) {
  const value = prefs?.[STANDARDS_SEX_KEY];
  return value === "male" || value === "female" ? value : null;
}

/** Returns updated prefs; any non-"female" input normalizes to "male". */
export function setStandardsSex(prefs, sex) {
  return { ...(prefs || {}), [STANDARDS_SEX_KEY]: sex === "female" ? "female" : "male" };
}

function tierFor(ratio, thresholds) {
  if (!thresholds) return null;
  if (ratio >= thresholds.elite) return "elite";
  if (ratio >= thresholds.advanced) return "advanced";
  if (ratio >= thresholds.intermediate) return "intermediate";
  if (ratio >= thresholds.novice) return "novice";
  return null;
}

/**
 * Current strength summary for the big 3 lifts. Each lift uses the latest
 * point of exerciseE1RMSeries for the first name in its fallback chain that
 * has any logged data; lifts with zero data across their whole chain are
 * omitted entirely (never shown as a zeroed-out row).
 */
export function bigLiftSummary(sessions, bodyweightLb, sex) {
  if (!bodyweightLb || bodyweightLb <= 0) return [];
  const results = [];
  for (const lift of Object.keys(LIFT_VARIANTS)) {
    const chain = LIFT_VARIANTS[lift];
    let match = null;
    for (const name of chain) {
      const series = exerciseE1RMSeries(sessions, name);
      if (series.length > 0) { match = { name, series }; break; }
    }
    if (!match) continue;
    const e1rmLb = match.series.at(-1).value;
    const ratio = Math.round((e1rmLb / bodyweightLb) * 100) / 100;
    const thresholds = sex ? STANDARDS[sex]?.[lift] : null;
    results.push({ lift, exerciseName: match.name, isFallback: match.name !== chain[0], e1rmLb, ratio, tier: tierFor(ratio, thresholds) });
  }
  return results;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add src/strengthStandards.js src/strengthStandards.test.js
git commit -m "Add strength standards, fallback chains, and big-lift summary"
```

---

### Task 2: "Strength levels" Progress dashboard card

**Files:**
- Modify: `src/progressDashboardSettings.js` (add the `strength` group id/label)
- Modify: `src/screens/ProgressScreen.jsx` (new `StrengthGroup` component, wire into `groups`, accept a `bodyweights` prop)
- Modify: `src/screens/ProgressScreen.css` (new rules for the strength card's rows)
- Modify: `src/App.jsx` (pass `bodyweights` into `<ProgressScreen>`)

**Interfaces:**
- Consumes: `bigLiftSummary`, `getStandardsSex` from `src/strengthStandards.js` (Task 1); `normalizeBodyweights` from `src/weightRecords.js` (existing export); `toLb`, `dominantUnit` from `src/stats.js` (existing exports); `Chip` from `src/components/index.js` (existing export).
- Produces: no new exports — this task only changes rendered output and one new dashboard group id (`"strength"`).

- [ ] **Step 1: Register the new dashboard group id**

In `src/progressDashboardSettings.js`, update:

```js
export const PROGRESS_GROUP_IDS = ["e1rm", "trend", "heatmap", "balance", "strength"];
export const PROGRESS_GROUP_LABELS = {
  e1rm: "e1RM progression",
  trend: "Daily trend",
  heatmap: "Body heatmap",
  balance: "Balance",
  strength: "Strength levels",
};
```

(`normalizeDashboardSettings`'s existing logic already appends any `PROGRESS_GROUP_IDS` entry missing from a stored `cardOrder` — see the `cardOrder.push(...PROGRESS_GROUP_IDS.filter(id => !cardOrder.includes(id)));` lines already in that file — so no other change is needed there for existing users to get this card.)

- [ ] **Step 2: Add the `StrengthGroup` component**

In `src/screens/ProgressScreen.jsx`, update the imports:

```js
import { Button, Card, Chip, SegmentedButtons, Sheet } from "../components/index.js";
import useThemeTokens from "../charts/useThemeTokens.js";
import { dominantUnit, exerciseE1RMSeries, toLb } from "../stats.js";
import { bigLiftSummary, getStandardsSex } from "../strengthStandards.js";
import { normalizeBodyweights } from "../weightRecords.js";
```

Add a new component, placed directly after `E1RMGroup` (before the `export default function ProgressScreen` line):

```jsx
const LIFT_LABELS = { bench: "Bench", squat: "Squat", deadlift: "Deadlift" };

function StrengthGroup({ sessions, bodyweights, sex }) {
  const unit = dominantUnit(sessions);
  const entries = normalizeBodyweights(bodyweights);
  const latestWeighIn = [...entries].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const bodyweightLb = latestWeighIn ? toLb(latestWeighIn.weight, latestWeighIn.unit) : null;
  const displayValue = value => (unit === "kg" ? Math.round((value / 2.20462) * 10) / 10 : Math.round(value));

  return (
    <Card variant="raised" className="progress-group progress-strength">
      <div className="progress-section-heading">
        <div><p className="progress-eyebrow">Strength standards</p><h2>Strength levels</h2></div>
      </div>
      {!bodyweightLb ? (
        <div className="progress-chart-empty"><strong>Log your weight to see strength levels.</strong></div>
      ) : (() => {
        const lifts = bigLiftSummary(sessions, bodyweightLb, sex);
        return lifts.length === 0 ? (
          <div className="progress-chart-empty"><strong>Log a bench, squat, or deadlift set to see your strength levels.</strong></div>
        ) : (
          <>
            {lifts.map(item => (
              <div key={item.lift} className="progress-strength-row">
                <div className="progress-strength-row__head">
                  <strong>{LIFT_LABELS[item.lift]}</strong>
                  {item.tier ? <Chip>{item.tier}</Chip> : <span className="progress-strength-row__notier">Set your sex in Settings to see your tier</span>}
                </div>
                <div className="progress-strength-row__body">
                  <span>{displayValue(item.e1rmLb)} {unit} e1RM</span>
                  <span>{item.ratio}× bodyweight</span>
                </div>
                {item.isFallback && <small className="progress-strength-row__fallback">(from {item.exerciseName} — no {LIFT_LABELS[item.lift]} logged yet)</small>}
              </div>
            ))}
            <small className="progress-strength-disclaimer">Rough public averages, not a medical or competition standard.</small>
          </>
        );
      })()}
    </Card>
  );
}
```

- [ ] **Step 3: Wire `StrengthGroup` into the dashboard**

In `ProgressScreen`'s function body, update the signature to accept `bodyweights`:

```js
export default function ProgressScreen({ sessions = [], preferences = {}, bodyweights = [], onSavePreferences, onAddExercise, onGoHome, loading = false }) {
```

Add a `sex` lookup near the top of the component body (after `const settings = normalized;`):

```js
  const sex = getStandardsSex(preferences);
```

Add `strength` to the `groups` map:

```js
  const groups = {
    e1rm: <E1RMGroup sessions={sessions} reducedMotion={reducedMotion} />,
    trend: <DailyTrendGroup sessions={sessions} settings={settings} onSaveSettings={saveChanges} reducedMotion={reducedMotion} />,
    heatmap: <BodyHeatmapGroup sessions={sessions} settings={settings} onSaveSettings={saveChanges} onAddExercise={onAddExercise} reducedMotion={reducedMotion} />,
    balance: <BalanceGroup sessions={sessions} settings={settings} reducedMotion={reducedMotion} />,
    strength: <StrengthGroup sessions={sessions} bodyweights={bodyweights} sex={sex} />,
  };
```

- [ ] **Step 4: Pass `bodyweights` from `App.jsx`**

In `src/App.jsx`, update the existing `<ProgressScreen>` call site:

```jsx
          <ProgressScreen sessions={sessions} preferences={equipmentPrefs} bodyweights={bodyweights} onSavePreferences={saveProgressPreferences} onAddExercise={addDashboardExercise} onGoHome={() => switchTab("log")} loading={loading}/>
```

- [ ] **Step 5: Add supporting CSS**

In `src/screens/ProgressScreen.css`, add:

```css
.progress-strength-row { padding: var(--sp3) 0; border-top: 1px solid var(--outline-variant); }
.progress-strength-row:first-of-type { border-top: none; padding-top: 0; }
.progress-strength-row__head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp2); }
.progress-strength-row__body { display: flex; gap: var(--sp4); margin-top: var(--sp1); color: var(--on-surface-variant); font-size: var(--text-body-sm); }
.progress-strength-row__notier { color: var(--on-surface-dim); font-size: var(--text-label-sm); }
.progress-strength-row__fallback { display: block; margin-top: var(--sp1); color: var(--on-surface-dim); font-size: var(--text-label-sm); }
.progress-strength-disclaimer { display: block; margin-top: var(--sp3); color: var(--on-surface-dim); font-size: var(--text-label-sm); }
```

- [ ] **Step 6: Verify manually**

Run: `npm run build`
Expected: build succeeds.

Run `npm run dev`, log a bodyweight entry and a set of "Barbell/DB Bench Press" (or any of its fallback variants), open Progress, and confirm:
- A "Strength levels" card appears (use "Customize dashboard" to unhide/reorder it if it landed at the bottom).
- It shows the logged lift's e1RM and ratio; unlogged lifts (squat/deadlift, if not logged) don't appear as empty rows.
- Before setting a sex in Settings, the tier area reads "Set your sex in Settings to see your tier" instead of a tier chip.
- With no bodyweight logged at all, the card shows "Log your weight to see strength levels." instead of any lift rows.

- [ ] **Step 7: Commit**

```bash
git add src/progressDashboardSettings.js src/screens/ProgressScreen.jsx src/screens/ProgressScreen.css src/App.jsx
git commit -m "Add Strength levels card to the Progress dashboard"
```

---

### Task 3: Settings — strength standards sex selection

**Files:**
- Modify: `src/screens/SettingsScreen.jsx`

**Interfaces:**
- Consumes: `getStandardsSex`, `setStandardsSex` from `src/strengthStandards.js` (Task 1); `equipmentPrefs`, `saveAccountPrefs` (already existing props on `SettingsScreen`).

- [ ] **Step 1: Import the new helpers**

In `src/screens/SettingsScreen.jsx`, add to the existing imports:

```js
import { getStandardsSex, setStandardsSex } from "../strengthStandards.js";
```

- [ ] **Step 2: Add the Settings card**

Inside the `SettingsScreen` component, after the existing "Rest timer" `Card` block and before the "Strength goals" `Card` block, add:

```jsx
      <Card className="settings__card">
        <h2 className="settings__title">Strength standards</h2>
        <p className="settings__help">Used to show your strength tier (novice → elite) on the Progress dashboard. These are rough public averages, not a medical or competition standard.</p>
        <SegmentedButtons
          ariaLabel="Strength standards"
          options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]}
          value={getStandardsSex(equipmentPrefs) || "male"}
          onChange={sex => saveAccountPrefs(setStandardsSex(equipmentPrefs, sex))}
        />
      </Card>
```

(`value` falls back to `"male"` only for the segmented control's visual selection when nothing has been chosen yet — `getStandardsSex` itself still correctly returns `null` to `bigLiftSummary` until the user actually taps an option, since tapping is what calls `saveAccountPrefs`.)

- [ ] **Step 3: Verify manually**

Run: `npm run build`
Expected: build succeeds.

Run `npm run dev`, open Settings, and confirm the new "Strength standards" card renders with a Male/Female toggle, and that choosing one is reflected on the Progress dashboard's "Strength levels" card (tier chips now appear instead of the "Set your sex..." prompt).

- [ ] **Step 4: Commit**

```bash
git add src/screens/SettingsScreen.jsx
git commit -m "Add strength standards sex selection to Settings"
```

---

## Final Verification

After all three tasks:

- [ ] Run `npm test` — full suite passes.
- [ ] Run `npm run build` — succeeds with no errors.
- [ ] Run `npm run lint` — no new warnings/errors introduced by this rollout's files.
- [ ] Manually walk through, in one `npm run dev` session: log a bodyweight entry, log sets for at least one big lift (canonical or fallback variant), set a sex in Settings, and confirm the Progress dashboard's "Strength levels" card shows the right e1RM/ratio/tier and fallback note where applicable.
- [ ] Bump version (`npm version patch --no-git-tag-version`), rebuild, commit, `firebase deploy --only hosting`, `git push` — per this project's established release process.
