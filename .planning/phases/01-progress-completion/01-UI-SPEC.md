---
phase: 1
slug: progress-completion
status: approved
shadcn_initialized: false
preset: none
created: 2026-08-14
reviewed_at: 2026-08-14
---

# Phase 1 — UI Design Contract

> Visual and interaction contract for Progress Completion. This contract refines the approved Android redesign; it does not introduce a new visual system or change analytics semantics.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | Manual design system: CSS custom-property tokens plus hand-built Material 3 primitives |
| Preset | Not applicable |
| Component library | Existing `src/components/` primitives only: `Card`, `Button`, `SegmentedButtons`, `Sheet`, and other exported primitives where appropriate |
| Icon library | Existing `lucide-react`; icons support text labels and never carry meaning alone |
| Chart library | Existing Recharts integration with `src/charts/chartTheme.js` and `useThemeTokens()` |
| Font | Existing self-hosted Manrope Variable through `--font-sans` |
| Layout target | Phone-first at 360px and 390px; the same layout is centered in the existing 420px-wide `.app-shell` on larger viewports |
| Themes | Full light and dark parity using existing semantic roles; no screen-specific theme overrides |

The implementation MUST extend the existing manual system. It MUST NOT initialize shadcn, MUI, Tailwind, `@material/web`, or any third-party component registry. New reusable behavior belongs in a hand-built primitive; Progress-specific composition belongs in `ProgressScreen` and its adjacent CSS. Domain calculations remain outside the screen.

### Primitive contract

- Use `Card` for the four analytics groups, `SegmentedButtons` for the global 7/28/90 range and the Body mode control, `Button` for named actions, and `Sheet` for Customize and muscle guidance.
- Native `<select>` controls are allowed for long exercise and metric lists, but MUST receive the same tokenized 48px control treatment as existing primitives.
- All interaction states use the existing Material state-layer grammar. Do not restore press-scale effects, hard-coded inline styles, `!important` specificity fixes, or bespoke button styles.
- Shapes come from existing `--shape-*` roles and elevation from `--elev-1`/`--elev-2`; the default analytics card is filled and borderless, while the primary e1RM group may use raised elevation.

---

## Information Architecture and Composition

The Progress destination is one continuous narrow-column scroll. From top to bottom:

1. Global toolbar: 7/28/90 range selector, then `Customize dashboard`.
2. e1RM progression group.
3. Daily Trend group.
4. Body heatmap group.
5. Balance group.

There MUST be exactly four top-level analytics groups. Existing analytics that are not named as a group remain available as subordinate content rather than separate equal-weight cards:

| Group | Required content | Visual hierarchy |
|-------|------------------|------------------|
| e1RM progression | Exercise selector, full-history e1RM line, unit, tooltip/data summary, empty state, and the existing full training-insight list once | Raised first card; headline and latest value lead, chart follows |
| Daily Trend | Range summary, exercise selector, metric selector, one bar per calendar day, 12-week training calendar with Earlier/Later/Current paging, consistency values, and selected-day workout detail | Filled card with the daily chart first; summary and calendar are clearly subordinate sections |
| Body heatmap | Coverage/Set volume mode, front/back map, legend, current range dates, priorities and coverage gaps, and the missed-muscle guidance entry point | Filled card; map is the focal media surface; guidance remains in a Sheet |
| Balance | Muscle-group percentage bars and push/pull ratio with methodology text | Filled card; ratio summary precedes group bars |

The toolbar remains visible even when all four groups are hidden. In that state, render a compact status surface with a `Customize dashboard` action. Customization MUST expose exactly these four top-level group labels and may not silently discard subordinate analytics.

---

## Spacing Scale

All new or migrated Progress spacing declarations MUST use only this standard set. Intermediary spacing tokens such as `--sp3`, `--sp5`, and `--sp10` MUST NOT be used in Phase 1 Progress CSS even though they exist globally.

| Step | Value | Existing source / composition | Usage |
|------|-------|-------------------------------|-------|
| xs | 4px | `--sp1` | Label-to-control gaps, legend gaps |
| sm | 8px | `--sp2` | Compact row and inline gaps |
| md | 16px | `--sp4` | Card padding, group gaps, control-stack gaps |
| lg | 24px | `--sp6` | Major internal section separation |
| xl | 32px | `--sp8` | Sheet section separation and empty-state breathing room |
| 2xl | 48px | two `--sp6` increments | Large state separation; also the minimum interactive target dimension |
| 3xl | 64px | two `--sp8` increments | Rare top-level state spacing only |

