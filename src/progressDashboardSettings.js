import { MUSCLES } from "./data/formGuide.js";

export const DASHBOARD_KEY = "__dashboardSettings";
// Ordered by theme: volume/intensity-over-time views first (trend,
// volumeTrend, rpeTrend), then training-split/muscle-balance views
// (dayTypeTrend, balance, muscleBalanceTrend, heatmap), then single-lift
// strength views last (e1rm, relativeStrength, strength) — see the migration
// below for how existing saved layouts pick up this order.
export const PROGRESS_GROUP_IDS = ["trend", "volumeTrend", "rpeTrend", "dayTypeTrend", "balance", "muscleBalanceTrend", "heatmap", "e1rm", "relativeStrength", "strength"];
export const PROGRESS_GROUP_LABELS = {
  e1rm: "e1RM progression",
  trend: "Daily trend",
  heatmap: "Body heatmap",
  balance: "Balance",
  strength: "Strength levels",
  dayTypeTrend: "Day-type trend",
  volumeTrend: "Volume over time",
  rpeTrend: "RPE trend",
  muscleBalanceTrend: "Balance over time",
  relativeStrength: "Relative strength",
};

const LEGACY_DAILY_IDS = ["summary", "calendar", "trend"];
// The default orders this used to ship as, before being regrouped by theme.
// A saved cardOrder that still exactly matches one of these is
// untouched-by-the-user — upgrade it to the current default rather than
// leaving it stuck on an old order.
const PRE_REGROUP_DEFAULT_ORDERS = [
  ["e1rm", "trend", "heatmap", "balance", "strength", "dayTypeTrend", "volumeTrend"],
  ["e1rm", "trend", "heatmap", "balance", "strength"],
  ["trend", "volumeTrend", "dayTypeTrend", "balance", "heatmap", "e1rm", "strength"],
];
const DEFAULT_TARGETS = Object.fromEntries(Object.keys(MUSCLES).map(muscle => [muscle, 10]));

function uniqueKnown(values, known) {
  return [...new Set(Array.isArray(values) ? values.filter(value => known.includes(value)) : [])];
}

function sameOrder(a, b) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export function normalizeDashboardSettings(preferences = {}) {
  const raw = preferences?.[DASHBOARD_KEY] || {};
  const normalized = Array.isArray(raw.cardOrder) && raw.cardOrder.includes("e1rm");
  let cardOrder;
  let hiddenCards;

  if (normalized) {
    const known = uniqueKnown(raw.cardOrder, PROGRESS_GROUP_IDS);
    cardOrder = PRE_REGROUP_DEFAULT_ORDERS.some(order => sameOrder(known, order)) ? [...PROGRESS_GROUP_IDS] : known;
    cardOrder.push(...PROGRESS_GROUP_IDS.filter(id => !cardOrder.includes(id)));
    hiddenCards = uniqueKnown(raw.hiddenCards, PROGRESS_GROUP_IDS);
  } else {
    const legacyOrder = Array.isArray(raw.cardOrder) ? raw.cardOrder : [];
    const mapped = legacyOrder.map(id => LEGACY_DAILY_IDS.includes(id) ? "trend" : id);
    cardOrder = uniqueKnown(mapped, PROGRESS_GROUP_IDS);
    cardOrder.push(...PROGRESS_GROUP_IDS.filter(id => !cardOrder.includes(id)));
    const legacyHidden = Array.isArray(raw.hiddenCards) ? raw.hiddenCards : [];
    hiddenCards = uniqueKnown(legacyHidden, ["heatmap", "balance"]);
    if (LEGACY_DAILY_IDS.every(id => legacyHidden.includes(id))) hiddenCards.push("trend");
  }

  return {
    rangeDays: [7, 28, 90].includes(raw.rangeDays) ? raw.rangeDays : 7,
    plannedDays: Math.max(1, Math.min(7, Number(raw.plannedDays) || 5)),
    targets: { ...DEFAULT_TARGETS, ...(raw.targets || {}) },
    hiddenCards,
    cardOrder,
  };
}

export function updateDashboardSettings(settings, changes) {
  const next = { ...settings, ...changes };
  return JSON.stringify(next) === JSON.stringify(settings) ? settings : next;
}
