import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { activityCalendar, consistencySummary, dominantUnit, weeklyVolume, muscleBalance, muscleCoverageGaps, muscleHeatmapCoverage, exerciseSuggestionsForMissed, muscleSetVolume, dashboardRangeSummary, musclePriorities, pushPullRatio, sessionVolume, toLb, weekStartISO } from "./stats.js";
import { trainingInsights } from "./trainingInsights.js";
import { addDaysISO, todayISO } from "./dateUtils.js";
import { MUSCLES, formGuide } from "./data/formGuide.js";
import MuscleHeatmap from "./MuscleHeatmap.jsx";
import { Button, Card, Sheet } from "./components/index.js";
import { normalizeDashboardSettings } from "./progressDashboardSettings.js";
import useThemeTokens from "./charts/useThemeTokens.js";
import "./ProgressDashboard.css";

const KG_PER_LB = 1 / 2.20462;

function toDisplay(lb, unit) {
  return unit === "kg" ? lb * KG_PER_LB : lb;
}

function fmtVolume(lb, unit) {
  return Math.round(toDisplay(lb, unit)).toLocaleString();
}

const card = { background: "#0F1018", border: "1px solid #16172A", borderRadius: 14, padding: "16px", marginBottom: 16 };
const sectionLabel = { fontSize: 12, color: "#666", fontWeight: 700, marginBottom: 10 };
export default function ProgressDashboard({ sessions, preferences={}, onAddExercise, embeddedGroup=null, settings:providedSettings, onSaveSettings }) {
  const list = Array.isArray(sessions) ? sessions : [];
  const chartTheme = useThemeTokens();
  const [historyPage, setHistoryPage] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);
  const [chartExercise, setChartExercise] = useState("all");
  const [chartMetric, setChartMetric] = useState("volume");
  const [heatmapMode, setHeatmapMode] = useState("coverage");
  const [selectedMuscle, setSelectedMuscle] = useState(null);
  const [muscleSheetOpen, setMuscleSheetOpen] = useState(false);
  const settings=providedSettings||normalizeDashboardSettings(preferences);
  const rangeDays=settings.rangeDays;
  const saveSettings=changes=>onSaveSettings?.(changes);
  const cardStyle=id=>({...card,display:settings.hiddenCards.includes(id)?"none":undefined,order:settings.cardOrder.indexOf(id)});
  const openMuscleDetails=muscle=>{setSelectedMuscle(muscle||heatmap.missed[0]||null);setMuscleSheetOpen(true);};

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
  const pushPull = pushPullRatio(list, rangeDays);
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
    <div className={`progress-dashboard${embeddedGroup ? ` progress-dashboard--${embeddedGroup}` : ""}`}>
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
      <div className="progress-legacy-card progress-legacy-card--heatmap" style={cardStyle("heatmap")}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:10,flexWrap:"wrap"}}>
          <div><div style={{...sectionLabel,marginBottom:3}}>BODY MUSCLE HEATMAP</div><div style={{fontSize:10,color:"#555"}}>Coverage from {heatmap.start} through {heatmap.end}</div></div>
          <div style={{display:"flex",gap:4}}>{[["coverage","Coverage"],["sets","Set volume"]].map(([mode,label])=><button key={mode} onClick={()=>setHeatmapMode(mode)} style={{background:heatmapMode===mode?"#3B82F6":"#161723",border:"1px solid "+(heatmapMode===mode?"#3B82F6":"#2A2A3A"),borderRadius:7,padding:"5px 9px",color:heatmapMode===mode?"#fff":"#777",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{label}</button>)}</div>
        </div>
        <MuscleHeatmap scores={heatmapMode==="sets"?setVolume.sets:heatmap.scores} onSelect={openMuscleDetails} selected={selectedMuscle} mode={heatmapMode}/>
        <div style={{display:"flex",justifyContent:"center",gap:10,flexWrap:"wrap",fontSize:9,color:"#777",marginTop:4}}>{heatmapMode==="coverage"?<><span><b style={{color:"#22C55E"}}>●</b> repeated</span><span><b style={{color:"#3B82F6"}}>●</b> trained</span><span><b style={{color:"#F59E0B"}}>●</b> secondary</span><span><b style={{color:"#7F1D1D"}}>●</b> missed</span></>:<><span><b style={{color:"#3B82F6"}}>●</b> 1–5 low</span><span><b style={{color:"#22C55E"}}>●</b> 6–12 moderate</span><span><b style={{color:"#F59E0B"}}>●</b> 13–20 high</span><span><b style={{color:"#A855F7"}}>●</b> 20+ review</span><span><b style={{color:"#7F1D1D"}}>●</b> none</span></>}</div>
        <div style={{fontSize:9,color:"#555",textAlign:"center",marginTop:5}}>Tap a muscle to view its target and training history.</div>
        <div className="progress-coverage-action">
          <div><strong>{heatmap.missed.length?`${heatmap.missed.length} muscle groups need attention`:"Full coverage"}</strong><span>{heatmap.missed.length?"Review gaps and verified exercise suggestions.":"Every mapped muscle received work in this period."}</span></div>
          {heatmap.missed.length>0&&<Button variant="tonal" onClick={()=>openMuscleDetails()}>Review</Button>}
        </div>
        <Sheet open={muscleSheetOpen} title="Muscle coverage" onClose={()=>setMuscleSheetOpen(false)}>
          <div className="progress-muscle-chips">{heatmap.missed.map(muscle=><button type="button" aria-pressed={selectedMuscle===muscle} onClick={()=>setSelectedMuscle(muscle)} key={muscle}>{MUSCLES[muscle]}</button>)}</div>
          {selectedPriority&&<div className="progress-muscle-detail">
            <h3>{MUSCLES[selectedMuscle]}</h3><p>{selectedPriority.done.toFixed(1)} of {selectedPriority.target} estimated sets · {selectedPriority.pct}%</p>
            <div className="progress-target-track"><span style={{width:selectedPriority.pct+"%"}} /></div>
            <label>Weekly target sets <input type="number" min="1" max="40" value={settings.targets[selectedMuscle]} onChange={event=>saveSettings({targets:{...settings.targets,[selectedMuscle]:Math.max(1,Math.min(40,Number(event.target.value)||1))}})}/></label>
            <h4>Recent exercises</h4>{selectedHistory.length?<div className="progress-history-list">{selectedHistory.map((item,index)=><div key={item.date+item.name+index}>{item.date} · {item.name} · {item.sets} set{item.sets===1?"":"s"}</div>)}</div>:<p>No matching exercise in this range.</p>}
          </div>}
          {exerciseSuggestions.suggestions.length>0&&<div className="progress-suggestions"><h3>Exercises to fill the gaps</h3><p>Chosen from the app's verified muscle guide, with direct work preferred.</p>
            {latestReadiness?.pain&&<div className="progress-caution">Your latest check-in reported pain. Avoid painful movements and seek qualified advice if pain persists.</div>}
            {!latestReadiness?.pain&&Number(latestReadiness?.soreness)>=4&&<div className="progress-caution">Your latest soreness was high. Consider recovery before adding more work.</div>}
            {exerciseSuggestions.suggestions.map(item=><div key={item.name} className="progress-suggestion"><div><strong>{item.name}</strong><span>{item.direct.length?`Direct: ${item.direct.map(muscle=>MUSCLES[muscle]).join(", ")}`:`Supporting: ${item.supporting.map(muscle=>MUSCLES[muscle]).join(", ")}`}</span></div>{onAddExercise&&<Button onClick={()=>onAddExercise(item.name)}>Add</Button>}</div>)}
          </div>}
        </Sheet>
        <div style={{fontSize:9,color:"#444",marginTop:8}}>Primary work counts fully; secondary work appears amber. Custom exercises need a muscle guide before they can affect this map.</div>
      </div>
      <div className="progress-legacy-card progress-legacy-card--summary" style={cardStyle("summary")}>
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

      <div className="progress-legacy-card progress-legacy-card--calendar" style={cardStyle("calendar")}>
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

      <div className="progress-legacy-card progress-legacy-card--trend" style={cardStyle("trend")}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:10}}><div style={{...sectionLabel,marginBottom:0}}>TRAINING TREND <span style={{ color: "#555", fontWeight: 500 }}>· {metricLabels[chartMetric]}</span></div>{historyControls}</div>
        <div className="progress-trend-controls">
          <label><span>Exercise</span><select aria-label="Chart exercise" value={chartExercise} onChange={event=>setChartExercise(event.target.value)}><option value="all">All exercises</option>{exerciseNames.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
          <label><span>Metric</span><select aria-label="Chart metric" value={chartMetric} onChange={event=>setChartMetric(event.target.value)}><option value="volume">Volume</option><option value="maxWeight">Max weight</option><option value="estimated1RM">Estimated 1RM</option><option value="sessions">Sessions</option></select></label>
        </div>
        <div className="progress-trend-chart">
          <ResponsiveContainer minWidth={0} minHeight={0}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="label" stroke={chartTheme.axis} tick={{ fontSize: 11 }} interval={rangeDays===7?0:rangeDays===28?3:9} minTickGap={5} />
              <YAxis stroke={chartTheme.axis} tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(_,payload)=>payload?.[0]?.payload?.date||""} contentStyle={{ background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="value" name={metricLabels[chartMetric]} fill={chartTheme.primary} radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="progress-legacy-card progress-legacy-card--balance" style={cardStyle("balance")}>
        <div style={sectionLabel}>MUSCLE BALANCE <span style={{ color: "var(--on-surface-dim)", fontWeight: 500 }}>({rangeDays}-day range)</span></div>
        <div className="progress-push-pull" aria-label={`${pushPull.pushPct}% push and ${pushPull.pullPct}% pull`}>
          <div className="progress-push-pull__labels"><span><strong>{pushPull.pushPct}%</strong> Push</span><span>Pull <strong>{pushPull.pullPct}%</strong></span></div>
          <div className="progress-push-pull__track"><span style={{width:`${pushPull.pushPct}%`}} /><span style={{width:`${pushPull.pullPct}%`}} /></div>
          <p>{pushPull.push+pushPull.pull>0?"Based on mapped working sets in this range.":"Log mapped push and pull exercises to see your ratio."}</p>
        </div>
        {balance.length === 0
          ? <div className="progress-balance-empty">Not enough logged exercises to attribute volume to muscle groups yet.</div>
          : (
            <div className="progress-balance-list">
              {balance.map(b => (
                <div key={b.group} className="progress-balance-row">
                  <div>
                    <span>{b.group}</span><span>{b.pct}%</span>
                  </div>
                  <div className="progress-balance-track">
                    <div className={`progress-balance-fill progress-balance-fill--${b.group.toLowerCase()}`} style={{ width: b.pct + "%" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

export function DailyTrendGroup(props) {
  return <Card className="progress-group progress-group--trend"><h2 className="progress-group-title">Daily trend</h2><ProgressDashboard {...props} embeddedGroup="trend" /></Card>;
}

export function BodyHeatmapGroup(props) {
  return <Card className="progress-group progress-group--heatmap"><h2 className="progress-group-title">Body heatmap</h2><ProgressDashboard {...props} embeddedGroup="heatmap" /></Card>;
}

export function BalanceGroup(props) {
  return <Card className="progress-group progress-group--balance"><h2 className="progress-group-title">Balance</h2><ProgressDashboard {...props} embeddedGroup="balance" /></Card>;
}
