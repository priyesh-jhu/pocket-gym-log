// ─── CSV EXPORT ─────────────────────────────────────────────────────────────────
// A flat, one-row-per-set view of the training log for spreadsheet analysis.
// Complements the JSON backup (src/backup.js), which is optimized for
// round-tripping through this app, not for opening in a spreadsheet.
const HEADER = ["date", "day", "exercise", "weight", "unit", "reps", "rpe"];

function csvField(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One row per logged set, sorted by date. rpe is blank for sets without one. */
export function sessionsToCsv(sessions) {
  const ordered = [...(Array.isArray(sessions) ? sessions : [])]
    .sort((a, b) => String(a?.date).localeCompare(String(b?.date)));
  const rows = [HEADER];
  for (const session of ordered) {
    for (const exercise of Array.isArray(session?.exercises) ? session.exercises : []) {
      for (const set of Array.isArray(exercise?.sets) ? exercise.sets : []) {
        rows.push([
          session.date ?? "",
          session.day ?? "",
          exercise.name ?? "",
          set.weight ?? "",
          set.unit ?? "",
          set.reps ?? "",
          set.rpe ?? "",
        ]);
      }
    }
  }
  return rows.map(row => row.map(csvField).join(",")).join("\r\n");
}