Exceptions: none. Dimensions intrinsic to charts and icons are not spacing declarations, but their surrounding margins and gaps still use this set.

---

## Typography

Phase 1 uses exactly four semantic roles and two weights. Numeric values use tabular figures. No Progress text is smaller than 11px, and no weight other than 400 or 600 is permitted.

| Role | Existing token | Size | Weight | Line height | Usage |
|------|----------------|------|--------|-------------|-------|
| Label | `--text-label-sm` | 11px | 600 | 1.25 | Eyebrows, axis ticks, legends, field labels, short metadata; uppercase only for eyebrows |
| Body | `--text-body` | 13.5px | 400 | 1.5 | Descriptions, empty/error copy, sheet guidance, chart tooltip copy |
| Title | `--text-title-lg` | 18px | 600 | 1.3 | Group titles, key ratios, compact metric values |
| Headline | `--text-headline` | 23px | 600 | Latest e1RM and primary range-summary values only |

Long exercise names, localized dates, and guidance copy wrap without overlap. Select values may truncate with an ellipsis only when the full value remains available through the native option list and accessible name. Do not use all-caps for sentences or controls.

---

## Color

### 60/30/10 contract

| Share | Roles | Usage |
|-------|-------|-------|
| Dominant (60%) | `--surface`, `--on-surface` | App background, scroll canvas, primary text, chart whitespace |
| Secondary (30%) | `--surface-container`, `--surface-container-high`, `--surface-container-highest`, `--on-surface-variant`, `--on-surface-dim`, `--outline-variant` | Cards, sheets, nested panels, tracks, secondary text, dividers |
| Accent (10%) | `--primary`, `--primary-container`, `--on-primary-container`, `--filled-bg`, `--filled-fg`; `chartTheme.primary` where SVG requires a literal | Selected range, primary e1RM line, selected heatmap region, enabled switches, focus/selection emphasis, and the `Add exercise` action |

Volt is a narrow accent, not general decoration. Reserve the volt treatment for the selected range indicator, one primary chart series at a time, selected/active state emphasis, enabled switches, and the highest-priority action inside the muscle guidance sheet. Do not tint every heading, icon, metric, bar, or card with volt. The total screen impression must remain approximately 60% base surface, 30% tonal containers, and no more than 10% accent.

Semantic states use `--warn`, `--success`, and `--error` only for their meanings. `--error` communicates calculation/load failure and is not a destructive-action color in this phase. Heatmap and chart colors MUST be supplied through theme roles or the light/dark JS chart palette; remove hard-coded Progress SVG/inline colors. The Body legend uses text and labels in addition to hue. Empty muscles use `--muscle-empty`; outlines use `--muscle-stroke`. Push and pull, group bars, and chart series must remain distinguishable without relying on red/green perception alone.

There are no destructive actions in Progress Completion.

---

## Detailed Surface Contracts

### Global toolbar

- The segmented options are visibly labeled `7 days`, `28 days`, and `90 days`; accessible names are `Show last 7 days`, `Show last 28 days`, and `Show last 90 days`.
- The control is single-select, keyboard-operable, and exposes its current selection. Each segment is at least 48px high.
- Selection applies immediately and persists through the existing preferences callback; there is no Apply button.
- The range updates range-sensitive summary, daily Trend, Body, and Balance data. It does not change the established full-history e1RM calculation or the calendar's separate 12-week history paging.
- On 390px when space permits, range and Customize share a row. At 360px or whenever text would compress, the toolbar stacks: selector full width, Customize aligned to the trailing edge.

### e1RM progression

- Heading: `Estimated one-rep max`; eyebrow: `Strength progression`.
- The exercise selector is 48px high and uses all eligible logged exercise names in stable alphabetical order. A long value uses available width before truncation.
- The line chart shows the existing `exerciseE1RMSeries` values and dominant unit without changing formulas. It uses a monotone primary line, visible points, subdued grid, and theme-aware tooltip.
- Show the latest e1RM as a Headline value with unit, and expose first/latest/change in a concise text summary so the information is not chart-only.
- The full insight list appears once beneath the chart in this group. Recovery/plateau wording and the non-medical disclaimer remain intact, with evidence tokens wrapping rather than shrinking below the Label role.

### Daily Trend

