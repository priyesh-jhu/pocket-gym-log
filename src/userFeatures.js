export const GOALS_KEY="__trainingGoals";

const clean=value=>String(value||"").trim().slice(0,80);

export function normalizeReadiness(value={}) {
  const scale=key=>Math.max(1,Math.min(5,Number(value[key])||3));
  return {energy:scale("energy"),sleep:scale("sleep"),soreness:scale("soreness"),pain:Boolean(value.pain)};
}

export function readinessScore(value) {
  const item=normalizeReadiness(value);
  return Math.round(((item.energy+item.sleep+(6-item.soreness))/15)*100);
}

export function getGoals(prefs) {
  const raw=prefs?.[GOALS_KEY];
  if(!Array.isArray(raw)) return [];
  return raw.filter(goal=>goal&&clean(goal.exercise)&&Number(goal.target)>0).map(goal=>({id:clean(goal.id),exercise:clean(goal.exercise),target:Number(goal.target),unit:goal.unit==="kg"?"kg":"lb",complete:Boolean(goal.complete)}));
}

export function addGoal(prefs,values,now=Date.now()) {
  const exercise=clean(values?.exercise),target=Number(values?.target),unit=values?.unit==="kg"?"kg":"lb";
  if(!exercise||!Number.isFinite(target)||target<=0) return {ok:false,prefs:{...(prefs||{})},error:"Choose an exercise and enter a target."};
  const goal={id:`goal-${now}`,exercise,target,unit,complete:false};
  return {ok:true,goal,prefs:{...(prefs||{}),[GOALS_KEY]:[...getGoals(prefs),goal]}};
}

export function removeGoal(prefs,id) {
  return {...(prefs||{}),[GOALS_KEY]:getGoals(prefs).filter(goal=>goal.id!==id)};
}

export function goalProgress(goal,sessions) {
  let best=0;
  for(const session of sessions||[]) for(const exercise of session.exercises||[]) if(exercise.name===goal.exercise) for(const set of exercise.sets||[]) {
    let weight=Number(set.weight)||0;
    if((set.unit||"lb")!==goal.unit) weight=goal.unit==="kg"?weight/2.20462:weight*2.20462;
    best=Math.max(best,weight);
  }
  return {best:Math.round(best*10)/10,pct:Math.min(100,Math.round((best/goal.target)*100)),complete:best>=goal.target};
}
