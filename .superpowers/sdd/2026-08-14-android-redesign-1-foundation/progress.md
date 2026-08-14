# SDD ledger — plan: docs/superpowers/plans/2026-08-14-android-redesign-1-foundation.md

Spec: docs/superpowers/specs/2026-08-14-android-redesign-design.md (read, reachable)
Repo root: /Users/pagraw15/lightweight_workout_tracker/workout-tracker
Branch: main
Baseline before Task 1: 161 tests / 35 suites / 0 fail. lint clean. build clean.

Ruling: work in-place on `main`, no branch, no worktree — user instructed
"dont create branch do everything in main" explicitly, which is the consent the
skill requires. Cost if wrong: no cheap bail-out; undoing a bad task needs
`git revert <sha>` instead of deleting a branch. Baseline commit f73b72f.

## Pre-flight conflict scan

### Cross-task rows (pairs sharing a file or interface)

| Pair | Produces → Consumes | Finding |
|---|---|---|
| T1 → T2 | tokens.css names → Card/Button/Chip CSS | Clean. Every token T2 references (`--surface-container`, `--surface-container-high`, `--elev-1/2`, `--shape-xxl/sm/full`, `--sp2/3/5/6`, `--filled-bg/fg`, `--on-surface*`, `--outline-variant`, `--primary`, `--dur-short`, `--ease-std`) is defined in T1 |
| T1 → T3 | tokens.css names → TextField/ListItem/Seg CSS | Clean. All referenced tokens defined |
| T1 → T4 | tokens.css names → AppBar/NavBar CSS | Clean. All referenced tokens defined |
| T1 → T6 | `theme.js` exports → SettingsScreen | Clean. T1 exports `getThemePref`/`setThemePref`; T6 imports exactly those two |
| T2 → T3 → T4 | `components/index.js` | Clean. T2 creates it with 3 exports, T3 replaces with 6, T4 appends 2 → 8. Sequential and consistent |
| T4 → T5 | `AppBar`, `NavBar` → App.jsx shell | Clean. T5 also imports `Button` (T2) — defined |
| T2,T3 → T6 | 5 primitives → SettingsScreen | Clean. Card, Button, TextField, ListItem, SegmentedButtons all defined by T3 |
| T1 ↔ T5 | both modify `src/index.css` | Clean. T1 edits the top block; T5 deletes by selector name, not line number |
| **T5 ↔ T6** | **both modify `src/App.jsx`** | **CONFLICT — line numbers. T6 targets "lines 1378–1412" but T5's edits to 909–948 and 1416–1420 shift them first** |
| **T5 ↔ T6** | **`packageInfo` import** | **CONFLICT — T5 deletes the footer at line 1417, the import's only use. `no-unused-vars` is an error under `js.configs.recommended` (verified), so T5's own lint step fails. T6 re-adds the use** |

### Self-consistency rows (each task against its own text)

| Task | Finding |
|---|---|
| T1 | Step 7 replaces lines 1–26, then refers to "former lines 27–32" — line numbers already shifted by its own edit |
| T2 | Clean. Files created match files exported; no colour literals in its own code |
| T3 | Clean. Three components, three CSS files, all six re-exported |
| T4 | Clean. Documents its own deliberate spec deviation (lucide is outline-only, so active state = pill + stroke weight, not a filled icon) |
| **T5** | **DEFECT — Step 1 says add `Home` to the lucide import, then says "remove `Home` from this import if lint flags it as unused". Self-contradictory, and `no-unused-vars` guarantees it fails** |
| T6 | Clean. Props consumed match what App.jsx has available (verified against App.jsx:355–358, 645, 652, 685, 894) |

### Rulings before execution

Ruling: all commands run from `/Users/pagraw15/lightweight_workout_tracker/workout-tracker`
— the plan's `cd workout-tracker` prefix assumes the parent directory, but the
repo root *is* `workout-tracker`. Strip that prefix from every command.
Cost if wrong: implementer's first command errors and it asks; cheap.

