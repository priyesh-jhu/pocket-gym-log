import { MUSCLES } from "./data/formGuide.js";

export const DASHBOARD_KEY = "__dashboardSettings";
export const PROGRESS_GROUP_IDS = ["e1rm", "trend", "heatmap", "balance", "strength", "dayTypeTrend", "volumeTrend"];
export const PROGRESS_GROUP_LABELS = {
  e1rm: "e1RM progression",
  trend: "Daily trend",
  heatmap: "Body heatmap",
  balance: "Balance",
  strength: "Strength levels",
  dayTypeTrend: "Day-type trend",
  volumeTrend: "Volume over time",
};

const LEGACY_DAILY_IDS = ["summary", "calendar", "trend"];
const DEFAULT_TARGETS = Object.fromEntries(Object.keys(MUSCLES).map(muscle => [muscle, 10]));

function uniqueKnown(values, known) {
  return [...new Set(Array.isArray(values) ? values.filter(value => known.includes(value)) : [])];
}

export function normalizeDashboardSettings(preferences = {}) {
  const raw = preferences?.[DASHBOARD_KEY] || {};
  const normalized = Array.isArray(raw.cardOrder) && raw.cardOrder.includes("e1rm");
  let cardOrder;
  let hiddenCards;

  if (normalized) {
    cardOrder = uniqueKnown(raw.cardOrder, PROGRESS_GROUP_IDS);
    cardOrder.push(...PROGRESS_GROUP_IDS.filter(id => !cardOrder.includes(id)));
    hiddenCards = uniqueKnown(raw.hiddenCards, PROGRESS_GROUP_IDS);
  } else {
    const legacyOrder = Array.isArray(raw.cardOrder) ? raw.cardOrder : [];
    const mapped = legacyOrder.map(id => LEGACY_DAILY_IDS.includes(id) ? "trend" : id);
    cardOrder = uniqueKnown(mapped, PROGRESS_GROUP_IDS.filter(id => id !== "e1rm"));
    cardOrder.unshift("e1rm");
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