- Heading: `Daily trend`.
- Exercise and metric controls are labeled `Exercise` and `Metric`; choices preserve All exercises, Volume, Max weight, Estimated 1RM, and Sessions.
- The selected 7/28/90 range ALWAYS produces one datum per calendar day, including zero-value days. Rendering, responsive pressure, or range changes MUST NOT bucket, sum, average, sample, or omit individual daily bars.
- Axis labels may use range-aware tick intervals for legibility, but every bar remains in the DOM/chart data. Hover, pointer, or touch inspection reports the full date, metric name, value, and unit.
- Preserve range-summary values: sessions, total volume, working sets, planned workout days, and the editable planned-days target.
- Preserve the 12-week activity calendar, history paging, consistency measures, populated-day selection, saved workout detail, notes, exercise/set counts, and singular/plural copy. It is subordinate to the daily chart and may horizontally scroll if required to keep targets legible.

### Body heatmap and muscle guidance Sheet

- Heading: `Body heatmap`; mode options: `Coverage` and `Set volume`.
- Front and back figures use the existing muscle geometry and calculation modes. Each selectable muscle has a programmatic name and state/value, a visible selected outline, and an equivalent list/chip route in the Sheet.
- The card summary reads either `{N} muscle groups need attention` plus `Review gaps and verified exercise suggestions.`, or `Full coverage` plus `Every mapped muscle received work in this period.`
- `Review muscle guidance` opens the Sheet and selects the first missed muscle when none is selected. Selecting a body region opens the same Sheet focused on that muscle.
- Required Sheet labels are: title `Muscle guidance`; selector group `Muscles needing attention`; progress `{Muscle}: {done} of {target} estimated sets`; field `Weekly target sets`; section `Recent exercises`; section `Exercises to fill the gaps`; suggestion metadata `Direct: …` or `Supporting: …`; action `Add exercise` (accessible name `Add {exercise name}`); close action `Close muscle guidance`.
- Preserve target editing (1–40), recent mapped history, verified suggestions, equipment/recent-exercise prioritization, custom-exercise caveat, and readiness cautions. Pain and high-soreness cautions use warning styling and retain the qualified-advice wording.
- The Sheet is a modal dialog: focus moves to its heading/first meaningful control, focus is trapped, Escape/browser back/scrim/drag close it, and focus returns to the invoking muscle or Review button. Drag is an enhancement; close never depends on gesture alone.

### Balance

- Heading: `Balance`.
- Push/pull ratio appears first with explicit percentages, labels, a two-part track, and `Based on mapped working sets in this range.`
- Muscle-group rows follow with group name, numeric percent, and a proportional bar. Bars share a consistent maximum and do not use unrelated rainbow colors.
- Zero-data explanations are rendered in place without collapsing the card.

### Customize Sheet

- Action label and Sheet title: `Customize dashboard`.
- Supporting copy: `Choose which analytics groups appear and adjust their order.`
- Rows are e1RM progression, Daily trend, Body heatmap, and Balance. Each row has a labeled switch plus `Move {group} up` and `Move {group} down` controls.
- Switch and reorder changes save immediately through existing preferences. Disabled boundary arrows remain visible, disabled, and correctly announced.
- Reordering affects only visual order. It MUST NOT recalculate analytics, alter sessions, reset the selected range, or lose a group's subordinate content.

---

## Copywriting Contract

| Element | Required copy |
|---------|---------------|
| Range controls | `7 days`, `28 days`, `90 days`; accessible actions `Show last {N} days` |
| Customize action | `Customize dashboard` |
| All-hidden state | Heading `All analytics groups are hidden`; body `Open Customize to choose what appears here.`; action `Customize dashboard` |
| Loading state | `Loading progress…` |
| Full empty heading | `No progress yet` |
| Full empty body | `Log your first workout to see strength, trends, body coverage, and balance.` |
| Full empty action | `Go to Home` when the existing navigation callback is available; otherwise no inert CTA |
| Error heading | `Progress couldn’t be calculated` |
| Error body | `Your workouts are still saved. Try again, or review the affected workout data.` |
| Error action | `Try again` |
| e1RM partial empty | `No weighted sets for {exercise} yet.` / `Log weight and reps to start this strength trend.` |
| Daily Trend zero result | `No {metric} recorded for this selection in the last {N} days.` |
| Body full-coverage state | `Full coverage` / `Every mapped muscle received work in this period.` |
| Body no mapped data | `No mapped muscle work in this range.` / `Log an exercise from the muscle guide or choose another range.` |
| Muscle history empty | `No matching exercise in this range.` |
| Suggestions empty | `No verified suggestions are available for this gap yet.` |
| Push/pull empty | `Log mapped push and pull exercises to see your ratio.` |
| Balance empty | `Not enough mapped exercises to show muscle-group balance yet.` |
| Sheet labels | `Muscle guidance`, `Muscles needing attention`, `Weekly target sets`, `Recent exercises`, `Exercises to fill the gaps`, `Add exercise`, `Close muscle guidance` |
| Destructive confirmation | Not applicable — this phase has no destructive actions |