Ruling: T5 must also delete the `import packageInfo from "../package.json"` line
when it deletes the footer, and T6 re-adds it. Verified `no-unused-vars` is an
error, so leaving it would fail T5's own lint gate. Cost if wrong: one extra
lint round.

Ruling: T5 does NOT add `Home` to the lucide import. The plan's hedge is a
defect; Plan 2 adds the icon together with the Home destination that uses it.
Cost if wrong: Plan 2 adds one import line.

Ruling: locate edit sites by code marker, never by the plan's line numbers —
T6 by `{activeTab === "settings" && (`, T1 Step 7 by the `.app-shell` selector,
T5 by `<div className="app-shell"` and `<footer className="app-footer"`.
Cost if wrong: implementer edits the wrong block; caught by review and the
visual check.

Ruling: `--success` and `--error` tokens are defined in T1 and first consumed in
T6 (goal messages, completed progress bar). Not a conflict — recorded so a
reviewer seeing unused tokens in T1 does not flag them as dead.
Cost if wrong: none.

## Progress

### Correction to the baseline recorded above

My baseline line claimed "lint clean". That was asserted, not measured — I ran
`npm test` only. Task 1's implementer caught it: `npm run lint` fails with 5
pre-existing errors on unmodified `main` (verified by `git stash`). The plan's
per-task "lint clean" gate was therefore unusable as written from the start.

True baseline at f73b72f: 161 tests / 35 suites / 0 fail. Build clean.
Lint: 5 errors, all in src/App.jsx —
  196:7    no-useless-assignment       chartData assigned but unused
  369:44   no-empty                    empty block statement
  388:9    react-hooks/set-state-in-effect
  717:170  no-unused-vars              'done' unused
  1453:104 no-irregular-whitespace

Ruling: fix the 4 mechanical errors (196, 369, 717, 1453) in a separate hygiene
commit before Task 2, so the lint gate becomes meaningful for the remaining
tasks. Authorised by user: "in this repo you are free to change/edit/update as
needed". Cost if wrong: 4 one-line reverts.

Ruling: BASELINE the 5th error (388:9 set-state-in-effect) rather than fix it.
It is a genuine pre-existing design issue in the guest-profile loading effect,
but fixing it means restructuring App.jsx's state-loading path — which the spec
places out of scope ("the data layer is untouched") and which guards the user's
workout history. Deferred to a follow-up, surfaced in the final review.
Revised gate for Tasks 2-6: "no lint errors beyond 388:9".
Cost if wrong: a real perf/correctness smell ships unfixed; it is already
shipping today, so this changes nothing for the user.

Task 1: complete pending review (commit 7e9cc10, tests 161/161 = baseline)
Task 1: complete (commits f73b72f..7e9cc10, review clean — spec ✅, quality approved,
  zero findings; reviewer independently reproduced 161/35/0 and script-verified all 25
  colour roles mirror between light and dark)

Ruling: ADD a type scale to tokens.css. The Task 1 reviewer observed that
tokens.css defines no font sizes — only --font-sans — so every size is a literal
in component CSS. The spec claims the M3 type scale is tokenized; it is not.
Leaving it means the redesign reproduces, for typography, the exact "no system"
failure it exists to fix (the app's current 9-13px flatness). Cheap now (3
committed component files), expensive after 8 more screens. Type sizes are not
colours, so this was not caught by the colour-literal gate.
Scale: --text-label-sm 11px, --text-label 11.5px, --text-body-sm 12.5px,
--text-label-lg 13px, --text-body 13.5px, --text-body-lg 15px, --text-title
15.5px, --text-title-lg 18px, --text-headline 23px, --text-headline-lg 25px,
--text-display 52px. Floor is 11px, which keeps the "nothing below 10.5px" rule
structurally true rather than review-enforced.
Cost if wrong: 11 unused tokens and a 3-file revert.

