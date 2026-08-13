# Workout Tracker

A lightweight, offline-first PWA for tracking workouts. Data lives in localStorage on your device (never synced), with multiple named profiles and an Export button for backup or data transfer.

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
- **Rest timer**: Between sets

## Development

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm test           # Run tests
npm run test:tz    # Test timezone behavior
npm run lint       # ESLint check
```

`npm run lint` currently exits non-zero: it reports 6 known pre-existing errors in `src/App.jsx` that are not being fixed.

## Dates & Timezones

Dates are **calendar dates in your LOCAL timezone**. The only place that should build them is `src/dateUtils.js`—never use `toISOString()` for a training date. This was the root cause of past bugs where evening sessions got saved a day ahead.

## Data Files

- `src/data/exercises.js`: The workout plan and all variant definitions
- `src/data/formGuide.js`: Form guides for all 50 variants

To edit the workout, edit the data—not the components.

### ⚠️ Important: Exercise Names Are Storage Keys

The free-weight exercise names are the localStorage keys for all logged history—PRs, sets, progress charts, and session logs. **Renaming one silently orphans that exercise's past data.** The list is frozen for that reason. If you need to rename something, do it very carefully.
