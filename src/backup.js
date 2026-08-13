// ─── BACKUP / RESTORE ─────────────────────────────────────────────────────────
// Pure functions for building, validating, and merging JSON export/import
// payloads. No React, no DOM, no localStorage access here — App.jsx wires this
// into the UI and does the actual persistence. Every function here is TOTAL:
// given garbage input, it returns a result object rather than throwing.

/** Build the export payload for the current profile. */
export function buildBackup({ profile, sessions, bodyweights, equipmentPrefs, exportedAt }) {
  return {
    version: 2,
    exportedAt: exportedAt || new Date().toISOString(),
    profile: profile ?? null,
    loggedSessions: Array.isArray(sessions) ? sessions : [],
    bodyweights: Array.isArray(bodyweights) ? bodyweights : [],
    equipmentPrefs: (equipmentPrefs && typeof equipmentPrefs === "object" && !Array.isArray(equipmentPrefs)) ? equipmentPrefs : {},
  };
}

// A valid set is a plain object; its weight/reps are read with parseFloat
// downstream, so garbage values just fail to be a PR/volume, but a non-object
// set (a string, a number, an array) would blow up that downstream code.
function isValidSet(set) {
  return !!set && typeof set === "object" && !Array.isArray(set);
}

// A valid exercise has an array of valid sets. This is what actually matters:
// buildPRMap and friends do `ex.sets.forEach(...)` with no guard, so an
// exercise whose `sets` isn't an array crashes every render forever once the
// bad session is persisted (see CRITICAL-1 in the review). Reject it here
// instead of trusting the shape.
function isValidExercise(ex) {
  return !!ex && typeof ex === "object" && !Array.isArray(ex) &&
    Array.isArray(ex.sets) && ex.sets.every(isValidSet);
}

// Whole session is rejected (rather than dropping just the bad exercise and
// keeping the rest) so the "skipped" count computed below — rawSessions.length
// minus surviving sessions.length — stays accurate with a single filter pass.
// A session with zero exercises (e.g. a fresh v1 export) is still valid.
function isValidSession(s) {
  return !!s && typeof s === "object" && !Array.isArray(s) &&
    s.id != null && String(s.id) !== "" &&
    typeof s.date === "string" && s.date !== "" &&
    Array.isArray(s.exercises) && s.exercises.every(isValidExercise);
}

// Accepts a finite number, or a string that parses cleanly and completely to
// one (rejects "150abc", "", whitespace-only, arrays/objects). parseFloat is
// too lenient here — it happily reads "150abc" as 150.
function parseWeight(w) {
  if (typeof w === "number") return Number.isFinite(w) ? w : null;
  if (typeof w === "string" && w.trim() !== "") {
    const n = Number(w.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isValidBodyweight(b) {
  return !!b && typeof b === "object" && !Array.isArray(b) &&
    typeof b.date === "string" && b.date !== "" &&
    parseWeight(b.weight) !== null;
}

/**
 * Validate a parsed JSON backup. Accepts both the v1 shape (no `version`, no
 * `equipmentPrefs`) and the current v2 shape. Malformed individual entries are
 * dropped rather than failing the whole import; the counts are reported so the
 * UI can tell the user.
 */
export function validateBackup(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "That file doesn't look like a workout backup." };
  }

  if ("loggedSessions" in parsed && !Array.isArray(parsed.loggedSessions)) {
    return { ok: false, error: "The file's sessions data is not in the expected format." };
  }
  if ("bodyweights" in parsed && !Array.isArray(parsed.bodyweights)) {
    return { ok: false, error: "The file's bodyweight data is not in the expected format." };
  }

  const rawSessions = Array.isArray(parsed.loggedSessions) ? parsed.loggedSessions : [];
  const rawWeights = Array.isArray(parsed.bodyweights) ? parsed.bodyweights : [];

  const sessions = rawSessions.filter(isValidSession);
  // Store weight as an actual number — isValidBodyweight already proved it
  // parses cleanly, so this can't turn a rejected entry into NaN.
  const bodyweights = rawWeights.filter(isValidBodyweight).map(b => ({ ...b, weight: parseWeight(b.weight) }));

  const equipmentPrefs = (parsed.equipmentPrefs && typeof parsed.equipmentPrefs === "object" && !Array.isArray(parsed.equipmentPrefs))
    ? parsed.equipmentPrefs
    : {};

  return {
    ok: true,
    data: {
      sessions,
      bodyweights,
      equipmentPrefs,
      profile: parsed.profile ?? null,
      skipped: {
        sessions: rawSessions.length - sessions.length,
        bodyweights: rawWeights.length - bodyweights.length,
      },
    },
  };
}

/**
 * Merge an incoming (imported) backup into the current in-memory data.
 * Never mutates `current` or `incoming`.
 *   - sessions: union by id; on collision, keep the CURRENT (local) session.
 *   - bodyweights: union by date; on collision, keep the INCOMING entry.
 *   - equipmentPrefs: shallow merge, incoming wins.
 */
export function mergeBackup(current, incoming) {
  const curSessions = Array.isArray(current?.sessions) ? current.sessions : [];
  const curWeights = Array.isArray(current?.bodyweights) ? current.bodyweights : [];
  const curPrefs = (current?.equipmentPrefs && typeof current.equipmentPrefs === "object") ? current.equipmentPrefs : {};

  const incSessions = Array.isArray(incoming?.sessions) ? incoming.sessions : [];
  const incWeights = Array.isArray(incoming?.bodyweights) ? incoming.bodyweights : [];
  const incPrefs = (incoming?.equipmentPrefs && typeof incoming.equipmentPrefs === "object") ? incoming.equipmentPrefs : {};

  const sessionById = new Map();
  for (const s of curSessions) sessionById.set(s.id, s);
  let addedSessions = 0;
  for (const s of incSessions) {
    if (!sessionById.has(s.id)) { sessionById.set(s.id, s); addedSessions++; }
    // collision: keep current, i.e. do nothing.
  }
  const sessions = Array.from(sessionById.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const weightByDate = new Map();
  for (const w of curWeights) weightByDate.set(w.date, w);
  let addedWeights = 0;
  let overwrittenWeights = 0;
  for (const w of incWeights) {
    const existing = weightByDate.get(w.date);
    if (existing === undefined) {
      addedWeights++;
    } else if (Number(existing.weight) !== Number(w.weight)) {
      // Same date, different value: the "recommended" merge button is about
      // to silently replace a value the user already logged. Count it so the
      // UI can say so instead of hiding it.
      overwrittenWeights++;
    }
    weightByDate.set(w.date, w); // incoming wins on collision, and is a fresh addition otherwise.
  }
  const bodyweights = Array.from(weightByDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const equipmentPrefs = { ...curPrefs, ...incPrefs };

  return {
    sessions,
    bodyweights,
    equipmentPrefs,
    added: { sessions: addedSessions, bodyweights: addedWeights },
    overwritten: { bodyweights: overwrittenWeights },
  };
}

/** Replace path: use the incoming data as-is, in the same shape as mergeBackup. */
export function replaceBackup(incoming) {
  return {
    sessions: Array.isArray(incoming?.sessions) ? incoming.sessions : [],
    bodyweights: Array.isArray(incoming?.bodyweights) ? incoming.bodyweights : [],
    equipmentPrefs: (incoming?.equipmentPrefs && typeof incoming.equipmentPrefs === "object") ? incoming.equipmentPrefs : {},
  };
}
