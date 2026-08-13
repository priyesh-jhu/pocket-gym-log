// ─── TRAINING STATS ────────────────────────────────────────────────────────────
// Pure, total functions for the training-overview dashboard. All volume figures
// are computed in LB internally; convert to the display unit at the render layer.
// Dates follow the same LOCAL-calendar-date rules as dateUtils.js — never
// toISOString() for a training date.
import { parseLocalDate, addDaysISO, localISO, todayISO } from "./dateUtils.js";
import { MUSCLES, formGuide } from "./data/formGuide.js";

export const MUSCLE_GROUPS = {
  chest: "Chest",
  lats: "Back", traps: "Back", midBack: "Back", lowerBack: "Back",
  frontDelts: "Shoulders", sideDelts: "Shoulders", rearDelts: "Shoulders",
  biceps: "Arms", triceps: "Arms", forearms: "Arms",
  glutes: "Legs", quads: "Legs", hamstrings: "Legs", calves: "Legs", adductors: "Legs",
  abs: "Core", obliques: "Core",
};

const KG_TO_LB = 2.20462;

/** Parse a weight string in the given unit and return it in lb. 0 for blank/NaN. */
export function toLb(weight, unit) {
  const n = parseFloat(weight);
  if (isNaN(n)) return 0;
  return unit === "kg" ? n * KG_TO_LB : n;
}

/** The unit ("lb"/"kg") used by the most logged sets across all sessions. */
export function dominantUnit(sessions) {
  const counts = { lb: 0, kg: 0 };
  for (const s of Array.isArray(sessions) ? sessions : []) {
    for (const ex of Array.isArray(s?.exercises) ? s.exercises : []) {
      for (const set of Array.isArray(ex?.sets) ? ex.sets : []) {
        const u = set?.unit === "kg" ? "kg" : "lb";
        counts[u]++;
      }
    }
  }
  return counts.kg > counts.lb ? "kg" : "lb";
}

/** Volume of a single set, in lb. 0 if weight or reps is blank/NaN. */
export function setVolume(set) {
  const reps = parseFloat(set?.reps);
  if (isNaN(reps)) return 0;
  return toLb(set?.weight, set?.unit) * reps;
}

/** Total volume of a session, in lb, across all exercises' sets. */
export function sessionVolume(session) {
  let total = 0;
  for (const ex of Array.isArray(session?.exercises) ? session.exercises : []) {
    for (const set of Array.isArray(ex?.sets) ? ex.sets : []) {
      total += setVolume(set);
    }
  }
  return total;
}

/** The Monday ("YYYY-MM-DD") of the Mon→Sun week containing the given local date. */
export function weekStartISO(iso) {
  const d = parseLocalDate(iso);
  const dow = d.getDay(); // 0=Sun..6=Sat
  const offsetFromMonday = dow === 0 ? 6 : dow - 1;
  return addDaysISO(localISO(d), -offsetFromMonday);
}

function shortLabel(iso) {
  const d = parseLocalDate(iso);
  return (d.getMonth() + 1) + "/" + d.getDate();
}

/**
 * Last `weeks` Mon→Sun buckets ending with the week containing `todayIso`,
 * oldest first. Always exactly `weeks` entries — zero-activity weeks included.
 */
export function weeklyVolume(sessions, weeks = 12, todayIso = todayISO()) {
  const list = Array.isArray(sessions) ? sessions : [];
  const currentWeekStart = weekStartISO(todayIso);
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addDaysISO(currentWeekStart, -7 * i);
    buckets.push({ weekStart, label: shortLabel(weekStart), volume: 0, sessions: 0 });
  }
  const byStart = new Map(buckets.map(b => [b.weekStart, b]));
  for (const s of list) {
    if (!s?.date) continue;
    const bucket = byStart.get(weekStartISO(s.date));
    if (!bucket) continue;
    bucket.volume += sessionVolume(s);
    bucket.sessions += 1;
  }
  return buckets;
}

