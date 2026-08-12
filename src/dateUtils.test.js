import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { localISO, parseLocalDate, addDaysISO, todayISO, todaysDayKey } from "./dateUtils.js";

// The bug: logging a session in the evening saved it under TOMORROW's date,
// because todayISO() went through toISOString() (UTC). Anyone west of UTC rolls
// over early in the evening; anyone east of UTC rolls over late at night.
//
// Run under several timezones via `npm test` — a single-TZ run proves nothing.

const TZ = process.env.TZ || "(system default)";

/** Every wall-clock hour of a day, as local Date objects. */
function hoursOf(y, m, d) {
  return Array.from({ length: 24 }, (_, h) => new Date(y, m - 1, d, h, 30, 0));
}

describe(`dateUtils [TZ=${TZ}]`, () => {
  test("todayISO() returns the LOCAL calendar date at every hour of the day", () => {
    for (const now of hoursOf(2026, 8, 11)) {
      assert.equal(
        todayISO(now), "2026-08-11",
        `at ${now.toString()} — a session logged here must be dated 2026-08-11`
      );
    }
  });

  test("todayISO() holds across a DST spring-forward", () => {
    for (const now of hoursOf(2026, 3, 8)) {
      assert.equal(todayISO(now), "2026-03-08", `at ${now.toString()}`);
    }
  });

  test("todayISO() holds across a DST fall-back", () => {
    for (const now of hoursOf(2026, 11, 1)) {
      assert.equal(todayISO(now), "2026-11-01", `at ${now.toString()}`);
    }
  });

  test("yesterday is one calendar day back at every hour (streak logic)", () => {
    for (const now of hoursOf(2026, 8, 11)) {
      assert.equal(addDaysISO(todayISO(now), -1), "2026-08-10", `at ${now.toString()}`);
    }
  });

  test("localISO formats a local date without drifting to UTC", () => {
    assert.equal(localISO(new Date(2026, 7, 11, 23, 59, 59)), "2026-08-11");
    assert.equal(localISO(new Date(2026, 7, 11, 0, 0, 0)), "2026-08-11");
    assert.equal(localISO(new Date(2026, 0, 5, 22, 0, 0)), "2026-01-05");
  });

  test("parseLocalDate round-trips through localISO", () => {
    for (const s of ["2026-08-11", "2026-01-01", "2026-12-31", "2026-03-08", "2026-11-01"]) {
      assert.equal(localISO(parseLocalDate(s)), s);
    }
  });

  test("addDaysISO crosses month, year and DST boundaries", () => {
    assert.equal(addDaysISO("2026-08-11", -1), "2026-08-10");
    assert.equal(addDaysISO("2026-08-01", -1), "2026-07-31");
    assert.equal(addDaysISO("2026-01-01", -1), "2025-12-31");
    assert.equal(addDaysISO("2026-08-11", -6), "2026-08-05");
    assert.equal(addDaysISO("2026-03-09", -1), "2026-03-08"); // spring forward
    assert.equal(addDaysISO("2026-11-02", -1), "2026-11-01"); // fall back
    assert.equal(addDaysISO("2026-02-28", 1), "2026-03-01");  // non-leap year
  });

  test("todaysDayKey maps weekdays and clamps weekends to MON", () => {
    assert.equal(todaysDayKey(new Date(2026, 7, 10, 21, 0)), "MON");
    assert.equal(todaysDayKey(new Date(2026, 7, 11, 21, 0)), "TUE");
    assert.equal(todaysDayKey(new Date(2026, 7, 14, 21, 0)), "FRI");
    assert.equal(todaysDayKey(new Date(2026, 7, 15, 21, 0)), "MON"); // Saturday
    assert.equal(todaysDayKey(new Date(2026, 7, 16, 21, 0)), "MON"); // Sunday
  });

  test("the training day and the saved date never disagree", () => {
    // todaysDayKey() reads local time but todayISO() read UTC — so an evening
    // session was filed under Monday's plan with Tuesday's date.
    for (const now of hoursOf(2026, 8, 11)) {
      assert.equal(todaysDayKey(now), "TUE", `at ${now.toString()}`);
      assert.equal(todayISO(now), "2026-08-11", `at ${now.toString()}`);
    }
  });
});
