# Phase 2: History and Weight Screens - Context

**Gathered:** 2026-08-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract and modernize workout History and bodyweight tracking as dedicated Android-first screens while preserving all existing local persistence, Firebase synchronization, edit/delete semantics, dates, units, and stored data contracts.

</domain>

<decisions>
## Implementation Decisions

### Editing records
- **D-01:** Editing a past workout or weigh-in opens a focused Material bottom sheet with explicit Save and Cancel actions.
- **D-02:** Failed validation or persistence keeps the sheet open, preserves the draft, and shows recoverable feedback. The confirmed record remains unchanged until saving succeeds.
- **D-03:** Destructive deletion remains a separate confirmed action rather than being combined with edit submission.

### Workout History organization
- **D-04:** History is grouped by calendar month, newest month and newest sessions first.
- **D-05:** Session cards remain expandable for complete exercises, sets, notes, dates, and summaries; grouping must not hide or aggregate stored workout details.
- **D-06:** Month headings and expansion state must remain usable in the established narrow phone layout without introducing a page-level horizontal scroller.

### Weight screen hierarchy
- **D-07:** The Weight screen leads with latest-weight and net-change summary, followed by the trend chart and then weigh-in history.
- **D-08:** Adding and editing weigh-ins uses the same focused sheet interaction model, with existing unit and date behavior preserved.
- **D-09:** Trend calculations and displayed units reuse current behavior; this phase changes presentation and screen ownership, not analytics or storage semantics.

### the agent's Discretion
- Exact card density, icon placement, empty-state illustrations, chart spacing, and transition details may follow the approved tokens and shared Material primitives.
- The planner may choose internal component boundaries and pure helper extraction as long as `App.jsx` retains state/persistence ownership and screens remain presentation-focused.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Approved redesign
- `../docs/superpowers/specs/2026-08-14-android-redesign-design.md` — Authoritative Android-first visual structure, component architecture, responsive behavior, and sequencing.
- `.superpowers/sdd/2026-08-14-android-redesign-1-foundation/progress.md` — Claude implementation ledger and established redesign patterns to preserve.

### Project contracts
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, and fixed boundary.
- `.planning/REQUIREMENTS.md` — HIST-01, HIST-02, WGHT-01, WGHT-02, and ARCH-01 acceptance requirements.
- `.planning/PROJECT.md` — Offline-first, Firebase, phone-layout, accessibility, and architecture constraints.
- `.planning/phases/01-progress-completion/01-UI-SPEC.md` — Existing token, typography, spacing, responsive, theme, and shared-component conventions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/Sheet.jsx`: Existing focus-managed, history-aware Material sheet suitable for edit forms and confirmations.
- `src/components/Card.jsx`, `Button.jsx`, and shared form primitives: Established Material presentation and 48px interaction targets.
- `src/charts/useThemeTokens.js`: Live theme roles for the existing bodyweight trend chart.
- Existing `WeightTab` and History rendering in `src/App.jsx`: Behavioral source of truth during extraction.

### Established Patterns
- `src/screens/HomeScreen.jsx`, `ProgressScreen.jsx`, and `SettingsScreen.jsx` show the approved screen-owned presentation with `App.jsx` callback adapters.
- Mutations update local state/storage first and optionally mirror to owner-scoped Firebase; extraction must not bypass these callbacks.
- Local ISO calendar dates, stored exercise names, storage namespaces, Firestore paths, and weight units are persisted contracts.

### Integration Points
- New `HistoryScreen` and `WeightScreen` receive data and mutation callbacks from `App.jsx`.
- Editing sessions must reuse or safely adapt the existing workout draft validation and persistence path without changing completed-record schemas.
- Weight add/edit/delete must continue through `persistWeights`, `saveCloudBodyweight`, and `deleteCloudBodyweight` ownership in `App.jsx`.

</code_context>

<specifics>
## Specific Ideas

- Bottom sheets should feel like the existing Progress guidance/customization sheets rather than a separate form system.
- History should read like a monthly training journal: month heading, concise workout card, expandable details.
- Weight should answer “where am I now and how has it changed?” before presenting data-entry history.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-History and Weight Screens*
*Context gathered: 2026-08-17*