/** Current Mon→Sun week vs the previous one. deltaPct is null if prevVolume is 0. */
export function weekSummary(sessions, todayIso = todayISO()) {
  const list = Array.isArray(sessions) ? sessions : [];
  const currentStart = weekStartISO(todayIso);
  const prevStart = addDaysISO(currentStart, -7);
  let sessionsCount = 0, volume = 0, prevVolume = 0;
  for (const s of list) {
    if (!s?.date) continue;
    const ws = weekStartISO(s.date);
    if (ws === currentStart) {
      sessionsCount += 1;
      volume += sessionVolume(s);
    } else if (ws === prevStart) {
      prevVolume += sessionVolume(s);
    }
  }
  const deltaPct = prevVolume > 0 ? Math.round(((volume - prevVolume) / prevVolume) * 100) : null;
  return { sessions: sessionsCount, volume, prevVolume, deltaPct };
}

/**
 * Muscle-group share of volume over the last `weeks` weeks, sorted descending.
 * Exercises without a formGuide entry are skipped for attribution (but still
 * count toward volume elsewhere). Volume is split evenly across the deduped
 * groups implied by the exercise's primary muscles.
 */
export function muscleBalance(sessions, weeks = 4, todayIso = todayISO()) {
  const list = Array.isArray(sessions) ? sessions : [];
  const currentStart = weekStartISO(todayIso);
  const cutoffStart = addDaysISO(currentStart, -7 * (weeks - 1));
  const totals = {};

  for (const s of list) {
    if (!s?.date) continue;
    const ws = weekStartISO(s.date);
    if (ws < cutoffStart || ws > currentStart) continue;
    for (const ex of Array.isArray(s.exercises) ? s.exercises : []) {
      const guide = formGuide[ex?.name];
      if (!guide || !Array.isArray(guide.primary) || guide.primary.length === 0) continue;
      const exVolume = (Array.isArray(ex.sets) ? ex.sets : []).reduce((sum, set) => sum + setVolume(set), 0);
      if (exVolume <= 0) continue;
      const groups = [...new Set(guide.primary.map(m => MUSCLE_GROUPS[m]).filter(Boolean))];
      if (groups.length === 0) continue;
      const share = exVolume / groups.length;
      for (const g of groups) totals[g] = (totals[g] || 0) + share;
    }
  }

  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  if (total <= 0) return [];

  return Object.entries(totals)
    .map(([group, volume]) => ({ group, volume, pct: Math.round((volume / total) * 100) }))
    .sort((a, b) => b.volume - a.volume);
}

/** Twelve-week Monday→Sunday activity grid. Each inner array is one week. */
export function activityCalendar(sessions, weeks = 12, todayIso = todayISO()) {
  const countByDate = new Map();
  for (const session of Array.isArray(sessions) ? sessions : []) {
    if (!session?.date || session.date > todayIso) continue;
    countByDate.set(session.date, (countByDate.get(session.date) || 0) + 1);
  }
  const firstMonday = addDaysISO(weekStartISO(todayIso), -7*(weeks-1));
  return Array.from({length:weeks}, (_,week) => Array.from({length:7}, (_,day) => {
    const date = addDaysISO(firstMonday, week*7+day);
    return { date, count:countByDate.get(date) || 0, future:date>todayIso };
  }));
}

/** Adherence summary for the rolling last four weeks, against a five-day plan. */
export function consistencySummary(sessions, todayIso = todayISO()) {
  const start = addDaysISO(todayIso, -27);
  const dates = new Set((Array.isArray(sessions) ? sessions : [])
    .map(session => session?.date)
    .filter(date => date && date>=start && date<=todayIso));
  const activeWeeks = new Set([...dates].map(weekStartISO)).size;
  return {
    workouts:dates.size,
    activeWeeks,
    goalPct:Math.min(100, Math.round((dates.size/20)*100)),
  };
}

