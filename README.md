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
- **Rest timer**: Starts when a set is completed, with an account-scoped 60/90/120-second default and completion vibration on supported phones
- **Draft recovery**: In-progress workouts autosave per account and recover after refreshes or crashes
- **Progressive overload guidance**: Uses the most recent working sets and the exercise's rep target to suggest increasing, repeating, or slightly reducing weight; configurable lb/kg increments are saved per account and weights are never changed automatically
- **Workout summaries**: After saving, shows duration, exercises, sets, total volume, new PRs, improvements over the previous session, and notes
- **Training consistency**: A 12-week activity calendar plus rolling 28-day adherence to the five-day plan
- **Custom workouts**: Create reusable custom exercises, add them to any session, and save or apply account-scoped workout templates
- **Training insights**: Conservatively flags three-session plateaus and sustained performance declines that may justify recovery or a deload
- **Offline PWA**: Registered app-shell caching, valid install icons, connection status, install prompting, and user-controlled safe updates

## Development

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm test           # Run tests
npm run test:tz    # Test timezone behavior
npm run lint       # ESLint check
```

`npm run lint` currently exits non-zero: it reports 5 known pre-existing errors in `src/App.jsx` that are not being fixed.

## Dates & Timezones

Dates are **calendar dates in your LOCAL timezone**. The only place that should build them is `src/dateUtils.js`—never use `toISOString()` for a training date. This was the root cause of past bugs where evening sessions got saved a day ahead.

## Data Files

- `src/data/exercises.js`: The workout plan and all variant definitions
- `src/data/formGuide.js`: Form guides for all 50 variants

To edit the workout, edit the data—not the components.

### ⚠️ Important: Exercise Names Are Storage Keys

The free-weight exercise names are the localStorage keys for all logged history—PRs, sets, progress charts, and session logs. **Renaming one silently orphans that exercise's past data.** The list is frozen for that reason. If you need to rename something, do it very carefully.
