// ─── RPE INSIGHTS ──────────────────────────────────────────────────────────────
// A separate signal from trainingInsights.js's stall/deload detection: flags
// sustained near-failure training (RPE 9+ for 3 sessions running) rather than
// a plateau or decline in load. Same "3 in a row" windowing convention.

function averageRpe(session, name) {
  const values = [];
  for (const exercise of session?.exercises || []) {
    if (exercise?.name !== name) continue;
    for (const set of exercise.sets || []) {
      const rpe = Number(set?.rpe);
      if (Number.isFinite(rpe) && rpe > 0) values.push(rpe);
    }
  }
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Flags an exercise whose last 3 logged sessions (sessions containing at
 * least one rated set for that exercise) all averaged RPE 9 or higher.
 */
export function grindingInsights(sessions, limit = 5) {
  const history = new Map();
  for (const session of [...(Array.isArray(sessions) ? sessions : [])].sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    for (const exercise of session?.exercises || []) {
      const avg = averageRpe(session, exercise.name);
      if (avg === null) continue;
      const entries = history.get(exercise.name) || [];
      entries.push({ date: session.date, avgRpe: Math.round(avg * 10) / 10 });
      history.set(exercise.name, entries);
    }
  }

  const insights = [];
  for (const [name, entries] of history) {
    if (entries.length < 3) continue;
    const recent = entries.slice(-3);
    if (recent.every(item => item.avgRpe >= 9)) {
      insights.push({
        type: "grinding",
        name,
        date: recent.at(-1).date,
        evidence: recent,
        action: "Reduce load ~10% or add a rest day",
        message: `You've rated the last 3 sessions of ${name} at RPE 9+. Consider a lighter week or backing off load a bit.`,
      });
    }
  }
  return insights.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, limit);
}