/**
 * Muscle groups trained in one or fewer of the last completed `weeks` weeks.
 * This is presence-based, not volume-based, so unweighted core work counts.
 * The current partial week is deliberately excluded to avoid premature alerts.
 */
export function muscleCoverageGaps(sessions, weeks = 4, todayIso = todayISO()) {
  const completedWeekStarts=Array.from({length:weeks},(_,index)=>addDaysISO(weekStartISO(todayIso),-7*(index+1)));
  const groups=Object.values(MUSCLE_GROUPS).filter((group,index,all)=>all.indexOf(group)===index);
  const activeByGroup=new Map(groups.map(group=>[group,new Set()]));
  const completedSet=new Set(completedWeekStarts);
  const observedWeeks=new Set();

  for(const session of Array.isArray(sessions)?sessions:[]) {
    if(!session?.date) continue;
    const week=weekStartISO(session.date);
    if(!completedSet.has(week)) continue;
    observedWeeks.add(week);
    for(const exercise of session.exercises||[]) {
      if(!Array.isArray(exercise?.sets)||exercise.sets.length===0) continue;
      const guide=formGuide[exercise?.name];
      const exerciseGroups=new Set((guide?.primary||[]).map(muscle=>MUSCLE_GROUPS[muscle]).filter(Boolean));
      for(const group of exerciseGroups) activeByGroup.get(group)?.add(week);
    }
  }

  // Avoid calling a pattern "consistent" before there is enough history.
  if(observedWeeks.size<3) return [];

  return groups.map(group=>{
    const activeWeeks=activeByGroup.get(group).size;
    return {group,activeWeeks,missedWeeks:weeks-activeWeeks,weeks};
  }).filter(item=>item.activeWeeks<=1).sort((a,b)=>b.missedWeeks-a.missedWeeks||a.group.localeCompare(b.group));
}

/** Individual-muscle coverage for a rolling day range ending today. */
export function muscleHeatmapCoverage(sessions, days = 7, todayIso = todayISO()) {
  const start=addDaysISO(todayIso,-Math.max(1,days)+1);
  const scores=Object.fromEntries(Object.keys(MUSCLES).map(muscle=>[muscle,0]));
  for(const session of Array.isArray(sessions)?sessions:[]) {
    if(!session?.date||session.date<start||session.date>todayIso) continue;
    for(const exercise of session.exercises||[]) {
      if(!Array.isArray(exercise?.sets)||exercise.sets.length===0) continue;
      const guide=formGuide[exercise?.name];
      for(const muscle of new Set(guide?.primary||[])) if(muscle in scores) scores[muscle]+=1;
      for(const muscle of new Set(guide?.secondary||[])) if(muscle in scores) scores[muscle]+=0.5;
    }
  }
  const missed=Object.keys(scores).filter(muscle=>scores[muscle]===0);
  return {days,start,end:todayIso,scores,missed,trained:Object.keys(scores).filter(muscle=>scores[muscle]>0)};
}

/**
 * Builds a compact exercise list that covers the selected missing muscles.
 * Primary-muscle matches are preferred. Secondary matches are used only when
 * they reduce gaps left by those direct recommendations (for example adductors,
 * which are supporting muscles in the built-in program).
 */