Copy is concise, direct, and non-judgmental. Guidance must be described as trend-based and not medical advice. Never imply that a missed muscle, imbalance, soreness, or plateau is a diagnosis.

---

## State Contract

| State | Required presentation and behavior |
|-------|------------------------------------|
| Loading | Preserve the screen shell and toolbar footprint; render static tonal skeleton blocks for group headings and charts. No shimmer under reduced motion. Do not briefly show the empty state while stored sessions hydrate. |
| Empty | Replace the four groups with the full empty copy and optional `Go to Home` action. Toolbar may remain only if preferences can still be meaningfully edited. |
| Populated | Render all enabled groups in saved order with the active range and current selections. |
| Partial | Keep the group visible and render its local empty explanation; other groups remain usable. Examples include no weighted sets, no mapped muscles, no push/pull sets, and no suggestions. |
| Error | Isolate a failed calculation to its group when possible; show error copy plus `Try again`. Retain unaffected groups and state. The global error replaces the dashboard only when the screen cannot safely derive any analytics. |
| Preference save failure | Keep the prior confirmed setting, announce `Dashboard changes couldn’t be saved. Try again.`, and leave Customize open for retry. |
| All hidden | Keep the global toolbar and render the documented all-hidden state; Customize remains reachable. |
| Long/overflow content | Wrap insight, exercise, note, and guidance copy; keep controls 48px high; scroll Sheet content vertically; never allow horizontal page overflow. |

All states use the same four type roles and semantic color tokens. State transitions must not clear the selected exercise, metric, muscle, range, or history page unless that selection no longer exists in the source data.

---

## Interaction Contract

- Range, exercise, metric, Body mode, group visibility, and order changes take effect immediately. Only persisted dashboard preferences survive reload; transient tooltip, selected day, and open Sheet state do not.
- Pointer, touch, keyboard, and Android back behavior are equivalent. Every control has a visible focus indicator and a 48px minimum target.
- Buttons use verb-led labels. Arrow icons may supplement reorder labels but are not the only accessible name.
- Chart tooltip inspection is optional enhancement, never the only way to obtain the chart's meaning. Provide a concise text summary and an accessible tabular/list representation of daily values and e1RM values for assistive technology.
- Selecting a calendar day reveals its workout details immediately below the calendar and moves neither scroll nor focus unexpectedly. `Close workout details` collapses it and returns focus to the selected day.
- No control in this phase deletes, resets, or overwrites workout data. No confirmation dialog is required.

---

## Chart Contract

- Recharts receives literal colors only from `chartTheme.js`; tokenized own-SVG colors are applied through style/CSS where supported. Theme change triggers a rerender without page reload.
- Grid, axes, tooltips, labels, selection outlines, and series all meet light/dark contrast needs. Axis and legend type use the 11px Label role; tooltip copy uses Body.
- e1RM chart has a stable plotting height, visible zero-safe domain, unit-aware Y axis, and no misleading interpolation across absent source points. Dates remain chronological.
- Daily Trend keeps exactly 7, 28, or 90 daily records and bars, including zeros. Tick thinning is visual only. A chart-wide pointer/touch interaction may resolve the nearest day so narrow 90-day bars remain inspectable.
- Charts disable entry animation when `prefers-reduced-motion: reduce` is active. Data updates may crossfade only with `--dur-med` and `--ease-emph`; no count-up, bouncing, or repeated animation occurs on Progress.
- The Body heatmap supplies visible legends and text equivalents. Color never stands alone: labels, numeric values, selected outlines, and Sheet content carry the same meaning.
- Balance tracks begin at zero and use a common 100% scale. Push plus pull percentages total 100 when mapped data exists; the zero-data state does not render a fabricated 50/50 split.

---

## Accessibility Contract

