# Codebase Structure

**Analysis Date:** 2026-08-14

## Directory Layout

```text
workout-tracker/
├── src/                    # Authored React application and domain logic
│   ├── components/         # Reusable UI primitives with adjacent CSS
│   ├── screens/            # Top-level tab-oriented screen components
│   ├── data/               # Static workout plan and form-guide registries
│   ├── charts/             # Chart theme constants and React theme hook
│   ├── design/             # Global design tokens, base styles, theme selection
│   ├── assets/             # Source images bundled by Vite
│   ├── App.jsx             # Application composition root and state owner
│   └── main.jsx            # Browser bootstrap
├── public/                 # Static PWA assets copied verbatim by Vite
├── android/                # Capacitor-generated/customized Android project
├── dist/                   # Generated production web build
├── .planning/codebase/     # GSD codebase reference documents
├── .superpowers/sdd/       # Design/spec artifacts, not runtime code
├── index.html              # Vite HTML entry
├── package.json            # Dependencies and npm scripts
├── vite.config.js          # Vite/React build and chunk configuration
├── eslint.config.js        # ESLint flat configuration
├── capacitor.config.json   # Native wrapper configuration
├── firebase.json           # Hosting and Firestore deployment configuration
├── firestore.rules         # Owner-scoped database authorization rules
└── README.md               # Setup, architecture-sensitive rules, and operations
```

## Directory Purposes

**`src/`:**
- Purpose: Holds all authored JavaScript/JSX and application CSS.
- Contains: Bootstrap, central application state, feature/domain modules, views, data, and co-located unit tests.
- Key files: `src/main.jsx`, `src/App.jsx`, `src/firebase.js`, `src/stats.js`, `src/index.css`

**`src/components/`:**
- Purpose: Provides reusable presentational and interaction primitives.
- Contains: One JSX component and usually one same-named CSS file per primitive; `src/components/index.js` re-exports the public set.
- Key files: `src/components/Button.jsx`, `src/components/Sheet.jsx`, `src/components/NavBar.jsx`, `src/components/index.js`

**`src/screens/`:**
- Purpose: Separates substantial top-level tab views from the application orchestrator.
- Contains: Controlled React screens plus same-named CSS.
- Key files: `src/screens/HomeScreen.jsx`, `src/screens/ProgressScreen.jsx`, `src/screens/SettingsScreen.jsx`

**`src/data/`:**
- Purpose: Defines static domain catalogs separately from presentation.
- Contains: Five-day workout templates, equipment variants, muscle metadata, and form instructions, with co-located tests.
- Key files: `src/data/exercises.js`, `src/data/formGuide.js`

**`src/charts/`:**
- Purpose: Adapts design theme state to chart rendering.
- Contains: Light/dark chart token maps and the hook that observes theme changes.
- Key files: `src/charts/chartTheme.js`, `src/charts/useThemeTokens.js`

**`src/design/`:**
- Purpose: Centralizes visual tokens, resets/base styling, and theme preference behavior.
- Contains: CSS custom properties and JavaScript theme initialization/persistence.
- Key files: `src/design/tokens.css`, `src/design/base.css`, `src/design/theme.js`

**`public/`:**
- Purpose: Supplies static files that must retain their names in the production root.
- Contains: Service worker, web manifest, install icons, favicon, and SVG sprite.
- Key files: `public/sw.js`, `public/manifest.webmanifest`, `public/icons.svg`

**`android/`:**
- Purpose: Hosts the native Android shell generated and synchronized by Capacitor.
- Contains: Gradle configuration, Android resources, native application metadata, generated plugin wiring, and synchronized web assets under `android/app/src/main/assets/public/`.
- Key files: `android/app/src/main/java/com/pocketgymlog/app/MainActivity.java`, `android/app/src/main/AndroidManifest.xml`, `android/app/build.gradle`

**`dist/`:**
- Purpose: Contains deployable Vite output consumed by Firebase Hosting and copied into Capacitor.
- Contains: Minified hashed bundles and copied `public/` assets.
- Key files: `dist/index.html`, `dist/sw.js`, `dist/assets/`

