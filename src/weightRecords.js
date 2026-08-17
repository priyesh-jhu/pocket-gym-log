// ─── WEIGHT RECORDS ───────────────────────────────────────────────────────────
// Pure helpers behind the Weight destination. Stored weigh-ins are UNTRUSTED
// input, same rule as historyRecords.js: a single corrupt record must never
// blank a valid weigh-in log or crash a render.
//
// Two invariants matter most here:
//
//   1. Seven-day windows and date arithmetic use LOCAL ISO calendar strings via
//      dateUtils.js — never `toISOString()` on a parsed date-only value, which
//      parses as UTC and moves the day for anyone west of Greenwich.
//   2. Read compatibility accepts every finite stored value, including zero and
//      negative legacy weights; positive-weight validation applies only when
//      Add/Edit tries to persist a new confirmed entry.
import { addDaysISO, parseLocalDate, todayISO } from "./dateUtils.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LB_PER_KG = 2.20462;

const isPlainObject = value => !!value && typeof value === "object" && !Array.isArray(value);

/** True only for a real local calendar date string. */
function isLocalISODate(value) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const parsed = parseLocalDate(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const [year, month, day] = value.split("-").map(Number);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

function toNumber(value) {
  const raw = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(raw) ? raw : null;
}

function toLb(weight, unit) { return unit === "kg" ? weight * LB_PER_KG : weight; }
function fromLb(lb, unit) { return unit === "kg" ? lb / LB_PER_KG : lb; }
function round1(value) { return Math.round(value * 10) / 10; }

function formatDate(iso) {
  return parseLocalDate(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

/**
 * Safe view records for every weigh-in that can be rendered. Any finite stored
 * weight is kept — including zero and negative legacy values — as long as its
 * date and id are usable. Never mutates input.
 */
export function normalizeBodyweights(bodyweights) {
  if (!Array.isArray(bodyweights)) return [];
  return bodyweights.map(entry => {
    if (!isPlainObject(entry)) return null;
    if (!isLocalISODate(entry.date)) return null;
    const weight = toNumber(entry.weight);
    if (weight === null) return null;
    const unit = entry.unit === "kg" ? "kg" : "lb";
    const id = entry.id === null || entry.id === undefined || entry.id === "" ? `w_${entry.date}` : String(entry.id);
    return { id, date: entry.date, weight, unit };
  }).filter(Boolean);
}

/**
 * Summary/trend/history view for the Weight screen, in the selected display
 * unit. Stored unit/date/id are never rewritten by this calculation — only the
 * returned display copy converts.
 */
export function buildWeightView(bodyweights, displayUnit = "lb") {
  const unit = displayUnit === "kg" ? "kg" : "lb";
  const entries = normalizeBodyweights(bodyweights);
  const sortedAsc = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const sortedDesc = [...sortedAsc].reverse();
  const latest = sortedDesc[0] || null;
  const oldest = sortedAsc[0] || null;

  const points = sortedAsc.map(entry => {
    const windowStart = addDaysISO(entry.date, -6);
    const window = sortedAsc.filter(point => point.date >= windowStart && point.date <= entry.date);
    const avgLb = window.reduce((sum, point) => sum + toLb(point.weight, point.unit), 0) / (window.length || 1);
    return {
      date: entry.date,
      dateLabel: entry.date.slice(5),
      weight: round1(fromLb(toLb(entry.weight, entry.unit), unit)),
      trend: round1(fromLb(avgLb, unit)),
    };
  });

  return {
    unit,
    summary: {
      latest: latest ? { value: round1(fromLb(toLb(latest.weight, latest.unit), unit)), unit, dateLabel: formatDate(latest.date) } : null,
      netChange: (latest && oldest)
        ? { value: round1(fromLb(toLb(latest.weight, latest.unit) - toLb(oldest.weight, oldest.unit), unit)), unit }
        : null,
      count: entries.length,
    },
    chart: { points, hasTrend: points.length >= 2 },
    history: sortedDesc.map(entry => ({ ...entry, dateLabel: formatDate(entry.date) })),
  };
}

// ─── ADD / EDIT ────────────────────────────────────────────────────────────────

/** A copied draft for the Add/Edit sheet. Add defaults to today/current unit. */
export function createWeightDraft(entry, defaults = {}) {
  if (entry) {
    return { id: String(entry.id), date: entry.date, weight: String(entry.weight), unit: entry.unit === "kg" ? "kg" : "lb" };
  }
  return { id: "", date: defaults.date || todayISO(), weight: "", unit: defaults.unit === "kg" ? "kg" : "lb" };
}

const VALIDATION_ERROR = "Enter a valid weight greater than zero and choose a date.";

/**
 * Validate and prepare a one-entry-per-date mutation against the current
 * stored array. Never mutates `bodyweights`. On failure nothing is returned
 * and the caller's array stays untouched.
 *
 * Adding onto an existing date preserves that date's existing id. Editing
 * always preserves the edited record's own id — including across a date
 * move — while deterministically replacing whatever already occupies the
 * target date.
 */
export function prepareWeightMutation(bodyweights, draft, { editingId = null } = {}) {
  const list = Array.isArray(bodyweights) ? bodyweights : [];
  if (!isLocalISODate(draft?.date)) {
    return { ok: false, field: "date", error: VALIDATION_ERROR, entry: null, nextWeights: null, cloud: null };
  }
  const weight = toNumber(draft?.weight);
  if (weight === null || weight <= 0) {
    return { ok: false, field: "weight", error: VALIDATION_ERROR, entry: null, nextWeights: null, cloud: null };
  }

  const unit = draft.unit === "kg" ? "kg" : "lb";
  const date = draft.date;
  const editingEntry = editingId ? list.find(item => item && String(item.id) === String(editingId)) : null;
  const collision = list.find(item => item && item.date === date && (!editingEntry || String(item.id) !== String(editingEntry.id)));
  const id = editingEntry ? String(editingEntry.id) : collision ? String(collision.id) : `w_${Date.now()}`;
  const entry = { id, date, weight, unit };

  const withoutTarget = list.filter(item => {
    if (editingEntry && item && String(item.id) === String(editingEntry.id)) return false;
    if (item && item.date === date) return false;
    return true;
  });
  const nextWeights = [...withoutTarget, entry].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const cloud = editingEntry && editingEntry.date !== date
    ? { kind: "move", oldDate: editingEntry.date, newDate: date }
    : { kind: "save", date };

  return { ok: true, field: null, error: null, entry, nextWeights, cloud };
}

/**
 * The single local write path for a Weight mutation. Ordering is the whole
 * point: the device is written FIRST, React state only after that write is
 * confirmed. A local write that returns anything other than a confirmed
 * success — including a thrown quota error — leaves React state untouched and
 * reports `localCommitted:false` so the caller schedules no cloud operation.
 */
export function commitWeightMutation({ nextWeights, writeLocal, applyState }) {
  if (!Array.isArray(nextWeights)) {
    return { ok: false, localCommitted: false, error: new Error("A weigh-in list is required before saving.") };
  }
  if (typeof writeLocal !== "function") {
    return { ok: false, localCommitted: false, error: new Error("No device writer was provided.") };
  }
  try {
    if (!writeLocal(nextWeights)) {
      return { ok: false, localCommitted: false, error: new Error("This device did not confirm the save.") };
    }
  } catch (error) {
    return { ok: false, localCommitted: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
  applyState?.(nextWeights);
  return { ok: true, localCommitted: true, error: null };
}

/**
 * The single ordered cloud mirror for a Weight mutation, run only after
 * `commitWeightMutation` reports `localCommitted:true`. A date move awaits the
 * old-date delete before the new-date save; same-date/add supplies `saveNew`
 * only. A rejection here is sync feedback only — it never re-runs `applyState`
 * or reports back into the already-returned local result.
 */
export function createWeightCloudOperation({ deleteOld, saveNew } = {}) {
  return async () => {
    if (typeof deleteOld === "function") await deleteOld();
    if (typeof saveNew === "function") await saveNew();
  };
}