- Screen landmark: `<section aria-labelledby="progress-title">`; group cards use headings in logical order without skipped levels.
- The range control exposes one selected option; Body mode exposes one pressed/selected option; Customize toggles use native checkbox semantics or `role="switch"` with an explicit accessible label.
- Every control is keyboard reachable in visual order. Focus is never hidden behind the fixed NavBar or a Sheet edge. Focus indicators use a high-contrast tokenized outline, not color change alone.
- Minimum target size is 48px by 48px for segmented options, selects, switches, reorder actions, Review/Add/Close actions, selectable muscle alternatives, and calendar day actions. Where the 12-week calendar cannot fit, use contained horizontal scrolling rather than shrinking targets.
- SVG heatmap paths are not the sole accessible controls. Provide equivalently named muscle chips/list controls; decorative anatomy shapes are hidden from the accessibility tree when equivalent controls are present.
- Chart containers have short descriptive labels. Assistive-technology data representations include dates, values, units, and zero days without forcing users through a 90-item aria-label.
- Loading and save/error messages use a polite live region; blocking calculation failure uses `role="alert"`. Routine range or selection changes are not noisily announced beyond control state.
- Text and controls support browser text scaling to 200% without clipping or horizontal page scroll. Long labels wrap in sheets and detail rows.
- Light and dark themes satisfy WCAG AA for text and meaningful non-text indicators; selected/unselected and enabled/disabled states remain distinguishable in monochrome.

---

## Responsive Contract

| Viewport | Contract |
|----------|----------|
| 360px phone | 16px page/card spacing; toolbar stacks when needed; e1RM heading and selector stack; Trend selectors are one column; charts use the full inner width; Sheet rows wrap labels before controls shrink |
| 390px phone | Same single column; toolbar may share a row only if every control retains its target and label; no layout depends on the extra 30px |
| Above 420px | Keep the phone composition centered in `.app-shell`; do not add a rail, multi-column dashboard, or tablet-only information architecture |

The page itself never scrolls horizontally. The 12-week calendar may use a labeled, contained horizontal scroller. Sheets occupy the phone width with safe-area padding and become centered bottom sheets within the narrow desktop column.

---

## Motion and Reduced Motion

- Sheet open/close and group reorder feedback use existing `--dur-med`/`--ease-emph`; control state changes use `--dur-short`/`--ease-std`.
- Range changes update values in place and do not jump scroll position. Chart transitions are subtle opacity/shape updates, never a replaying flourish.
- Under `prefers-reduced-motion: reduce`, rely on the existing global guard and explicitly disable Recharts animation, Sheet drag-settle animation, skeleton shimmer, and group reorder animation. All content and state changes remain immediately understandable without motion.

---

## Preservation and Non-Regression Contract

- Use the existing pure analytics and saved preference shapes. Do not change formulas, session records, units, exercise identifiers, local persistence, Firebase behavior, or offline behavior.
- Preserve e1RM series, training insights and evidence, daily metric choices, all individual daily data, range summary, planned-day target, 12-week calendar/history controls, selected-day details, heatmap modes, priorities, coverage gaps, target editing, readiness cautions, verified exercise suggestions, Add exercise callback, group balance, and push/pull ratio.
- The 7/28/90 selection may filter only analytics already defined as range-sensitive. It cannot aggregate daily bars or reinterpret full-history/12-week features.
- Migrate remaining hard-coded Progress inline styles and SVG colors to the approved token/chart-theme mechanisms. No redesign requirement justifies removing analytics content.

---

## UI Element Inventory for Consideration Probe

The later UI-consideration probe should treat the following as the canonical element/surface inventory. The `Kinds` column is an authored classification override to avoid heuristic under-classification.

| ID | Surface / element description | Kinds |
|----|-------------------------------|-------|
| E1 | Progress global toolbar with 7/28/90 segmented range navigation and Customize dashboard action; persists preference changes | nav, interactive-control |
| E2 | e1RM progression card with exercise form control, full-history line-chart media, insight collection, summary content, and local empty/error states | form, media, list-collection, static-content, interactive-control |
| E3 | Daily Trend card with range-summary collection, exercise/metric form controls, 7/28/90 individual daily bar-chart media, and accessible data list | form, media, list-collection, static-content, interactive-control |
| E4 | Twelve-week calendar collection with Earlier/Later/Current navigation, selectable populated days, and workout-detail collection | nav, list-collection, interactive-control, static-content |
| E5 | Body heatmap card with Coverage/Set volume control, front/back SVG media, legend, priority/coverage collections, and Review action | media, list-collection, interactive-control, static-content |
| E6 | Muscle guidance modal Sheet with missed-muscle selector collection, weekly-target form, recent-history collection, readiness caution, suggestion collection, and Add exercise controls | form, list-collection, nav, interactive-control, static-content |
| E7 | Balance card with push/pull ratio media, methodology text, group-bar collection, and zero-data states | media, list-collection, static-content |
| E8 | Customize dashboard modal Sheet with four switch rows, reorder controls, save feedback, and long group labels | form, list-collection, interactive-control, static-content |
| E9 | Whole-screen loading, no-session empty, global calculation error, preference-save error, and all-groups-hidden state surfaces | static-content, interactive-control |

