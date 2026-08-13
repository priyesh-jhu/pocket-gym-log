import { toLb } from "./stats.js";

function performance(exercise) {
  let best = 0;
  for (const set of exercise?.sets || []) {
    const weight = toLb(set?.weight,set?.unit);
    const reps = Number(set?.reps);
    if (weight>0 && Number.isFinite(reps) && reps>0) best=Math.max(best,weight*(1+reps/30));
  }
  return best;
}

export function trainingInsights(sessions, limit=5) {
  const history = new Map();
  for (const session of [...(Array.isArray(sessions)?sessions:[])].sort((a,b)=>String(a.date).localeCompare(String(b.date)))) {
    for (const exercise of session?.exercises || []) {
      const score=performance(exercise);
      if (score<=0) continue;
      const entries=history.get(exercise.name)||[];
      entries.push({date:session.date,score}); history.set(exercise.name,entries);
    }
  }

  const insights=[];
  for (const [name,entries] of history) {
    if (entries.length<3) continue;
    const recent=entries.slice(-3), [first,middle,last]=recent;
    const change=(last.score-first.score)/first.score;
    const declining=middle.score<first.score && last.score<middle.score && change<=-0.05;
    if (declining) {
      insights.push({type:"deload",name,date:last.date,message:"Performance declined in 3 straight sessions. Consider one lighter week at roughly 10–15% less load."});
      continue;
    }
    const peak=Math.max(...recent.map(item=>item.score));
    const floor=Math.min(...recent.map(item=>item.score));
    if ((peak-floor)/peak<=0.01) insights.push({type:"stall",name,date:last.date,message:"Performance has been flat for 3 sessions. Try a small rep/load change or an extra recovery day."});
  }
  return insights.sort((a,b)=>String(b.date).localeCompare(String(a.date)) || (a.type==="deload"?-1:1)).slice(0,limit);
}
