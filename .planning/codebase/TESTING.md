# Testing Patterns

**Analysis Date:** 2026-08-14

## Test Framework

**Runner:**
- Node.js built-in test runner (`node:test`); no separately versioned test dependency.
- Config: no test config file; discovery is driven by the `src` argument in `package.json`.

**Assertion Library:**
- Node.js strict assertions from `node:assert/strict`.

**Run Commands:**
```bash
npm test             # Run all source tests once
npm run test:tz      # Run the suite across six named time zones
npm run lint         # Run static checks over source and tests
```

There is no watch or coverage script configured. For runner-level watch during development, use `node --test --watch src`; it is not a committed package script.

## Test File Organization

**Location:**
- Tests are colocated with source under `src/` and `src/data/`.
- Pure domain modules receive direct tests; React components, screens, Firebase wiring, PWA registration, and Android wrappers currently have no dedicated JavaScript component/integration tests.
- The Android scaffold also contains template JUnit tests at `android/app/src/test/.../ExampleUnitTest.java` and `android/app/src/androidTest/.../ExampleInstrumentedTest.java`; these are separate from `npm test`.

**Naming:**
- Name JavaScript tests `<module>.test.js`, for example `src/backup.test.js` and `src/data/formGuide.test.js`.
- Suite descriptions name the domain behavior; individual test descriptions state an observable rule or regression.

**Structure:**
```text
src/
├── module.js
├── module.test.js
└── data/
    ├── dataModule.js
    └── dataModule.test.js
```

## Test Structure

**Suite Organization:**
```javascript
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getRestTimerSeconds, setRestTimerSeconds } from "./restTimer.js";

describe("rest timer preferences", () => {
  test("defaults to 90 seconds", () => {
    assert.equal(getRestTimerSeconds({}), 90);
  });

  test("accepts supported durations", () => {
    const prefs = setRestTimerSeconds({}, 120);
    assert.equal(getRestTimerSeconds(prefs), 120);
  });
});
```

**Patterns:**
- Import only the tested public exports plus any real domain data needed for the scenario.
- Group related behavior with `describe`; split edge cases into focused `test` blocks.
- Build small records inline or with local helpers such as `mkSet`, `mkSession`, and `fakeStorage` in `src/stats.test.js` and `src/equipmentPrefs.test.js`.
- Use fixed ISO dates and injectable `now`/`todayIso` parameters for deterministic time-dependent tests.
- Assert exact primitives with `assert.equal`, full structures with `assert.deepEqual`, predicates with `assert.ok`, and failure containment with `assert.doesNotThrow`.
- Include assertion messages when they document an invariant that would otherwise be unclear.
- No global setup or teardown is established; each test creates its own data and fakes.

## Mocking

**Framework:** Hand-written dependency fakes; no mocking library.

**Patterns:**
```javascript
function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    get: key => (key in data ? data[key] : null),
    set(key, value) { data[key] = value; return true; },
    remove(key) { delete data[key]; return true; },
  };
}

class BrokenNotification {
  static permission = "granted";
  constructor() { throw new Error("unsupported"); }
}
```

**What to Mock:**
- Mock narrow platform boundaries passed as parameters: storage wrappers, `Notification`, navigator vibration, and native-platform flags. See `src/equipmentPrefs.test.js`, `src/draftStorage.test.js`, and `src/restTimer.test.js`.
- Use throwing fakes to verify quota, privacy-mode, permission, and unsupported-API resilience.
- Inject current time/date instead of patching global clocks.

**What NOT to Mock:**
- Do not mock pure collaborators or static exercise/form-guide data. Exercise, progression, backup, and analytics tests use real module behavior and realistic record shapes.
- Do not snapshot implementation details. Assert public return values, persisted keys, immutability, and user-visible domain outcomes.

## Fixtures and Factories

**Test Data:**
```javascript
function mkSet(weight, reps, unit = "lb") {
  return { weight, reps, unit };
}

function mkSession(date, exercises) {
  return { id: date, date, day: "MON", notes: "", exercises };
}
```

**Location:**
- Fixtures and factories are local to each test file. There is no shared fixture directory.
- Keep helpers local until multiple test files require exactly the same shape; this prevents a generic factory from hiding scenario-relevant fields.
- `src/data/exercises.test.js` contains intentionally frozen expected-name lists that serve as compatibility fixtures for persisted history.

## Coverage

**Requirements:** None enforced. There is no coverage threshold, provider configuration, or coverage script.

**View Coverage:**
```bash
node --test --experimental-test-coverage src
```

Use the Node runtime’s coverage flag when available; it is not currently part of CI or `package.json`.

## Test Types

**Unit Tests:**
- The primary test type. Tests cover date math, statistics, workout drafts, storage serialization, backup validation/merge behavior, cloud reconciliation, progression, timers, tracking modes, user features, and static data invariants.
- Favor pure functions with injected dates and platform adapters so tests run under Node without a DOM.
- Add regression cases for malformed persisted/imported data and boundary dates; existing examples are `src/backup.test.js` and `src/dateUtils.test.js`.

**Integration Tests:**
- Lightweight module integration is present where real domain modules/data are composed, such as `src/draft.test.js`, `src/data/exercises.test.js`, and `src/workoutSummary.test.js`.
- Firebase, browser localStorage, service worker, React rendering, and Capacitor integration are not exercised end-to-end by the JavaScript suite.

**E2E Tests:**
- Not used. No Playwright, Cypress, browser DOM harness, or mobile UI test suite is configured.
- The checked-in Android JUnit files are generated scaffold examples, not meaningful product E2E coverage.

## Common Patterns

**Async Testing:**
```javascript
test("async behavior", async () => {
  const result = await operationWithInjectedBoundary();
  assert.deepEqual(result, expected);
});
```

The current suite is almost entirely synchronous. When adding asynchronous tests, return/await the promise from the `test` callback; never rely on timers completing after the callback returns. Inject boundary clients so network services remain deterministic.

**Error Testing:**
```javascript
test("survives storage that throws", () => {
  assert.deepEqual(loadPrefs(brokenStorage(), "x"), {});
});

test("swallows unsupported platform APIs", () => {
  assert.doesNotThrow(() => announceRestComplete({
    NotificationApi: BrokenNotification,
    navigatorApi: { vibrate() { throw new Error("blocked"); } },
  }));
});
```

- For expected bad user/persisted input, assert the safe result object or sentinel rather than expecting a throw.
- Use `assert.throws`/`assert.rejects` only when the public contract intentionally throws; that pattern is not currently common.
- Reproduce the exact malformed shape or boundary that caused a regression and assert both rejection and preserved valid data.

## Time-Zone Regression Testing

- Calendar dates represent the user’s local training day. Always test local-date changes with `npm run test:tz`, especially after editing `src/dateUtils.js`, `src/draft.js`, or rolling-window analytics in `src/stats.js`.
- Pass explicit local `Date` values or ISO calendar strings; avoid assertions that depend on the machine’s current date.
- Cover DST transitions, month/year boundaries, late-night hours, and multiple time zones as demonstrated in `src/dateUtils.test.js`.

---

*Testing analysis: 2026-08-14*