---

## UI Considerations

Applicable state considerations resolved: 64/64 with explicit verification through the contracts above.

- **E1 — Global toolbar:** While sessions hydrate, preserve the toolbar footprint without applying stale range data; if preference persistence fails, retain the prior confirmed selection and announce the documented retry message; at narrow widths or with long labels, stack controls without clipping and keep every target at least 48px.
- **E2 — e1RM progression:** Render the documented weighted-set empty state, static loading skeleton, isolated actionable error, latest-value/chart/summary populated state, and local partial state without hiding other groups; insight collections handle zero, one, or many entries with correct copy, and long exercise/evidence text wraps or uses accessible select truncation.
- **E3 — Daily Trend:** Render loading and isolated error states without replacing unaffected analytics; represent empty and partial metric selections locally; populated ranges contain exactly 7, 28, or 90 individual daily values including zeros; summaries and accessible values support zero, one, or many records, while controls and labels stack or wrap without horizontal page overflow.
- **E4 — Training calendar:** Preserve the calendar footprint during loading, keep navigation usable when valid data exists, and isolate failures; empty periods remain navigable, populated days expose selection and details, incomplete workout details omit no available fields, and zero/one/many sessions use correct singular/plural copy; the calendar uses a contained labeled horizontal scroller and wraps long workout text.
- **E5 — Body heatmap:** Render the documented no-mapped-data and full-coverage states, loading placeholder, isolated calculation error, populated map/legend, and partial muscle coverage without fabricating values; priority and gap collections handle zero, one, or many muscles, and legends/guidance entry points wrap without horizontal page overflow.
- **E6 — Muscle guidance Sheet:** Loading and save failures retain the modal and recoverable controls; empty history or suggestion collections use the documented copy, while partial and populated guidance preserve available targets, cautions, and recommendations; zero/one/many muscles and suggestions remain correctly labeled, Sheet content scrolls vertically, and long names/cautions wrap before controls shrink.
- **E7 — Balance:** Render documented zero-data, loading, and isolated error states without a fabricated 50/50 ratio; populated and partial mapped data show only supported percentages and bars; group collections handle zero, one, or many rows with common scales, and methodology/group labels wrap within the card.
- **E8 — Customize dashboard Sheet:** Show all four groups in populated state and the documented all-hidden outcome when none are enabled; preference-save failure keeps prior confirmed settings and the Sheet open; switches/reorder controls support boundary-disabled, partial, and normal states, while zero/one/many visible groups remain recoverable and long labels wrap without shrinking targets.
- **E9 — Whole-screen states:** Hydration uses static tonal skeletons rather than flashing empty content; the no-session, global-error, save-error, and all-hidden surfaces use the exact actionable copy in the Copywriting Contract; global replacement occurs only when no analytics can be derived, and all state text wraps at 200% zoom without horizontal page scrolling.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| Manual project design system | Existing CSS tokens, hand-built Material 3 primitives, Recharts theme adapter | Approved project architecture; normal code review |
| shadcn official | None | Not applicable; do not initialize |
| Third-party registries | None | Prohibited for this phase |

Recharts and Lucide are existing runtime dependencies, not UI registries. Do not add packages, registry blocks, remote component code, MUI, Tailwind, or `@material/web`.

---

## Verification Contract

- Manually verify 360px and 390px in both light and dark themes, including full/partial/empty/error/all-hidden states and both Sheets.
- Verify keyboard order, visible focus, Escape and browser/Android back behavior, focus return, 48px targets, 200% text scaling, and reduced motion.
- Verify range changes retain exactly 7/28/90 individual daily data records, including zero days, while e1RM and calendar history retain their established semantics.
- Verify no Progress CSS/JSX/SVG color literals remain except the centrally approved JS chart palette, no new inline-style system is introduced, and Phase spacing uses only 4/8/16/24/32/48/64.
- Run existing project tests, timezone tests, production build, and lint according to milestone gates; Phase 1 adds no dedicated component-test requirement.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-08-14
