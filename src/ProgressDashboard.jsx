import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { activityCalendar, consistencySummary, dominantUnit, weeklyVolume, muscleBalance, muscleCoverageGaps, muscleHeatmapCoverage, exerciseSuggestionsForMissed, muscleSetVolume, dashboardRangeSummary, musclePriorities, sessionVolume, toLb, weekStartISO } from "./stats.js";
import { trainingInsights } from "./trainingInsights.js";
import { addDaysISO, todayISO } from "./dateUtils.js";
import { MUSCLES, formGuide } from "./data/formGuide.js";
import MuscleHeatmap from "./MuscleHeatmap.jsx";

const GROUP_COLORS = {
  Chest: "#3B82F6",
  Back: "#22C55E",
  Shoulders: "#F59E0B",
  Arms: "#8B5CF6",
  Legs: "#EC4899",
  Core: "#9CA3AF",
};

const KG_PER_LB = 1 / 2.20462;

function toDisplay(lb, unit) {
  return unit === "kg" ? lb * KG_PER_LB : lb;
}

function fmtVolume(lb, unit) {
  return Math.round(toDisplay(lb, unit)).toLocaleString();
}

const card = { background: "#0F1018", border: "1px solid #16172A", borderRadius: 14, padding: "16px", marginBottom: 16 };
const sectionLabel = { fontSize: 12, color: "#666", fontWeight: 700, marginBottom: 10 };
const DASHBOARD_KEY="__dashboardSettings";
const CARD_IDS=["heatmap","summary","calendar","trend","balance"];
const CARD_LABELS={heatmap:"Body heatmap",summary:"Range summary",calendar:"Training calendar",trend:"Training trend",balance:"Muscle balance"};
const DEFAULT_TARGETS=Object.fromEntries(Object.keys(MUSCLES).map(muscle=>[muscle,10]));

function dashboardSettings(preferences) {
  const raw=preferences?.[DASHBOARD_KEY]||{};
  const order=Array.isArray(raw.cardOrder)?[...raw.cardOrder.filter(id=>CARD_IDS.includes(id)),...CARD_IDS.filter(id=>!raw.cardOrder.includes(id))]:CARD_IDS;
  return {rangeDays:[7,28,90].includes(raw.rangeDays)?raw.rangeDays:7,plannedDays:Math.max(1,Math.min(7,Number(raw.plannedDays)||5)),targets:{...DEFAULT_TARGETS,...(raw.targets||{})},hiddenCards:Array.isArray(raw.hiddenCards)?raw.hiddenCards.filter(id=>CARD_IDS.includes(id)):[],cardOrder:order};
}

