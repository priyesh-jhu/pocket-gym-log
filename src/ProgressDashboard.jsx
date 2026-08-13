import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { activityCalendar, consistencySummary, dominantUnit, weeklyVolume, weekSummary, muscleBalance, sessionVolume, toLb, weekStartISO } from "./stats.js";
import { trainingInsights } from "./trainingInsights.js";
import { addDaysISO, todayISO } from "./dateUtils.js";

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

export default function ProgressDashboard({ sessions }) {
  const list = Array.isArray(sessions) ? sessions : [];
  const [historyPage, setHistoryPage] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);
  const [chartWeeks, setChartWeeks] = useState(12);
  const [chartExercise, setChartExercise] = useState("all");
  const [chartMetric, setChartMetric] = useState("volume");

  if (list.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px", color: "#444", fontSize: 13 }}>
        Log a few sessions first to see your training overview.
      </div>
    );
  }

  const unit = dominantUnit(list);
  const summary = weekSummary(list);
  const currentWeek = weekStartISO(todayISO());
  const periodEnd = historyPage === 0 ? todayISO() : addDaysISO(currentWeek, -1 - ((historyPage - 1) * 84));
  const oldestWeek = list.reduce((oldest, session) => session?.date && weekStartISO(session.date) < oldest ? weekStartISO(session.date) : oldest, currentWeek);
  const oldestWeeksAgo = Math.max(0, Math.round((new Date(currentWeek + "T12:00:00") - new Date(oldestWeek + "T12:00:00")) / 604800000));
  const maxHistoryPage = Math.floor(oldestWeeksAgo / 12);
  const weeks = weeklyVolume(list, 12, periodEnd);
  const balance = muscleBalance(list, 4);
  const calendar = activityCalendar(list, 12, periodEnd);
  const consistency = consistencySummary(list);
  const insights = trainingInsights(list);
  const selectedSessions = selectedDate ? list.filter(session=>session?.date===selectedDate) : [];

  const exerciseNames = [...new Set(list.flatMap(session=>(session.exercises||[]).map(exercise=>exercise.name)).filter(Boolean))].sort();
  const chartSessions = chartExercise==="all" ? list : list.map(session=>({...session,exercises:(session.exercises||[]).filter(exercise=>exercise.name===chartExercise)}));
  const chartBuckets = weeklyVolume(chartSessions,chartWeeks,periodEnd);
  const chartData = chartBuckets.map(bucket=>{
    const bucketSessions=chartSessions.filter(session=>session?.date&&weekStartISO(session.date)===bucket.weekStart&&session.exercises?.length);
    const sets=bucketSessions.flatMap(session=>session.exercises||[]).flatMap(exercise=>exercise.sets||[]);
    const maxWeightLb=sets.reduce((best,set)=>Math.max(best,toLb(set.weight,set.unit)),0);
    const estimated1RMlb=sets.reduce((best,set)=>{const weight=toLb(set.weight,set.unit),reps=Number(set.reps);return weight>0&&reps>0?Math.max(best,weight*(1+reps/30)):best;},0);
    const values={volume:Math.round(toDisplay(bucket.volume,unit)),maxWeight:Math.round(toDisplay(maxWeightLb,unit)),estimated1RM:Math.round(toDisplay(estimated1RMlb,unit)),sessions:bucketSessions.length};
    return {label:bucket.label,value:values[chartMetric]};
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

  const deltaColor = summary.deltaPct === null ? "#9CA3AF" : summary.deltaPct >= 0 ? "#22C55E" : summary.deltaPct >= -10 ? "#F59E0B" : "#EF4444";
  const deltaText = summary.deltaPct === null ? "No data last week" : (summary.deltaPct >= 0 ? "▲ +" : "▼ ") + Math.abs(summary.deltaPct) + "% vs last week";

  return (
    <div>
      {insights.length>0&&(
        <div role="status" style={{background:"linear-gradient(135deg,rgba(59,130,246,0.14),rgba(251,191,36,0.08))",border:"1px solid #3B82F645",borderRadius:14,padding:"13px 14px",marginBottom:16,boxShadow:"0 8px 24px rgba(0,0,0,0.18)"}}>
          <div style={{minWidth:0}}>
              <div style={{fontSize:11,fontWeight:900,color:"#93C5FD",letterSpacing:"0.08em",marginBottom:7}}>TRAINING INSIGHT</div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {insights.map(item=><div key={item.type+item.name}><div style={{fontSize:12,fontWeight:800,color:item.type==="deload"?"#FBBF24":"#60A5FA",marginBottom:2}}>{item.type==="deload"?"Recovery signal":"Possible plateau"} · {item.name}</div><div style={{fontSize:11,color:"#A1A1AA",lineHeight:1.45}}>{item.message}</div><div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:5}}>{item.evidence?.map(point=><span key={point.date} title="Estimated one-rep max" style={{fontSize:9,color:"#9CA3AF",background:"rgba(8,9,14,0.5)",borderRadius:5,padding:"2px 6px"}}>{point.date.slice(5)} · {point.estimated1RMlb} lb e1RM</span>)}</div><div style={{fontSize:10,fontWeight:700,color:"#D4D4D8",marginTop:5}}>Next step: {item.action}</div></div>)}
              </div>
              <div style={{fontSize:9,color:"#555",marginTop:8}}>Trend-based guidance, not medical advice.</div>
          </div>
        </div>
      )}
      <div style={card}>
        <div style={sectionLabel}>THIS WEEK</div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#3B82F6" }}>{summary.sessions}</div>
            <div style={{ fontSize: 11, color: "#555" }}>Session{summary.sessions !== 1 ? "s" : ""} logged</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#22C55E" }}>
              {fmtVolume(summary.volume, unit)}<span style={{ fontSize: 12, color: "#666", fontWeight: 600 }}> {unit}</span>
            </div>
            <div style={{ fontSize: 11, color: "#555" }}>Total volume</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: deltaColor }}>{deltaText}</div>
            <div style={{ fontSize: 11, color: "#555" }}>vs previous week</div>
          </div>
        </div>
      </div>

      <div style={card}>
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

      <div style={card}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:10}}><div style={{...sectionLabel,marginBottom:0}}>TRAINING TREND <span style={{ color: "#555", fontWeight: 500 }}>· {metricLabels[chartMetric]}</span></div>{historyControls}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
          <select aria-label="Chart exercise" value={chartExercise} onChange={event=>setChartExercise(event.target.value)} style={{flex:"1 1 160px",minWidth:0,background:"#161723",border:"1px solid #2A2A3A",borderRadius:7,padding:"6px 8px",color:"#9CA3AF",fontSize:10,fontFamily:"inherit"}}><option value="all">All exercises</option>{exerciseNames.map(name=><option key={name} value={name}>{name}</option>)}</select>
          <select aria-label="Chart metric" value={chartMetric} onChange={event=>setChartMetric(event.target.value)} style={{flex:"1 1 130px",minWidth:0,background:"#161723",border:"1px solid #2A2A3A",borderRadius:7,padding:"6px 8px",color:"#9CA3AF",fontSize:10,fontFamily:"inherit"}}><option value="volume">Volume</option><option value="maxWeight">Max weight</option><option value="estimated1RM">Estimated 1RM</option><option value="sessions">Sessions</option></select>
          <div style={{display:"flex",gap:4}}>{[4,12,26,52].map(value=><button key={value} onClick={()=>setChartWeeks(value)} style={{background:chartWeeks===value?"#3B82F6":"#161723",border:"1px solid "+(chartWeeks===value?"#3B82F6":"#2A2A3A"),borderRadius:6,padding:"5px 7px",color:chartWeeks===value?"#fff":"#777",fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{value}w</button>)}</div>
        </div>
        <div style={{ width: "100%", height: 180 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid stroke="#1E2035" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#444" tick={{ fontSize: 10 }} />
              <YAxis stroke="#444" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#161723", border: "1px solid #2A2A3A", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" name={metricLabels[chartMetric]} fill="#3B82F6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={card}>
        <div style={sectionLabel}>MUSCLE BALANCE <span style={{ color: "#444", fontWeight: 500 }}>(last 4 weeks)</span></div>
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