Ruling: batch the type-scale work with the 4 mechanical lint fixes into ONE
dispatch — both are small repo-wide mechanical edits, and the skill says batch
same-shape work rather than pay a dispatch per item.
Cost if wrong: one slightly larger diff to review.

Task 2: complete pending review (commit 004dedb, tests 161/161 = baseline)
Task 2: complete (commits 7e9cc10..004dedb, review clean — spec ✅, quality approved,
  zero findings; reviewer verified every var(--token) name exists and that the Button
  state layer has pointer-events:none, is suppressed on :disabled, and is clipped)

Diagnosis of the 4 mechanical lint errors before briefing the fix:
  196:7  `let chartData = []` initializer IS dead — `catch { chartData = []; }` at
         line 207 covers the throw path. Better fix: keep the initializer, empty the
         catch body to a comment. Reads better AND satisfies the rule.
  369:44 genuinely empty `catch {}`. Codebase idiom elsewhere is an explanatory
         comment inside the braces.
  717:170 `.map(({done,...r})=>r)` is the deliberate omit-a-key destructuring idiom;
         `done` is *meant* to be unused. Correct fix is eslint's
         `no-unused-vars: ignoreRestSiblings: true` — the option designed for exactly
         this — not a code change or a disable comment.
  1453:104 U+3000 IDEOGRAPHIC SPACE in the legend string "● primary　○ secondary".
         The adjacent U+25CB (○) is a legitimate visible glyph, not whitespace —
         only the U+3000 gets replaced with an ASCII space.
Hygiene batch: complete (commits 004dedb..33d66e4 — Job A 2079acf lint, Job B 33d66e4
  type scale). Lint now reports exactly 1 error (388:9, baselined). Tests 161/161.
  Controller-verified the diff scope directly: exactly 3 changed lines in App.jsx at
  the 3 intended sites, +3 lines in eslint.config.js, 1 line each in Button.css and
  Chip.css, +12 in tokens.css. No stray edits in the 1,482-line file.

Ruling: no dedicated review round for the hygiene batch — fold it into the final
whole-branch review instead. Two tiny commits, every gate green (lint 5→1, tests
161/161, build clean), and I verified the diff line-by-line myself. A dedicated
reviewer seat costs more than the residual risk.
Cost if wrong: a mechanical slip reaches the final review one stage later.

Observation (not a finding, for a later plan): src/App.jsx line ~1453 renders
`fontSize:8.5` in the heatmap legend — below the redesign's 10.5px floor. It lives
in a screen this plan does not convert; it must be fixed when that screen converts
in Plan 2 or 3. Recorded so it is not lost.

Type-token mapping given to Task 3 (brief predates the scale, so it still shows
literals): TextField label 11px -> --text-label-sm, input 15px -> --text-body-lg;
ListItem title 15px -> --text-body-lg, sub 12.5px -> --text-body-sm;
SegmentedButtons opt 13px -> --text-label-lg.
Task 3: complete pending review (commit d4d4da5, tests 161/161, 5 type-token subs)
Task 4: complete pending review (commit 8feee10, tests 161/161, 5 type-token subs,
  index.js now exports 8)

Ruling: Task 5's shell replacement drops the `.account-chip` block (the avatar plus
the "PRIVATE ACCOUNT / DEVICE ONLY" indicator) because the plan's replacement JSX
does not include it. Accepted rather than preserved: the AppBar's sync Button already
conveys auth state ("Synced" / "Sync error" / "Sign in"), and Task 6's SettingsScreen
opens with "Preferences are saved for {your Google account | guest mode on this
device}" — so the privacy signal survives, on the screen where account settings
actually live. Cost if wrong: the at-a-glance guest-vs-signed-in cue is one tab away
until Plan 2 adds the Home overflow menu.
Task 3 review: spec ✅, quality approved WITH one Important finding, correctly
  attributed to the plan rather than the implementer.
  Finding: SegmentedButtons.css — the plan's comment claims "42px option + 3px
  container padding = 48dp target". False. The 3px padding is on the `.m3-seg`
  CONTAINER, so it pads the outside of the whole group, not each option. With
  `* { box-sizing: border-box }` from base.css, each `<button>` renders at exactly
  42px — 6px under the 48dp minimum, which is a Global Constraint.