export default function ProgressDashboard({ sessions, preferences={}, onSavePreferences, onAddExercise }) {
  const list = Array.isArray(sessions) ? sessions : [];
  const [historyPage, setHistoryPage] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);
  const [chartExercise, setChartExercise] = useState("all");
  const [chartMetric, setChartMetric] = useState("volume");
  const [heatmapMode, setHeatmapMode] = useState("coverage");
  const [selectedMuscle, setSelectedMuscle] = useState(null);
  const [customizing, setCustomizing] = useState(false);
  const settings=dashboardSettings(preferences);
  const rangeDays=settings.rangeDays;
  const saveSettings=changes=>onSavePreferences?.({...preferences,[DASHBOARD_KEY]:{...settings,...changes}});
  const setRangeDays=days=>saveSettings({rangeDays:days});
  const cardStyle=id=>({...card,display:settings.hiddenCards.includes(id)?"none":undefined,order:settings.cardOrder.indexOf(id)});
  const moveCard=(id,direction)=>{const order=[...settings.cardOrder],from=order.indexOf(id),to=from+direction;if(to<0||to>=order.length)return;[order[from],order[to]]=[order[to],order[from]];saveSettings({cardOrder:order});};
  const toggleCard=id=>saveSettings({hiddenCards:settings.hiddenCards.includes(id)?settings.hiddenCards.filter(item=>item!==id):[...settings.hiddenCards,id]});

  if (list.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px", color: "#444", fontSize: 13 }}>
        Log a few sessions first to see your training overview.
      </div>
    );
  }

  const unit = dominantUnit(list);
  const currentWeek = weekStartISO(todayISO());
  const periodEnd = historyPage === 0 ? todayISO() : addDaysISO(currentWeek, -1 - ((historyPage - 1) * 84));
  const oldestWeek = list.reduce((oldest, session) => session?.date && weekStartISO(session.date) < oldest ? weekStartISO(session.date) : oldest, currentWeek);
  const oldestWeeksAgo = Math.max(0, Math.round((new Date(currentWeek + "T12:00:00") - new Date(oldestWeek + "T12:00:00")) / 604800000));
  const maxHistoryPage = Math.floor(oldestWeeksAgo / 12);
  const weeks = weeklyVolume(list, 12, periodEnd);
  const balance = muscleBalance(list, Math.max(1,Math.ceil(rangeDays/7)));
  const calendar = activityCalendar(list, 12, periodEnd);
  const consistency = consistencySummary(list);
  const insights = trainingInsights(list);
  const coverageGaps = muscleCoverageGaps(list);
  const heatmap = muscleHeatmapCoverage(list,rangeDays);
  const setVolume=muscleSetVolume(list,rangeDays);
  const rangeSummary=dashboardRangeSummary(list,rangeDays);
  const scaledTargets=Object.fromEntries(Object.entries(settings.targets).map(([muscle,target])=>[muscle,Math.max(1,Math.round(target*rangeDays/7))]));
  const allPriorities=musclePriorities(setVolume,scaledTargets,settings.plannedDays);
  const priorities=allPriorities.filter(item=>item.remaining>0);
  const recentCutoff=addDaysISO(todayISO(),-3);
  const recentExercises=list.filter(session=>session?.date>=recentCutoff).flatMap(session=>(session.exercises||[]).map(exercise=>exercise.name));
  const equipmentCounts=list.slice(-8).flatMap(session=>session.exercises||[]).reduce((counts,exercise)=>({...counts,[exercise.equipment||"free"]:(counts[exercise.equipment||"free"]||0)+1}),{});
  const preferredEquipment=(equipmentCounts.machine||0)>(equipmentCounts.free||0)?"machine":"free";
  const latestReadiness=[...list].filter(session=>session?.readiness).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0]?.readiness;
  const exerciseSuggestions = exerciseSuggestionsForMissed(heatmap.missed,{recentExercises,preferredEquipment});
  const selectedPriority=selectedMuscle?allPriorities.find(item=>item.muscle===selectedMuscle):null;
  const selectedHistory=selectedMuscle?list.flatMap(session=>(session.exercises||[]).filter(exercise=>[...(formGuide[exercise.name]?.primary||[]),...(formGuide[exercise.name]?.secondary||[])].includes(selectedMuscle)).map(exercise=>({date:session.date,name:exercise.name,sets:exercise.sets?.length||0}))).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8):[];
  const selectedSessions = selectedDate ? list.filter(session=>session?.date===selectedDate) : [];

  const exerciseNames = [...new Set(list.flatMap(session=>(session.exercises||[]).map(exercise=>exercise.name)).filter(Boolean))].sort();
  const chartSessions = chartExercise==="all" ? list : list.map(session=>({...session,exercises:(session.exercises||[]).filter(exercise=>exercise.name===chartExercise)}));
  const chartBuckets = Array.from({length:rangeDays},(_,index)=>{
    const date=addDaysISO(periodEnd,index-rangeDays+1);
    return {key:date,date,label:rangeDays===7?new Date(date+"T12:00:00").toLocaleDateString([],{weekday:"short"}):date.slice(5),sessions:chartSessions.filter(session=>session?.date===date)};
  });
  const chartData = chartBuckets.map(bucket=>{
    const bucketSessions=bucket.sessions.filter(session=>session.exercises?.length);
    const sets=bucketSessions.flatMap(session=>session.exercises||[]).flatMap(exercise=>exercise.sets||[]);
    const maxWeightLb=sets.reduce((best,set)=>Math.max(best,toLb(set.weight,set.unit)),0);
    const estimated1RMlb=sets.reduce((best,set)=>{const weight=toLb(set.weight,set.unit),reps=Number(set.reps);return weight>0&&reps>0?Math.max(best,weight*(1+reps/30)):best;},0);
    const volumeLb=bucketSessions.reduce((total,session)=>total+sessionVolume(session),0);
    const values={volume:Math.round(toDisplay(volumeLb,unit)),maxWeight:Math.round(toDisplay(maxWeightLb,unit)),estimated1RM:Math.round(toDisplay(estimated1RMlb,unit)),sessions:bucketSessions.length};
    return {label:bucket.label,date:bucket.date,value:values[chartMetric]};
  });
  const metricLabels={volume:`Volume (${unit})`,maxWeight:`Max weight (${unit})`,estimated1RM:`Estimated 1RM (${unit})`,sessions:"Sessions"};
  const periodLabel = `${weeks[0].label} – ${new Date(addDaysISO(weeks[11].weekStart, 6) + "T12:00:00").toLocaleDateString([], {month:"numeric",day:"numeric",year:"numeric"})}`;
  const historyControls = (
    <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
      <button onClick={()=>setHistoryPage(page=>Math.min(maxHistoryPage,page+1))} disabled={historyPage>=maxHistoryPage} style={{background:"#161723",border:"1px solid #2A2A3A",borderRadius:6,padding:"4px 8px",color:historyPage>=maxHistoryPage?"#3A3A45":"#9CA3AF",fontSize:10,fontWeight:700,cursor:historyPage>=maxHistoryPage?"default":"pointer",fontFamily:"inherit"}}>← Earlier</button>
      {historyPage>0&&<button onClick={()=>setHistoryPage(page=>Math.max(0,page-1))} style={{background:"#161723",border:"1px solid #2A2A3A",borderRadius:6,padding:"4px 8px",color:"#9CA3AF",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Later →</button>}
      {historyPage>0&&<button onClick={()=>setHistoryPage(0)} style={{background:"rgba(59,130,246,0.1)",border:"1px solid #3B82F650",borderRadius:6,padding:"4px 8px",color:"#60A5FA",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Current</button>}
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column"}}>
      <div style={{order:-20,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:12}}>
        <div style={{display:"flex",gap:4}}>{[[7,"Week"],[28,"Month"],[90,"3 months"]].map(([days,label])=><button key={days} onClick={()=>setRangeDays(days)} style={{background:rangeDays===days?"#3B82F6":"#161723",border:"1px solid "+(rangeDays===days?"#3B82F6":"#2A2A3A"),borderRadius:7,padding:"6px 10px",color:rangeDays===days?"#fff":"#777",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{label}</button>)}</div>
        <button onClick={()=>setCustomizing(value=>!value)} style={{background:"#161723",border:"1px solid #2A2A3A",borderRadius:7,padding:"6px 10px",color:"#9CA3AF",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{customizing?"Done":"Customize"}</button>
      </div>
      {customizing&&<div style={{...card,order:-19,borderColor:"#3B82F645"}}>
        <div style={{...sectionLabel,color:"#93C5FD"}}>CUSTOMIZE DASHBOARD</div>
        <div style={{display:"grid",gap:6}}>{settings.cardOrder.map((id,index)=><div key={id} style={{display:"flex",alignItems:"center",gap:6,background:"#151621",borderRadius:8,padding:"7px 9px"}}><button onClick={()=>toggleCard(id)} style={{background:"none",border:"none",color:settings.hiddenCards.includes(id)?"#555":"#4ADE80",cursor:"pointer",fontFamily:"inherit",fontSize:11,width:48,textAlign:"left"}}>{settings.hiddenCards.includes(id)?"Hidden":"Shown"}</button><span style={{fontSize:11,color:"#D4D4D8",flex:1}}>{CARD_LABELS[id]}</span><button disabled={index===0} onClick={()=>moveCard(id,-1)} style={{background:"none",border:"none",color:index===0?"#333":"#888",cursor:index===0?"default":"pointer"}}>↑</button><button disabled={index===settings.cardOrder.length-1} onClick={()=>moveCard(id,1)} style={{background:"none",border:"none",color:index===settings.cardOrder.length-1?"#333":"#888",cursor:index===settings.cardOrder.length-1?"default":"pointer"}}>↓</button></div>)}</div>
      </div>}
      {priorities.length>0&&<div style={{order:-18,background:"linear-gradient(135deg,rgba(59,130,246,0.13),rgba(34,197,94,0.06))",border:"1px solid #3B82F640",borderRadius:14,padding:"13px 14px",marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:900,color:"#93C5FD",letterSpacing:"0.08em",marginBottom:6}}>TODAY'S PRIORITIES</div>
        <div style={{display:"grid",gap:5}}>{priorities.slice(0,3).map(item=><div key={item.muscle} style={{fontSize:11,color:"#A1A1AA"}}><b style={{color:"#E5E7EB"}}>{MUSCLES[item.muscle]}</b> · {item.remaining.toFixed(1)} estimated sets below target{item.daysSince!=null?` · last trained ${item.daysSince} day${item.daysSince===1?"":"s"} ago`:" · no training in this range"}</div>)}</div>
      </div>}
      {insights.length>0&&(
        <div role="status" style={{order:-17,background:"linear-gradient(135deg,rgba(59,130,246,0.14),rgba(251,191,36,0.08))",border:"1px solid #3B82F645",borderRadius:14,padding:"13px 14px",marginBottom:16,boxShadow:"0 8px 24px rgba(0,0,0,0.18)"}}>
          <div style={{minWidth:0}}>
              <div style={{fontSize:11,fontWeight:900,color:"#93C5FD",letterSpacing:"0.08em",marginBottom:7}}>TRAINING INSIGHT</div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {insights.map(item=><div key={item.type+item.name}><div style={{fontSize:12,fontWeight:800,color:item.type==="deload"?"#FBBF24":"#60A5FA",marginBottom:2}}>{item.type==="deload"?"Recovery signal":"Possible plateau"} · {item.name}</div><div style={{fontSize:11,color:"#A1A1AA",lineHeight:1.45}}>{item.message}</div><div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:5}}>{item.evidence?.map(point=><span key={point.date} title="Estimated one-rep max" style={{fontSize:9,color:"#9CA3AF",background:"rgba(8,9,14,0.5)",borderRadius:5,padding:"2px 6px"}}>{point.date.slice(5)} · {point.estimated1RMlb} lb e1RM</span>)}</div><div style={{fontSize:10,fontWeight:700,color:"#D4D4D8",marginTop:5}}>Next step: {item.action}</div></div>)}
              </div>
              <div style={{fontSize:9,color:"#555",marginTop:8}}>Trend-based guidance, not medical advice.</div>
          </div>
        </div>
      )}
      {coverageGaps.length>0&&(
        <div style={{order:-16,background:"rgba(245,158,11,0.07)",border:"1px solid #F59E0B35",borderRadius:14,padding:"13px 14px",marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:900,color:"#FBBF24",letterSpacing:"0.08em",marginBottom:4}}>MUSCLE COVERAGE</div>
          <div style={{fontSize:10,color:"#777",lineHeight:1.45,marginBottom:9}}>These groups appeared in one or fewer of your last four completed training weeks.</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{coverageGaps.map(item=><div key={item.group} style={{background:"rgba(8,9,14,0.45)",border:"1px solid #F59E0B25",borderRadius:7,padding:"6px 8px"}}><div style={{fontSize:11,fontWeight:800,color:"#FCD34D"}}>{item.group}</div><div style={{fontSize:9,color:"#777",marginTop:1}}>trained {item.activeWeeks} of {item.weeks} weeks</div></div>)}</div>
          <div style={{fontSize:9,color:"#555",marginTop:8}}>Custom exercises without a muscle guide cannot be classified yet.</div>
        </div>
      )}
      <div style={cardStyle("heatmap")}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:10,flexWrap:"wrap"}}>
          <div><div style={{...sectionLabel,marginBottom:3}}>BODY MUSCLE HEATMAP</div><div style={{fontSize:10,color:"#555"}}>Coverage from {heatmap.start} through {heatmap.end}</div></div>
          <div style={{display:"flex",gap:4}}>{[["coverage","Coverage"],["sets","Set volume"]].map(([mode,label])=><button key={mode} onClick={()=>setHeatmapMode(mode)} style={{background:heatmapMode===mode?"#3B82F6":"#161723",border:"1px solid "+(heatmapMode===mode?"#3B82F6":"#2A2A3A"),borderRadius:7,padding:"5px 9px",color:heatmapMode===mode?"#fff":"#777",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{label}</button>)}</div>
        </div>
        <MuscleHeatmap scores={heatmapMode==="sets"?setVolume.sets:heatmap.scores} onSelect={setSelectedMuscle} selected={selectedMuscle} mode={heatmapMode}/>
        <div style={{display:"flex",justifyContent:"center",gap:10,flexWrap:"wrap",fontSize:9,color:"#777",marginTop:4}}>{heatmapMode==="coverage"?<><span><b style={{color:"#22C55E"}}>●</b> repeated</span><span><b style={{color:"#3B82F6"}}>●</b> trained</span><span><b style={{color:"#F59E0B"}}>●</b> secondary</span><span><b style={{color:"#7F1D1D"}}>●</b> missed</span></>:<><span><b style={{color:"#3B82F6"}}>●</b> 1–5 low</span><span><b style={{color:"#22C55E"}}>●</b> 6–12 moderate</span><span><b style={{color:"#F59E0B"}}>●</b> 13–20 high</span><span><b style={{color:"#A855F7"}}>●</b> 20+ review</span><span><b style={{color:"#7F1D1D"}}>●</b> none</span></>}</div>
        <div style={{fontSize:9,color:"#555",textAlign:"center",marginTop:5}}>Tap a muscle to view its target and training history.</div>
        <div style={{marginTop:11,borderTop:"1px solid #1A1B28",paddingTop:9}}><div style={{fontSize:10,fontWeight:800,color:heatmap.missed.length?"#F87171":"#4ADE80",marginBottom:6}}>{heatmap.missed.length?`MISSED IN THIS ${rangeDays===7?"WEEK":rangeDays===28?"MONTH":"3-MONTH RANGE"}`:"FULL COVERAGE"}</div>{heatmap.missed.length?<div style={{display:"flex",flexWrap:"wrap",gap:4}}>{heatmap.missed.map(muscle=><button onClick={()=>setSelectedMuscle(muscle)} key={muscle} style={{fontSize:9,color:"#FCA5A5",background:"rgba(127,29,29,0.18)",border:"1px solid #7F1D1D55",borderRadius:5,padding:"3px 6px",cursor:"pointer",fontFamily:"inherit"}}>{MUSCLES[muscle]}</button>)}</div>:<div style={{fontSize:10,color:"#777"}}>Every mapped muscle received primary or secondary work in this period.</div>}</div>
        {exerciseSuggestions.suggestions.length>0&&<div style={{marginTop:11,borderTop:"1px solid #1A1B28",paddingTop:9}}>
          <div style={{fontSize:10,fontWeight:800,color:"#93C5FD",marginBottom:3}}>EXERCISES TO FILL THE GAPS</div>
          <div style={{fontSize:9,color:"#555",lineHeight:1.4,marginBottom:7}}>A compact set chosen from the app's verified muscle guide. Direct work is preferred over supporting involvement.</div>
          {latestReadiness?.pain&&<div style={{fontSize:9,color:"#FCA5A5",background:"rgba(239,68,68,0.08)",borderRadius:6,padding:"6px 7px",marginBottom:7}}>Your latest check-in reported pain. Treat these as planning ideas only; avoid painful movements and seek qualified advice if pain persists.</div>}
          {!latestReadiness?.pain&&Number(latestReadiness?.soreness)>=4&&<div style={{fontSize:9,color:"#FBBF24",background:"rgba(245,158,11,0.08)",borderRadius:6,padding:"6px 7px",marginBottom:7}}>Your latest soreness was high. Consider recovery before adding more work.</div>}
          <div style={{display:"grid",gap:6}}>{exerciseSuggestions.suggestions.map((item,index)=><div key={item.name} style={{background:"rgba(59,130,246,0.06)",border:"1px solid #3B82F625",borderRadius:8,padding:"8px 9px"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}><div style={{fontSize:11,fontWeight:800,color:"#DCEAFE"}}>{index+1}. {item.name}</div>{onAddExercise&&<button onClick={()=>onAddExercise(item.name)} style={{background:"#2563EB",border:"none",borderRadius:6,padding:"4px 7px",color:"#fff",fontSize:9,fontWeight:800,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>Add to workout</button>}</div>
            {item.direct.length>0&&<div style={{fontSize:9,color:"#60A5FA",marginTop:3}}>Direct: {item.direct.map(muscle=>MUSCLES[muscle]).join(", ")}</div>}
            {item.supporting.length>0&&<div style={{fontSize:9,color:"#FBBF24",marginTop:2}}>Supporting: {item.supporting.map(muscle=>MUSCLES[muscle]).join(", ")}</div>}
          </div>)}</div>
          {exerciseSuggestions.uncovered.length>0&&<div style={{fontSize:9,color:"#FCA5A5",marginTop:6}}>No verified exercise mapping for: {exerciseSuggestions.uncovered.map(muscle=>MUSCLES[muscle]).join(", ")}.</div>}
        </div>}
        {selectedPriority&&<div style={{marginTop:11,borderTop:"1px solid #1A1B28",paddingTop:10,background:"#0B0C14",borderRadius:9,padding:"10px"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}><div style={{fontSize:12,fontWeight:900,color:"#E5E7EB"}}>{MUSCLES[selectedMuscle]}</div><button onClick={()=>setSelectedMuscle(null)} style={{background:"none",border:"none",color:"#777",cursor:"pointer",fontSize:16}}>×</button></div>
          <div style={{fontSize:10,color:"#9CA3AF",marginTop:4}}>{selectedPriority.done.toFixed(1)} of {selectedPriority.target} estimated sets · {selectedPriority.pct}%</div>
          <div style={{height:6,background:"#1A1B28",borderRadius:4,overflow:"hidden",marginTop:6}}><div style={{height:"100%",width:selectedPriority.pct+"%",background:selectedPriority.pct>=100?"#22C55E":"#3B82F6"}}/></div>
          <label style={{display:"flex",alignItems:"center",gap:7,fontSize:9,color:"#777",marginTop:8}}>Weekly target sets <input type="number" min="1" max="40" value={settings.targets[selectedMuscle]} onChange={event=>saveSettings({targets:{...settings.targets,[selectedMuscle]:Math.max(1,Math.min(40,Number(event.target.value)||1))}})} style={{width:52,background:"#161723",border:"1px solid #2A2A3A",borderRadius:6,padding:"4px",color:"#E5E7EB",fontFamily:"inherit"}}/></label>
          <div style={{fontSize:9,fontWeight:800,color:"#93C5FD",marginTop:9}}>RECENT EXERCISES</div>{selectedHistory.length?<div style={{display:"grid",gap:3,marginTop:4}}>{selectedHistory.map((item,index)=><div key={item.date+item.name+index} style={{fontSize:9,color:"#777"}}>{item.date} · {item.name} · {item.sets} set{item.sets===1?"":"s"}</div>)}</div>:<div style={{fontSize:9,color:"#555",marginTop:4}}>No matching exercise in this range.</div>}
        </div>}
        <div style={{fontSize:9,color:"#444",marginTop:8}}>Primary work counts fully; secondary work appears amber. Custom exercises need a muscle guide before they can affect this map.</div>
      </div>
      <div style={cardStyle("summary")}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:10}}><div style={{...sectionLabel,marginBottom:0}}>RANGE SUMMARY</div><label style={{fontSize:9,color:"#666"}}>Planned days <input type="number" min="1" max="7" value={settings.plannedDays} onChange={event=>saveSettings({plannedDays:Math.max(1,Math.min(7,Number(event.target.value)||1))})} style={{width:36,marginLeft:4,background:"#161723",border:"1px solid #2A2A3A",borderRadius:5,padding:"3px",color:"#E5E7EB",fontFamily:"inherit"}}/></label></div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#3B82F6" }}>{rangeSummary.sessions}</div>
            <div style={{ fontSize: 11, color: "#555" }}>Session{rangeSummary.sessions !== 1 ? "s" : ""} logged</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#22C55E" }}>
              {fmtVolume(rangeSummary.volume, unit)}<span style={{ fontSize: 12, color: "#666", fontWeight: 600 }}> {unit}</span>
            </div>
            <div style={{ fontSize: 11, color: "#555" }}>Total volume</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#F59E0B" }}>{rangeSummary.sets}</div>
            <div style={{ fontSize: 11, color: "#555" }}>Working sets</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: rangeSummary.workoutDays>=Math.ceil(settings.plannedDays*rangeDays/7)?"#22C55E":"#8B5CF6" }}>{rangeSummary.workoutDays}<span style={{fontSize:12,color:"#666"}}> / {Math.ceil(settings.plannedDays*rangeDays/7)}</span></div>
            <div style={{ fontSize: 11, color: "#555" }}>Planned workout days</div>
          </div>
        </div>
      </div>

      <div style={cardStyle("calendar")}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:12,flexWrap:"wrap"}}>
          <div><div style={{...sectionLabel,marginBottom:3}}>TRAINING CALENDAR</div><div style={{fontSize:10,color:"#555"}}>{periodLabel} · darker squares mean more sessions</div></div>
          <div style={{display:"flex",gap:14}}>
            <div style={{textAlign:"center"}}><div style={{fontSize:17,fontWeight:900,color:"#3B82F6"}}>{consistency.workouts}</div><div style={{fontSize:9,color:"#555"}}>days / 28</div></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:17,fontWeight:900,color:"#22C55E"}}>{consistency.activeWeeks}</div><div style={{fontSize:9,color:"#555"}}>active weeks</div></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:17,fontWeight:900,color:consistency.goalPct>=80?"#22C55E":consistency.goalPct>=50?"#F59E0B":"#9CA3AF"}}>{consistency.goalPct}%</div><div style={{fontSize:9,color:"#555"}}>5-day goal</div></div>
          </div>
        </div>
        <div style={{marginBottom:10}}>{historyControls}</div>
        <div style={{display:"grid",gridTemplateColumns:"18px minmax(0,1fr)",gap:6,alignItems:"stretch"}}>
          <div style={{display:"grid",gridTemplateRows:"repeat(7,1fr)",gap:4,fontSize:8,color:"#555",textAlign:"right",alignItems:"center"}}>{["M","","W","","F","",""] .map((label,index)=><span key={index}>{label}</span>)}</div>
          <div aria-label="12-week training calendar" style={{display:"grid",gridTemplateColumns:`repeat(${calendar.length},minmax(6px,1fr))`,gap:4,minWidth:0}}>
            {calendar.map((week,wi)=><div key={wi} style={{display:"grid",gridTemplateRows:"repeat(7,1fr)",gap:4,minWidth:0}}>{week.map(day=><button key={day.date} onClick={()=>day.count&&setSelectedDate(day.date)} disabled={!day.count} aria-label={`${day.date}: ${day.count} session${day.count===1?"":"s"}${day.count?". View details.":""}`} title={`${day.date}: ${day.count} session${day.count===1?"":"s"}`} style={{display:"block",aspectRatio:"1",width:"100%",minWidth:0,padding:0,borderRadius:3,background:day.future?"#0B0C13":day.count>1?"#2563EB":day.count===1?"#3B82F6":"#171824",border:"1px solid "+(selectedDate===day.date?"#F8FAFC":day.count?"#60A5FA30":"#1E203520"),boxSizing:"border-box",opacity:day.future?0.35:1,cursor:day.count?"pointer":"default",boxShadow:selectedDate===day.date?"0 0 0 2px #60A5FA55":"none"}} />)}</div>)}
          </div>
        </div>
        <div style={{height:5,borderRadius:4,background:"#161723",overflow:"hidden",marginTop:12}}><div style={{height:"100%",width:consistency.goalPct+"%",background:consistency.goalPct>=80?"#22C55E":"#3B82F6",borderRadius:4}} /></div>
        {selectedSessions.length>0&&(
          <div style={{marginTop:12,background:"#0B0C14",border:"1px solid #2A2C45",borderRadius:10,padding:"11px 12px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:8}}>
              <div><div style={{fontSize:12,fontWeight:800,color:"#E5E7EB"}}>{new Date(selectedDate+"T12:00:00").toLocaleDateString([], {weekday:"long",month:"short",day:"numeric",year:"numeric"})}</div><div style={{fontSize:9,color:"#555",marginTop:1}}>{selectedSessions.length} saved workout{selectedSessions.length===1?"":"s"}</div></div>
              <button onClick={()=>setSelectedDate(null)} aria-label="Close workout details" style={{background:"#161723",border:"1px solid #2A2A3A",borderRadius:7,width:26,height:26,color:"#888",fontSize:17,cursor:"pointer",fontFamily:"inherit"}}>×</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>{selectedSessions.map((session,index)=><div key={session.id||index} style={{background:"#10111A",border:"1px solid #1C1E30",borderRadius:8,padding:"8px 10px"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"baseline",marginBottom:5}}><span style={{fontSize:11,fontWeight:800,color:"#60A5FA"}}>{session.day||"Workout"}</span><span style={{fontSize:9,color:"#666"}}>{fmtVolume(sessionVolume(session),unit)} {unit} volume</span></div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{(session.exercises||[]).map((exercise,exerciseIndex)=><span key={(exercise.name||"exercise")+exerciseIndex} style={{fontSize:9,color:"#A1A1AA",background:"#171824",borderRadius:5,padding:"2px 6px"}}>{exercise.name} · {(exercise.sets||[]).length} set{(exercise.sets||[]).length===1?"":"s"}</span>)}</div>
              {session.notes&&<div style={{fontSize:9,color:"#777",lineHeight:1.4,marginTop:6}}>“{session.notes}”</div>}
            </div>)}</div>
          </div>
        )}
      </div>

      <div style={cardStyle("trend")}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:10}}><div style={{...sectionLabel,marginBottom:0}}>TRAINING TREND <span style={{ color: "#555", fontWeight: 500 }}>· {metricLabels[chartMetric]}</span></div>{historyControls}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
          <select aria-label="Chart exercise" value={chartExercise} onChange={event=>setChartExercise(event.target.value)} style={{flex:"1 1 160px",minWidth:0,background:"#161723",border:"1px solid #2A2A3A",borderRadius:7,padding:"6px 8px",color:"#9CA3AF",fontSize:10,fontFamily:"inherit"}}><option value="all">All exercises</option>{exerciseNames.map(name=><option key={name} value={name}>{name}</option>)}</select>
          <select aria-label="Chart metric" value={chartMetric} onChange={event=>setChartMetric(event.target.value)} style={{flex:"1 1 130px",minWidth:0,background:"#161723",border:"1px solid #2A2A3A",borderRadius:7,padding:"6px 8px",color:"#9CA3AF",fontSize:10,fontFamily:"inherit"}}><option value="volume">Volume</option><option value="maxWeight">Max weight</option><option value="estimated1RM">Estimated 1RM</option><option value="sessions">Sessions</option></select>
          <div style={{fontSize:9,color:"#666",padding:"6px 4px"}}>Shared {rangeDays}-day range</div>
        </div>
        <div style={{ width: "100%", height: 180 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid stroke="#1E2035" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#444" tick={{ fontSize: 9 }} interval={rangeDays===7?0:rangeDays===28?3:9} minTickGap={5} />
              <YAxis stroke="#444" tick={{ fontSize: 10 }} />
              <Tooltip labelFormatter={(_,payload)=>payload?.[0]?.payload?.date||""} contentStyle={{ background: "#161723", border: "1px solid #2A2A3A", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" name={metricLabels[chartMetric]} fill="#3B82F6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={cardStyle("balance")}>
        <div style={sectionLabel}>MUSCLE BALANCE <span style={{ color: "#444", fontWeight: 500 }}>({rangeDays}-day range)</span></div>
        {balance.length === 0
          ? <div style={{ fontSize: 12, color: "#555", padding: "8px 0" }}>Not enough logged exercises to attribute volume to muscle groups yet.</div>
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {balance.map(b => (
                <div key={b.group}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "#ECEAF4", fontWeight: 600 }}>{b.group}</span>
                    <span style={{ color: "#888" }}>{b.pct}%</span>
                  </div>
                  <div style={{ width: "100%", height: 8, background: "#161723", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: b.pct + "%", height: "100%", background: GROUP_COLORS[b.group] || "#9CA3AF", borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
