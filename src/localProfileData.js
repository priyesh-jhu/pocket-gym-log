// ─── LOCAL PROFILE HYDRATION ──────────────────────────────────────────────────
// The app has two ways to read a profile's saved data off this device.
//
// The forgiving one (`readStoredArray` in App.jsx) turns any problem into an
// empty array. That is correct for auth reconciliation and import, where a
// single unreadable blob must never block merging the rest.
//
// This one is STRICT, and exists for the screens that own their own visible
// loading/error state (History, Weight). There, "storage threw" and "the JSON
// is corrupt" must never be presented as "you have no workouts" — a user who
// sees an empty history believes their training log is gone. So a failure is
// reported as a result the screen can turn into a retryable error.
//
// Failure is per COLLECTION, not per read. Workouts and weigh-ins live under
// separate keys and are separate destinations, so a corrupt weigh-in blob must
// never make a perfectly readable training history unreachable. Each collection
// carries its own { ok, data, error }; the top-level ok/error mean "something
// failed" and exist for callers that only need the coarse answer.
//
// Storage keys are a persistence contract: the prefixes below are the same
// strings the app has always used, and they live here so both readers agree.

export const SESSION_PREFIX = "workout-sessions:";
export const WEIGHT_PREFIX = "workout-bodyweight:";

export function sessionKey(profile) { return SESSION_PREFIX + profile; }
export function weightKey(profile) { return WEIGHT_PREFIX + profile; }

// Errors never carry stored workout content or the profile namespace — they are
// surfaced in the UI and must stay free of user data.
function readCollection(storage, key, label) {
  try {
    if (!storage || typeof storage.get !== "function") throw new Error("Device storage is unavailable.");
    const raw = storage.get(key);
    if (raw === null || raw === undefined || raw === "") return { ok: true, data: [], error: null };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error(`Saved ${label} on this device are not in the expected format.`);
    return { ok: true, data: parsed, error: null };
  } catch (error) {
    return { ok: false, data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/**
 * Strict read of one profile's locally saved data, collection by collection.
 * Absent keys are genuinely empty; thrown access, malformed JSON, or a parsed
 * non-array collection fails only the collection it belongs to.
 */
export function readLocalProfileResult({ storage, profile, loadPrefs }) {
  const sessions = readCollection(storage, sessionKey(profile), "workouts");
  const bodyweights = readCollection(storage, weightKey(profile), "weigh-ins");
  // Preferences are presentation settings, not records: their own loader is
  // total by design and returning {} for them never hides workout data.
  let equipmentPrefs = {};
  try { if (typeof loadPrefs === "function") equipmentPrefs = loadPrefs(storage, profile) || {}; }
  catch { equipmentPrefs = {}; }

  const ok = sessions.ok && bodyweights.ok;
  return {
    ok,
    // Present only when everything read cleanly, so existing all-or-nothing
    // callers keep their old semantics. Partial callers use the sub-results.
    data: ok ? { sessions: sessions.data, bodyweights: bodyweights.data, equipmentPrefs } : null,
    error: sessions.error || bodyweights.error || null,
    sessions,
    bodyweights,
    equipmentPrefs,
  };
}

/**
 * The per-collection errors a screen should surface, or null when nothing
 * failed. A result without sub-results (an unknown shape, or a reader that
 * threw) is treated conservatively as a failure of both collections.
 */
export function profileLoadErrors(result) {
  if (!result || result.ok) return null;
  const fallback = result.error instanceof Error
    ? result.error
    : new Error("Saved data on this device could not be read.");
  return {
    sessions: result.sessions ? result.sessions.error : fallback,
    bodyweights: result.bodyweights ? result.bodyweights.error : fallback,
  };
}

/** Only the collections that read cleanly, so a retry never blanks good state. */
function readableData(result) {
  if (!result?.sessions && !result?.bodyweights) return result?.data || {};
  const data = { equipmentPrefs: result.equipmentPrefs };
  if (result.sessions?.ok) data.sessions = result.sessions.data;
  if (result.bodyweights?.ok) data.bodyweights = result.bodyweights.data;
  return data;
}

/**
 * Drive one load/retry attempt through a screen's own loading and error state.
 * Loading is entered and the previous error cleared before reading; whichever
 * collections read cleanly are applied, always before loading ends. A retry can
 * therefore recover History even while weigh-ins are still unreadable.
 */
export function runLocalProfileLoad({ readResult, setLoading, setError, applyData }) {
  setLoading?.(true);
  setError?.(null);
  let result;
  try {
    result = typeof readResult === "function"
      ? readResult()
      : { ok: false, data: null, error: new Error("No saved-data reader was provided.") };
    const recovered = result?.sessions?.ok || result?.bodyweights?.ok || result?.ok;
    if (recovered) applyData?.(readableData(result));
    if (!result?.ok) setError?.(profileLoadErrors(result));
  } catch (error) {
    result = { ok: false, data: null, error: error instanceof Error ? error : new Error(String(error)) };
    setError?.(profileLoadErrors(result));
  } finally {
    setLoading?.(false);
  }
  return result;
}
