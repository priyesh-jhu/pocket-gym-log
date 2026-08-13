# Workout Tracker

A lightweight, offline-first PWA for tracking workouts. Data is saved locally, with optional private Firebase sync through Google sign-in and JSON backup/restore.

## Firebase Sync

Copy `.env.example` to `.env.local` and fill in the Firebase web-app config values. In the Firebase console, enable Google under Authentication, create a Firestore database, and publish `firestore.rules`. The rules only allow an authenticated user to access documents beneath their own UID.

After configuration, use **Google Sign-in** in the app header. Each Google account gets one isolated workout log, both in Firestore and in UID-scoped device storage. Subsequent workout, bodyweight, import, and equipment-preference changes sync automatically while localStorage remains available offline. Signed-out activity is kept separately in guest mode and is never automatically merged into an account. During the upgrade from the old named-profile version, the first Google account on an existing installation claims the previously active local profile once; later accounts cannot claim or read it.

To inspect saved data, open Firebase Console → Firestore Database → Data, then expand `users` → your Firebase UID. Workout sessions are individual documents under `sessions`, weigh-ins are under `bodyweights`, and account/equipment preferences are in `settings/main`. Authentication → Users shows the matching Google account and UID. Older `profiles/main` or `profiles/default` documents are retained as read-only migration sources and are no longer updated.

### Deploy to Firebase Hosting

The repository is connected to the `pocket-gym-log` Firebase project. From the app directory, authenticate once and deploy:

```bash
npx firebase-tools login
npm run build
npx firebase-tools deploy --only hosting,firestore:rules
```

For later updates, login is not normally required again. Run these two commands from `workout-tracker/` whenever you want to publish the latest version:

```bash
npm run build
npx firebase-tools deploy --only hosting,firestore:rules
```

Firebase serves the production build at `https://pocket-gym-log.web.app` and `https://pocket-gym-log.firebaseapp.com`. The hosting configuration serves `dist/`, rewrites SPA routes to `index.html`, and caches Vite's fingerprinted assets. Add any custom production domain under Firebase Console → Hosting → Add custom domain, then add that domain under Authentication → Settings → Authorized domains.

## Android App

The same React application is packaged as a native Android app with Capacitor. It keeps the existing offline storage and Firestore sync, while Google sign-in uses the native Firebase Authentication flow. Android Studio and its bundled JDK are required to compile or run the native project.

Complete this one-time Firebase setup before the first native build:

1. In Firebase Console → Project settings → Your apps, add an **Android** app with package name `com.pocketgymlog.app`.
2. Add the SHA-1 fingerprint for the machine that will build the app. After Android Studio is installed, obtain the debug fingerprint with `cd android && ./gradlew signingReport`.
3. Download `google-services.json` and place it at `android/app/google-services.json`. This machine-specific file is intentionally ignored by Git.
4. Confirm that Google is enabled under Firebase Console → Authentication → Sign-in method. Keep the Firebase web configuration in `.env.local`, because the shared JavaScript layer still uses the Firebase Web SDK for authentication state and Firestore.

To open and run the project:

```bash
npm install
npm run android:open
```

The command builds the web app, synchronizes it into the Android project, and opens Android Studio. In Android Studio, let Gradle finish syncing, select an emulator or connected device, and click **Run**. Use `npm run android:run` to run from the terminal after an emulator/device is available, or `npm run android:sync` whenever web code or native dependencies change.

For a Play Store release, use Android Studio → Build → Generate Signed Bundle / APK, create or select a release keystore, and generate an Android App Bundle (`.aab`). Keep the keystore and passwords outside this repository. Add the release certificate's SHA-1 to the same Firebase Android app before testing Google sign-in in a release build.

## The Plan: 5-Day Split

- **MON Push**: Chest, shoulders, triceps, serratus
- **TUE Pull**: Back, biceps, rear delts, traps
- **WED Legs**: Quads, hamstrings, glutes, calves, adductors
- **THU Core+HIIT**: Core, obliques, explosive moves
- **FRI Full Body**: Deadlifts, back extensions, rows, carries, calves

Each day includes a warm-up with dynamic drills, a coach note, 5 exercises, and a cardio finisher.

## Free Weights or Machines

Every one of the 25 exercises has two variants—a free-weight version and a machine version—switchable per exercise via a toggle on each card. Machine variants are tracked as **separate exercises**: a machine chest press has its own PR and its own progress chart, never mixing with barbell numbers. All 50 variants include a form guide with setup, execution, breathing, common mistakes, and a body map.

Switching a card that already has sets entered asks for confirmation first, since the numbers don't carry across. Your choice is remembered per exercise and per profile.

## Key Features

- **Form guides**: 50 variant guides with body maps and exercise cues
- **PR tracking**: One-rep max estimation for each variant
- **Progress charts**: Per-exercise history and trends
- **Bodyweight logging**: With 7-day trend line
- **Plate calculator**: Quick load planning
- **Rest timer**: Starts when a set is completed, survives refresh/backgrounding, supports `+30s`, and uses vibration, web notifications, or Android local notifications when available
- **Draft recovery**: In-progress workouts autosave per account and recover after refreshes or crashes
- **Progressive overload guidance**: Uses the most recent working sets and the exercise's rep target to suggest increasing, repeating, or slightly reducing weight; configurable lb/kg increments are saved per account and weights are never changed automatically
- **Workout summaries**: After saving, shows duration, exercises, sets, total volume, new PRs, improvements over the previous session, and notes
- **Training consistency**: A navigable activity calendar with clickable workout details plus rolling 28-day adherence to the five-day plan
- **Custom workouts**: Create reusable custom exercises, reorder them, and save account-scoped templates with set counts, targets, equipment, day, and rest defaults
- **Training insights**: Conservatively flags three-session plateaus and sustained declines, showing the supporting e1RM values and a practical next step
- **Training analytics**: Browse older periods and chart 4/12/26/52 weeks by exercise, volume, max weight, estimated 1RM, or frequency
- **Readiness check-ins**: Optionally save energy, sleep, soreness, and pain context with each workout
- **Strength goals**: Track account-scoped exercise targets with progress bars and completion states
- **Offline PWA**: Registered app-shell caching, valid install icons, connection status, install prompting, and user-controlled safe updates

## Development

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm test           # Run tests
npm run test:tz    # Test timezone behavior
npm run lint       # ESLint check
```

## Releases and app version

The displayed app version comes directly from `package.json` and appears in the footer of every build. Before publishing a release, increment it using semantic versioning:

```bash
npm version patch --no-git-tag-version  # 1.0.0 → 1.0.1
```

Use `minor` for a backward-compatible feature release and `major` for a breaking release. The footer and service-worker cache both read this package version automatically, so the normal test, build, commit, push, and deploy sequence will publish the same version everywhere.

`npm run lint` currently exits non-zero: it reports 5 known pre-existing errors in `src/App.jsx` that are not being fixed.

## Dates & Timezones

Dates are **calendar dates in your LOCAL timezone**. The only place that should build them is `src/dateUtils.js`—never use `toISOString()` for a training date. This was the root cause of past bugs where evening sessions got saved a day ahead.

## Data Files

- `src/data/exercises.js`: The workout plan and all variant definitions
- `src/data/formGuide.js`: Form guides for all 50 variants

To edit the workout, edit the data—not the components.

### ⚠️ Important: Exercise Names Are Storage Keys

The free-weight exercise names are the localStorage keys for all logged history—PRs, sets, progress charts, and session logs. **Renaming one silently orphans that exercise's past data.** The list is frozen for that reason. If you need to rename something, do it very carefully.