**`.planning/codebase/`:**
- Purpose: Stores generated current-state maps for GSD planning and execution.
- Contains: Architecture, structure, stack, integrations, conventions, testing, and concern documents.
- Key files: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`

## Key File Locations

**Entry Points:**
- `index.html`: Vite HTML entry and root container.
- `src/main.jsx`: React/browser entry point.
- `src/App.jsx`: Application composition root.
- `public/sw.js`: PWA service-worker entry.
- `android/app/src/main/java/com/pocketgymlog/app/MainActivity.java`: Android/Capacitor entry.

**Configuration:**
- `package.json`: Runtime dependencies, version, and development/build/test scripts.
- `vite.config.js`: Vite React plugin, build targets, and manual chunks.
- `eslint.config.js`: JavaScript/React lint rules.
- `capacitor.config.json`: Android application identity, web directory, and native Firebase auth plugin settings.
- `firebase.json`: Firebase Hosting routing/cache headers and Firestore rules deployment.
- `firestore.rules`: Per-UID Firestore access control.
- `.env.example`: Names only of required Vite/Firebase environment settings; never put secrets into committed files.
- `.firebaserc`: Firebase project selection.

**Core Logic:**
- `src/App.jsx`: Navigation, state transitions, persistence coordination, and feature composition.
- `src/draft.js`: Session/draft construction and set completeness.
- `src/stats.js`: Analytics and recommendation selectors.
- `src/firebase.js`: Authentication and Firestore adapter.
- `src/backup.js`: Backup validation, merge, and replacement.
- `src/cloudData.js`: Cloud/local reconciliation and tombstone filtering.
- `src/data/exercises.js`: Workout plan and stable exercise identities.
- `src/data/formGuide.js`: Muscle registry and exercise instructions.
- `src/dateUtils.js`: Local calendar-date operations.

**Testing:**
- `src/*.test.js`: Co-located domain/helper unit tests.
- `src/data/*.test.js`: Co-located static-data consistency tests.
- `package.json`: `node --test src` test command and multi-timezone test command.
- `android/app/src/test/`: Generated Android unit-test location.
- `android/app/src/androidTest/`: Generated Android instrumentation-test location.

**Styling and Assets:**
- `src/index.css`: Application-level CSS entry and legacy/global feature styles.
- `src/design/tokens.css`: Design token variables.
- `src/design/base.css`: Baseline element styles.
- `src/components/*.css`, `src/screens/*.css`: Component/screen-local styling.
- `src/assets/`: Bundled source assets.
- `public/`: Root-served PWA assets.

## Naming Conventions

**Files:**
- React components use PascalCase `.jsx`: `src/MuscleHeatmap.jsx`, `src/components/SegmentedButtons.jsx`.
- Component CSS matches its JSX basename: `src/screens/ProgressScreen.jsx` with `src/screens/ProgressScreen.css`.
- Pure feature/helper modules use camelCase `.js`: `src/workoutSummary.js`, `src/equipmentPrefs.js`.
- Tests are co-located and append `.test.js`: `src/progression.test.js`.
- Static domain files use descriptive camelCase names: `src/data/formGuide.js`.
- Configuration uses ecosystem-standard names: `vite.config.js`, `firebase.json`, `capacitor.config.json`.

**Directories:**
- Source grouping directories use lowercase plural or role names: `src/components/`, `src/screens/`, `src/charts/`, `src/design/`, `src/data/`.
- Generated/platform directory names follow their tools: `dist/`, `android/`, `.firebase/`.

## Where to Add New Code

**New Domain Feature:**
- Primary code: Add a focused camelCase module under `src/` such as `src/newFeature.js`; keep it pure when it represents calculations, validation, or transformations.
- Tests: Add `src/newFeature.test.js` beside it.
- Wiring: Import it into `src/App.jsx` or the consuming screen; avoid placing testable rules inline in event handlers.

**New Top-Level Screen/Tab:**
- Implementation: Add `src/screens/FeatureScreen.jsx` and `src/screens/FeatureScreen.css`.
- Wiring: Add navigation metadata and controlled rendering in `src/App.jsx`; pass state and callbacks as props.
- Tests: Put pure screen-specific selectors in `src/<feature>.js` with `src/<feature>.test.js` because the current suite tests non-DOM modules directly.

**New Reusable Component:**
- Implementation: Add `src/components/ComponentName.jsx` with `src/components/ComponentName.css`.
- Export: Add the component to `src/components/index.js` when it is part of the shared primitive API.
- Usage: Import shared primitives through `src/components/index.js`.

**New Analytics or Chart:**
- Calculations: Add or extend pure selectors in `src/stats.js`; split a coherent large domain into a new `src/<feature>.js` module rather than expanding the central component.
- View: Add dashboard UI in `src/ProgressDashboard.jsx` or a dedicated component imported by it.
- Theme: Put shared chart tokens/hooks in `src/charts/` and consume design tokens instead of hard-coding a new independent palette.
- Tests: Add calculation coverage to `src/stats.test.js` or a matching new test module.

**New Static Exercise or Guide Data:**
- Workout definition: Edit `src/data/exercises.js`.
- Form/muscle metadata: Edit `src/data/formGuide.js`.
- Tests: Update `src/data/exercises.test.js` and `src/data/formGuide.test.js`.
- Constraint: Preserve existing exercise names because they are persisted history keys; implement a migration for any rename.

**New Persistence Behavior:**
- Profile-scoped local helper: Add a focused module under `src/`, following `src/draftStorage.js` or `src/equipmentPrefs.js`.
- Firestore operation: Add it to `src/firebase.js`, retain UID scoping and timeout behavior, and call it through `App`'s offline-first mutation flow.
- Merge/migration logic: Put deterministic transforms in `src/backup.js` or `src/cloudData.js` with direct tests.
- Firestore authorization: Update `firestore.rules` when the schema path changes.

**Utilities:**
- Shared helpers: Use a feature-named `src/<purpose>.js` module rather than a generic catch-all utilities file.
- Dates: Always add calendar-date helpers to `src/dateUtils.js` and exercise them across timezones.
- UI-only helpers: Keep tiny helpers near the owning component; extract reusable or testable behavior to `src/`.

**Platform/PWA Changes:**
- Static PWA behavior: Update `public/sw.js` or `public/manifest.webmanifest`; rebuild to refresh `dist/`.
- Capacitor configuration: Update `capacitor.config.json`, then run the sync command rather than manually editing synchronized web assets.
- Native Android code/resources: Add authored native changes beneath `android/app/src/main/`; do not edit `android/app/src/main/assets/public/` directly.

## Special Directories

**`dist/`:**
- Purpose: Production web build deployed to Firebase Hosting and used as Capacitor's `webDir`.
- Generated: Yes, by `npm run build`.
- Committed: Yes in the current repository; regenerate instead of hand-editing.

**`android/app/src/main/assets/public/`:**
- Purpose: Synchronized copy of the web build embedded in the Android application.
- Generated: Yes, by Capacitor sync.
- Committed: Yes in the current repository; update through `npm run android:sync`.

**`node_modules/`:**
- Purpose: Installed npm dependencies.
- Generated: Yes, by `npm install`.
- Committed: No.

**`.firebase/`:**
- Purpose: Local Firebase deployment/cache metadata.
- Generated: Yes.
- Committed: No application source should be added here.

**`.superpowers/sdd/`:**
- Purpose: Stores dated design/specification artifacts for planned work.
- Generated: Workflow-produced rather than runtime-generated.
- Committed: Yes in the current repository.

**`.planning/codebase/`:**
- Purpose: Stores GSD-generated reference maps consumed by future planning and execution.
- Generated: Yes, by codebase mapping workflows.
- Committed: Project-dependent; it exists in the current worktree and should not contain runtime code.

---

*Structure analysis: 2026-08-14*