Ruling: the FINDING WINS over the plan text. The spec's "minimum 48dp touch target
on every interactive element" is binding; my plan's arithmetic was simply wrong, and
the misleading comment would have propagated the error to any future control built by
copying it. Fix: `.m3-seg__opt { min-height: 48px }`, keep the container's 3px padding
(it creates the inset-pill look), correct the comment. Total widget height becomes
54px, which still fits inside ListItem's 56px row. Entering fix round 1 on Task 3.
Cost if wrong: segmented controls are 6px taller than designed.
Task 4: complete (commits d4d4da5..8feee10, review clean — spec ✅, quality approved,
  zero findings; reviewer verified the fixed-position auto-margin centring technique,
  the 420px match to .app-shell, and the IntersectionObserver dep array)

Task 4 review surfaced a forward finding for Task 5, verified numerically:
  `.rest-dock` carries inline `z-index: 50` (App.jsx:1422) and index.css sets its
  offset to `bottom: calc(16px + inset)` at base and `calc(74px + inset)` under
  @media (max-width:640px) — the 74px was tuned for the OLD 66px mobile nav.
  The new NavBar is `height: calc(80px + inset)`, `z-index: 45`, and — crucially —
  fixed at ALL widths, whereas the old `.app-nav` was only fixed below 640px.
  Consequence once Task 5 mounts NavBar:
    >640px: dock sits 16px up, INSIDE the 80px nav, and paints over it (50 > 45).
    <=640px: dock at 74px vs an 80px nav — 6px overlap.

