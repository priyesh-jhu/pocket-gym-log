# Coding Conventions

**Analysis Date:** 2026-08-14

## Naming Patterns

**Files:**
- Use camelCase `.js` names for domain utilities and matching colocated tests: `src/dateUtils.js` and `src/dateUtils.test.js`, `src/workoutSummary.js` and `src/workoutSummary.test.js`.
- Use PascalCase `.jsx` names for React components and screens: `src/ErrorBoundary.jsx`, `src/components/Sheet.jsx`, and `src/screens/HomeScreen.jsx`.
- Pair component styles by basename in the same directory, such as `src/components/Button.jsx` with `src/components/Button.css`.
- Use lowercase directory names organized by role: `src/components/`, `src/screens/`, `src/charts/`, `src/data/`, and `src/design/`.

**Functions:**
- Use camelCase verbs for functions (`loadPrefs`, `createWorkoutSummary`, `reconcileCloudData`) and `use...` for hooks (`src/charts/useThemeTokens.js`).
- Name event handlers and callbacks for their action (`onClose`, `requestSessionExit`, `signInWithGoogle`).
- Use short local factory names only inside tests (`mkSet`, `mkSession`, `fakeStorage`).

**Variables:**
- Use camelCase for local values and state (`activeProfile`, `equipmentPrefs`, `restSeconds`).
- Use uppercase snake case for module constants and storage keys (`TRACKING_TYPES`, `REST_TIMER_OPTIONS`, `CUSTOM_EXERCISES_KEY`).
- Use descriptive boolean names or predicates (`firebaseConfigured`, `draftHasContent`, `isCompleteSet`).

**Types:**
- The project is JavaScript, not TypeScript; object shapes are implicit in data and functions. Preserve established record keys such as `date`, `day`, `exercises`, `sets`, `weight`, `reps`, and `unit`.
- Use PascalCase for classes and React components (`ErrorBoundary`, `BrokenNotification`, `NotificationApi`).
- Treat persisted exercise names as stable identifiers. `src/data/exercises.test.js` freezes them because renaming orphans user history.

## Code Style

**Formatting:**
- No formatter configuration is present. Match the surrounding file rather than applying a repository-wide reformat.
- The dominant readable style uses two-space indentation, semicolons, double-quoted strings, spaces inside object literals, and spaces around operators; examples are `src/dateUtils.js`, `src/backup.js`, and `src/equipmentPrefs.test.js`.
- Some newer utility and test code is deliberately compact (`src/exerciseTracking.js`, `src/trainingInsights.test.js`, portions of `src/App.jsx`). Do not propagate dense one-line formatting into otherwise expanded files.
- Keep JSX props spaced and component bodies readable as in `src/components/Sheet.jsx` and `src/screens/HomeScreen.jsx`.

**Linting:**
- Run ESLint 10 through `npm run lint`; configuration is `eslint.config.js`.
- Apply `@eslint/js` recommended rules, React Hooks flat recommended rules, and Vite React Refresh rules to all `.js` and `.jsx` files.
- Browser globals are available to source files; Node globals are additionally enabled for `**/*.test.{js,jsx}`.
- Unused variables are errors, except unused rest siblings. Use targeted disable comments only when a hook dependency is intentionally excluded, as in `src/App.jsx`.
- Generated output in `dist/` and `android/app/src/main/assets/public/` is ignored by lint.

## Import Organization

**Order:**
1. Import framework and third-party packages (`react`, `recharts`, Capacitor, Firebase, Lucide).
2. Import project domain modules using relative paths with explicit extensions.
3. Import components and screens, then side-effect CSS/assets where relevant.

Tests conventionally import `node:test`, then `node:assert/strict`, then the module under test. See `src/restTimer.test.js` and `src/dateUtils.test.js`.

**Path Aliases:**
- No source path aliases are configured. Use relative paths such as `./dateUtils.js` and `../package.json`.
- Include `.js` or `.jsx` extensions in local ESM imports.
- Components may use the barrel at `src/components/index.js`; domain utilities are imported directly from their defining module.

