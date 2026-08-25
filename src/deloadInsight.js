// ─── DELOAD INSIGHT ─────────────────────────────────────────────────────────────
// A separate signal from trainingInsights.js (per-exercise stall/decline) and
// rpeInsights.js (per-exercise grinding): this one looks at whole-program
// weekly volume, not any single exercise.
import { weeklyVolume } from "./stats.js";
import { todayISO } from "./dateUtils.js";

/**
 * Flags a sustained volume ramp with no lighter week: the 4 most recent
 * FULLY COMPLETED weeks (the current, possibly-partial week is excluded)
 * each had volume greater than or equal to the previous week in that
 * 4-week span, and none of the 4 weeks had zero volume.
 */
export function deloadReminder(sessions, todayIso = todayISO()) {
  const weeks = weeklyVolume(sessions, 5, todayIso);
  const completed = weeks.slice(0, 4);
  if (completed.some(week => week.volume <= 0)) return null;
  const rising = completed.every((week, index) => index === 0 || week.volume >= completed[index - 1].volume);
  if (!rising) return null;
  return {
    type: "deload-week",
    weeks: completed.map(week => ({ weekStart: week.weekStart, volume: week.volume })),
    action: "Take one week at ~40-50% less volume.",
    message: "Volume held or climbed across your last 4 full weeks (not counting this week in progress), with no lighter week. Consider a deload week.",
  };
}