Ruling: Task 5 must also retarget `.rest-dock` to clear the new nav at every width —
base rule becomes `bottom: calc(88px + env(safe-area-inset-bottom)) !important`
(80px nav + 8px gap; the nav's own height already includes the inset), and the
@media (max-width:640px) override drops its `bottom` declaration while keeping its
other properties. In scope because Task 5 introduces the regression; leaving it would
ship a rest timer hidden behind the navigation during a workout.
Cost if wrong: the dock floats 8px higher than ideal on one form factor.
Task 3: complete (commits 33d66e4..8126832, 1 fix round, re-review ADDRESSED)
  Deferred minor from re-review: a 54px SegmentedButtons widget inside ListItem's
  56px row grows the row to ~78px. Not a regression — ListItem is flex with
  min-height, so it grows by design. Task 6 is the first real consumer; confirm it
  looks right there.

Task 5: implemented (commit 1632da7), DONE_WITH_CONCERNS. Review dispatched.

Ruling: RATIFY the implementer's deliberate deviation from the brief. It kept the
pre-existing `firebaseConfigured &&` gate around the sign-in/sync button, which my
plan's replacement snippet silently dropped. Verified in the diff
(`-{firebaseConfigured && (firebaseUser ? (` / `+{firebaseConfigured && (firebaseUser`).
Without the gate, a build with no Firebase env vars renders a "Sign in" button that
throws on click — a behaviour regression against the plan's own "behaviour must not
change" constraint. Plan defect #5; the implementer was right and the brief was wrong.
Cost if wrong: none — this restores existing behaviour.

Concern 2 (self-reported near-miss) verified independently: the implementer briefly
deleted `.app-shell` from the @media(max-width:640px) block, then restored it. Present
and correct at index.css:43. Self-report was accurate. No action.

Two further defects I found while verifying, to fold into Task 5's fix round:
  (a) index.css:43 `.app-shell` in the 640px block still forces
      `padding-bottom: calc(76px + inset) !important`, tuned for the old 66px nav.
      base.css correctly sets 80px, but this !important override wins on mobile, so
      the last 4px of content hides behind the new 80px NavBar. Fix by DELETING the
      padding-bottom declaration entirely so base.css applies — better than editing
      76 to 80, since it removes a duplicated constant.
  (b) index.css:42 `body { background: #08090e; }` inside the 640px block is a
      HARDCODED COLOUR that overrides the themed `body { background: var(--surface) }`
      from base.css (index.css is imported after, so it wins). On a phone in light
      mode the body paints near-black — visible during overscroll and behind a short
      screen. This is precisely the class of legacy rule the redesign exists to delete.
  (c) index.css:44 `.nav-icon { display: block; }` is now dead — `.nav-icon` was the
      old tab strip's icon class and the new NavBar does not use it. My deletion
      instruction only covered selectors starting `.app-header`/`.app-nav`/
      `.account-chip`/`.app-footer`, so it survived.
Task 5 review: spec ✅, quality approved, ZERO findings against the implementer's work.
  Reviewer independently confirmed behavioural equivalence with line cites (switchTab
  + workout-active-tab persistence, all four firebase/export/import handlers, the
  cloudStatus ternary, NAV_ITEMS object shape matching NavBar's destructure), that the
  App.jsx diff is only 2 hunks in a 1,482-line file, and that every surviving
  className still has a matching CSS rule (no silent unstyled elements).
  It also validated my three planned CSS fixes as correct and sufficient.

Correction to my own rest-dock analysis: I wrote that the dock "paints over" the nav
because z-index 50 > 45. That was true of the PRE-fix geometry (16px offset under an
80px nav). After the fix it is moot — `bottom: calc(88px + inset)` pins the dock's
bottom edge 8px ABOVE the nav's top edge and the dock grows upward, so no overlap
exists for stacking order to matter at any dock height. The fix was right; the
z-index framing was not load-bearing.

Task 5: fix round 1/5 dispatched — 3 legacy CSS defects, all in the
@media(max-width:640px) block, none covered by my original deletion instruction:
stale .app-shell padding-bottom (76px vs 80px nav), hardcoded body background
(#08090e overriding the theme, breaking light mode on phones), dead .nav-icon rule.

Task 5: fix round 1 complete (commit 973ccad). Removed all three obsolete mobile
overrides. Build clean; tests 161/161; diff check clean.

Task 6: complete (commit a56e1d3). Created SettingsScreen on the shared Card,
Button, TextField, ListItem and SegmentedButtons primitives; added the persisted
System/Light/Dark control; preserved progression, rest-timer and strength-goal
behaviour; restored the version from package.json; and added a narrow-phone layout
for the 48px segmented controls. No colour literals in src/screens or src/components.
Build clean; tests 161/161. Lint reports only the deliberately baselined guest-profile
loading error, now at App.jsx:390 after the new imports.

Foundation Plan 1 implementation is complete. Human verification still required on
a 390px device for theme/status-bar switching and the Settings controls. Plans 2 and
3 remain deferred exactly as listed in the plan.

## Continuation — experience redesign

Session mode: complete through focused one-exercise logging, workout detail sheets,
Android/browser back handling, and draft-safe exit confirmation (commits b0f3f7c..b7585b4).

Progress rebuild: in progress. The first slice introduces `screens/ProgressScreen`,
the design-specified theme-aware chart palette/hook, and a raised e1RM progression
card backed by the existing tested `exerciseE1RMSeries` function. The previous
standalone Progress module now renders beneath that screen boundary while its
remaining heatmap, trend, insight, and balance groups are migrated incrementally.
Verification: build clean; 164/164 tests; lint unchanged at the single baselined
guest-loading effect finding.

Progress rebuild slice 2: complete. Replaced the compact legacy range buttons with
the shared 48dp `SegmentedButtons` primitive. Dashboard customization now opens in
the shared `Sheet` component and uses accessible switches plus 48dp reorder actions,
instead of adding another full card to the analytics scroll. Build clean; 164/164
tests; no data or analytics behavior changed.