## Error Handling

**Patterns:**
- Make local-storage and optional-device behavior best effort: catch access failures and return safe sentinels (`null`, `{}`, or `false`) in `src/equipmentPrefs.js`, `src/draftStorage.js`, and `src/design/theme.js`.
- Prefer total domain functions for untrusted persisted/imported data. `src/backup.js` returns `{ ok, data, error }` results and filters malformed records rather than throwing.
- Throw actionable errors when a required external integration cannot operate, such as missing Firebase configuration in `src/firebase.js`; catch these at the UI boundary in `src/App.jsx`, log the original error, and update visible status.
- Use promise `.catch(...)` for fire-and-forget asynchronous work such as service worker registration in `src/pwa.js` and cloud writes in `src/App.jsx`.
- Keep React’s final safety net in `src/ErrorBoundary.jsx`; do not let malformed persisted data permanently blank the app.

## Logging

**Framework:** console

**Patterns:**
- Use `console.error` only at integration or render boundaries where failures require diagnosis (`src/App.jsx`, `src/pwa.js`, `src/ErrorBoundary.jsx`).
- Keep pure domain utilities silent; communicate expected invalid input through return values.
- Do not log routine state changes, user data, Firebase configuration, or storage payloads.

## Comments

**When to Comment:**
- Explain invariants and non-obvious failure modes: local calendar dates must not use UTC conversion in `src/dateUtils.js`; imported shapes must protect downstream rendering in `src/backup.js`; React and persisted storage must stay synchronized in `src/App.jsx`.
- Use comments to record why a workaround or constraint exists, not to narrate obvious syntax.
- Section banners are accepted in large modules such as `src/App.jsx`, `src/stats.js`, and `src/backup.js`.

**JSDoc/TSDoc:**
- Use short JSDoc summaries for exported or subtle pure functions, as in `src/stats.js`, `src/dateUtils.js`, and `src/cloudData.js`.
- Formal `@param`/`@returns` annotations are not established. Keep documentation concise unless an implicit object shape would otherwise be ambiguous.

## Function Design

**Size:** Keep domain functions small, pure, and individually exported where practical (`src/progression.js`, `src/restTimer.js`, `src/dateUtils.js`). UI orchestration remains centralized in the large `src/App.jsx`; new reusable logic should be extracted rather than added inline.

**Parameters:**
- Pass dependencies explicitly when behavior must be testable without browser/native APIs, as `announceRestComplete({ NotificationApi, navigatorApi, isNative })` does in `src/restTimer.js`.
- Use options objects for related optional inputs and defaults (`registerWorkoutPWA({ onUpdate } = {})`, `saveCloudSnapshot(uid, data, { replace = false } = {})`).
- Accept deterministic time/date parameters where output depends on time (`todayISO(now)`, analytics `todayIso`, storage `now`).
- Default absent collections/objects defensively when callers may supply partial data.

**Return Values:**
- Do not mutate caller-owned domain objects. Return new objects/arrays for updates, merges, and preferences; tests in `src/equipmentPrefs.test.js` and `src/customWorkouts.test.js` enforce this.
- Return explicit sentinels for expected absence (`null`, `[]`, `{}`, `false`) and structured result objects when callers need error details.
- Normalize calculations and persisted records before returning them so rendering code receives stable shapes.

## Module Design

**Exports:**
- Use named exports for domain constants and pure functions. Use default exports for React components and screens.
- Keep browser/Firebase side effects behind exported functions; importing a domain module should not mutate state.
- Keep data definitions and their lookup helpers together in `src/data/exercises.js` and `src/data/formGuide.js`.

**Barrel Files:**
- `src/components/index.js` is the only established barrel. Add reusable UI primitives there when they are intended for app-wide consumption.
- Import domain modules directly; do not introduce a broad `src/index.js` barrel.

---

*Convention analysis: 2026-08-14*