export function exerciseSuggestionsForMissed(missedMuscles, options={}) {
  const remaining=new Set((Array.isArray(missedMuscles)?missedMuscles:[]).filter(muscle=>muscle in MUSCLES));
  const candidates=Object.entries(formGuide).map(([name,guide])=>({name,primary:guide.primary||[],secondary:guide.secondary||[]}));
  const suggestions=[];
  const recent=new Set(options.recentExercises||[]);
  const avoid=new Set(options.avoidMuscles||[]);
  const preferred=options.preferredEquipment;

  while(remaining.size>0) {
    let best=null;
    for(const candidate of candidates) {
      if(suggestions.some(item=>item.name===candidate.name)) continue;
      const direct=candidate.primary.filter(muscle=>remaining.has(muscle));
      const supporting=candidate.secondary.filter(muscle=>remaining.has(muscle));
      if(direct.length===0&&supporting.length===0) continue;
      if(candidate.primary.some(muscle=>avoid.has(muscle))) continue;
      const machine=/Machine|Cable|Pulldown/.test(candidate.name);
      const equipmentBonus=preferred==="machine"?(machine?3:0):preferred==="free"?(!machine?3:0):0;
      const score=direct.length*100+supporting.length*10+equipmentBonus-(recent.has(candidate.name)?20:0);
      if(!best||score>best.score) best={...candidate,direct,supporting,score};
    }
    if(!best) break;
    const covered=[...best.direct,...best.supporting];
    suggestions.push({name:best.name,direct:best.direct,supporting:best.supporting,covered});
    covered.forEach(muscle=>remaining.delete(muscle));
  }

  return {suggestions,uncovered:[...remaining]};
}

/** Approximate hard-set stimulus: primary = 1 set, secondary = 0.5 set. */
export function muscleSetVolume(sessions, days = 7, todayIso = todayISO()) {
  const start=addDaysISO(todayIso,-Math.max(1,days)+1);
  const sets=Object.fromEntries(Object.keys(MUSCLES).map(muscle=>[muscle,0]));
  const lastTrained=Object.fromEntries(Object.keys(MUSCLES).map(muscle=>[muscle,null]));
  for(const session of Array.isArray(sessions)?sessions:[]) {
    if(!session?.date||session.date<start||session.date>todayIso) continue;
    for(const exercise of session.exercises||[]) {
      const count=Array.isArray(exercise?.sets)?exercise.sets.length:0;
      if(!count) continue;
      const guide=formGuide[exercise.name];
      for(const muscle of new Set(guide?.primary||[])) if(muscle in sets) { sets[muscle]+=count; if(!lastTrained[muscle]||session.date>lastTrained[muscle]) lastTrained[muscle]=session.date; }
      for(const muscle of new Set(guide?.secondary||[])) if(muscle in sets) { sets[muscle]+=count*0.5; if(!lastTrained[muscle]||session.date>lastTrained[muscle]) lastTrained[muscle]=session.date; }
    }
  }
  return {days,start,end:todayIso,sets,lastTrained};
}

export function dashboardRangeSummary(sessions, days = 7, todayIso = todayISO()) {
  const start=addDaysISO(todayIso,-Math.max(1,days)+1);
  const inRange=(Array.isArray(sessions)?sessions:[]).filter(session=>session?.date>=start&&session.date<=todayIso);
  return {days,start,end:todayIso,sessions:inRange.length,workoutDays:new Set(inRange.map(session=>session.date)).size,sets:inRange.reduce((sum,session)=>sum+(session.exercises||[]).reduce((n,exercise)=>n+(exercise.sets?.length||0),0),0),volume:inRange.reduce((sum,session)=>sum+sessionVolume(session),0)};
}

export function musclePriorities(setVolume, targets={}, plannedDays=5, todayIso=todayISO()) {
  const scale=Math.max(1,Number(plannedDays)||5)/5;
  return Object.keys(MUSCLES).map(muscle=>{
    const done=Number(setVolume?.sets?.[muscle])||0;
    const target=Math.max(1,Number(targets?.[muscle])||Math.round(10*scale));
    const last=setVolume?.lastTrained?.[muscle];
    const daysSince=last?Math.max(0,Math.round((parseLocalDate(todayIso)-parseLocalDate(last))/86400000)):null;
    return {muscle,done,target,remaining:Math.max(0,target-done),pct:Math.min(100,Math.round(done/target*100)),lastTrained:last,daysSince};
  }).sort((a,b)=>b.remaining-a.remaining||(b.daysSince??999)-(a.daysSince??999)||a.muscle.localeCompare(b.muscle));
}
