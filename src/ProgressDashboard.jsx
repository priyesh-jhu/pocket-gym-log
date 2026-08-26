import { useRef, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { activityCalendar, consistencySummary, dominantUnit, weeklyVolume, muscleBalance, muscleHeatmapCoverage, exerciseSuggestionsForMissed, muscleSetVolume, dashboardRangeSummary, musclePriorities, pushPullRatio, sessionVolume, toLb, weekStartISO } from "./stats.js";
import { addDaysISO, todayISO } from "./dateUtils.js";
import { MUSCLES, formGuide } from "./data/formGuide.js";
import MuscleHeatmap from "./MuscleHeatmap.jsx";
import { Button, Card, SegmentedButtons, Sheet } from "./components/index.js";
import { normalizeDashboardSettings } from "./progressDashboardSettings.js";
import useThemeTokens from "./charts/useThemeTokens.js";

const KG_PER_LB = 1 / 2.20462;

function toDisplay(lb, unit) {
  return unit === "kg" ? lb * KG_PER_LB : lb;
}

function fmtVolume(lb, unit) {
  return Math.round(toDisplay(lb, unit)).toLocaleString();
}

export default function ProgressDashboard({ sessions, preferences={}, onAddExercise, embeddedGroup=null, settings:providedSettings, onSaveSettings, reducedMotion=false }) {
  const list = Array.isArray(sessions) ? sessions : [];
  const chartTheme = useThemeTokens();
  const [historyPage, setHistoryPage] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);
  const dateButtonRefs = useRef(new Map());
  const [chartExercise, setChartExercise] = useState("all");
  const [chartMetric, setChartMetric] = useState("volume");
  const [heatmapMode, setHeatmapMode] = useState("coverage");
  const [selectedMuscle, setSelectedMuscle] = useState(null);
  const [muscleSheetOpen, setMuscleSheetOpen] = useState(false);
  const guidanceInitialRef = useRef(null);
  const guidanceReturnRef = useRef(null);
  const settings=providedSettings||normalizeDashboardSettings(preferences);
  const rangeDays=settings.rangeDays;
  const saveSettings=changes=>onSaveSettings?.(changes);
  const rendersGroup = id => !embeddedGroup || embeddedGroup === id;
  const openMuscleDetails=(muscle, invoker)=>{guidanceReturnRef.current=invoker||document.activeElement;setSelectedMuscle(muscle||heatmap.missed[0]||null);setMuscleSheetOpen(true);};

  if (list.length === 0) {
    return (
      <div className="progress-dashboard-empty">
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
  let balance = [];
  let pushPull = { push: 0, pull: 0, pushPct: 0, pullPct: 0 };
  let balanceError = false;
  try {
    balance = muscleBalance(list, Math.max(1,Math.ceil(rangeDays/7)));
    pushPull = pushPullRatio(list, rangeDays);
  } catch {
    balanceError = true;
  }
  const calendar = activityCalendar(list, 12, periodEnd);
  const consistency = consistencySummary(list);
  const heatmap = muscleHeatmapCoverage(list,rangeDays);
  const setVolume=muscleSetVolume(list,rangeDays);
  const rangeSummary=dashboardRangeSummary(list,rangeDays);
  const scaledTargets=Object.fromEntries(Object.entries(settings.targets).map(([muscle,target])=>[muscle,Math.max(1,Math.round(target*rangeDays/7))]));
  const allPriorities=musclePriorities(setVolume,scaledTargets,settings.plannedDays);
  const recentCutoff=addDaysISO(todayISO(),-3);
  const recentExercises=list.filter(session=>session?.date>=recentCutoff).flatMap(session=>(session.exercises||[]).map(exercise=>exercise.name));
  const equipmentCounts=list.slice(-8).flatMap(session=>session.exercises||[]).reduce((counts,exercise)=>({...counts,[exercise.equipment||"free"]:(counts[exercise.equipment||"free"]||0)+1}),{});
  const preferredEquipment=(equipmentCounts.machine||0)>(equipmentCounts.free||0)?"machine":"free";
  const latestReadiness=[...list].filter(session=>session?.readiness).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0]?.readiness;
  const exerciseSuggestions = exerciseSuggestionsForMissed(heatmap.missed,{recentExercises,preferredEquipment});
  const selectedPriority=selectedMuscle?allPriorities.find(item=>item.muscle===selectedMuscle):null;
  const selectedHistory=selectedMuscle?list.flatMap(session=>(session.exercises||[]).filter(exercise=>[...(formGuide[exercise.name]?.primary||[]),...(formGuide[exercise.name]?.secondary||[])].includes(selectedMuscle)).map(exercise=>({date:session.date,name:exercise.name,sets:exercise.sets?.length||0}))).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8):[];
  const selectedSessions = selectedDate ? list.filter(session=>session?.date===selectedDate) : [];
  const closeSelectedDate = () => {
    const priorDate = selectedDate;
    setSelectedDate(null);
    requestAnimationFrame(() => dateButtonRefs.current.get(priorDate)?.focus());
  };

  const exerciseNames = [...new Set(list.flatMap(session=>(session.exercises||[]).map(exercise=>exercise.name)).filter(Boolean))].sort();
  const chartSessions = chartExercise==="all" ? list : list.map(session=>({...session,exercises:(session.exercises||[]).filter(exercise=>exercise.name===chartExercise)}));
  const chartEnd = todayISO();
  const chartBuckets = Array.from({ length: rangeDays },(_,index)=>{
    const date=addDaysISO(chartEnd,index-rangeDays+1);
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
  const chartHasResults = chartData.some(point => point.value > 0);
  const periodLabel = `${weeks[0].label} – ${new Date(addDaysISO(weeks[11].weekStart, 6) + "T12:00:00").toLocaleDateString([], {month:"numeric",day:"numeric",year:"numeric"})}`;
  const historyControls = (
    <div className="progress-calendar-controls">
      <button className="progress-calendar-nav" onClick={()=>setHistoryPage(page=>Math.min(maxHistoryPage,page+1))} disabled={historyPage>=maxHistoryPage}>← Earlier</button>
      {historyPage>0&&<button className="progress-calendar-nav" onClick={()=>setHistoryPage(page=>Math.max(0,page-1))}>Later →</button>}
      {historyPage>0&&<button className="progress-calendar-nav" onClick={()=>setHistoryPage(0)}>Current</button>}
    </div>
  );

  return (
    <div className={`progress-dashboard${embeddedGroup ? ` progress-dashboard--${embeddedGroup}` : ""}`}>
      {rendersGroup("heatmap")&&<div className="progress-legacy-card progress-legacy-card--heatmap">
        <div className="progress-body-heading">
          <p>Coverage from {heatmap.start} through {heatmap.end}</p>
          <SegmentedButtons ariaLabel="Body heatmap mode" value={heatmapMode} onChange={setHeatmapMode} options={[{value:"coverage",label:"Coverage"},{value:"sets",label:"Set volume"}]} />
        </div>
        {heatmap.trained.length===0?<div className="progress-body-empty"><strong>No mapped muscle work in this range.</strong><p>Log an exercise from the muscle guide or choose another range.</p></div>:<MuscleHeatmap scores={heatmapMode==="sets"?setVolume.sets:heatmap.scores} onSelect={openMuscleDetails} selected={selectedMuscle} mode={heatmapMode}/>} 
        <div className="progress-body-legend" aria-label="Body heatmap legend">{heatmapMode==="coverage"?<><span><i className="moderate"/>Repeated work</span><span><i className="low"/>Trained</span><span><i className="high"/>Supporting work</span><span><i/>Missed</span></>:<><span><i className="low"/>1–5 low</span><span><i className="moderate"/>6–12 moderate</span><span><i className="high"/>13–20 high</span><span><i className="review"/>20+ review</span><span><i/>None</span></>}</div>
        <details className="progress-body-regions"><summary>Explore muscle regions</summary><div>{Object.keys(MUSCLES).map(muscle=><button type="button" key={muscle} aria-pressed={selectedMuscle===muscle} onClick={event=>openMuscleDetails(muscle,event.currentTarget)}>{MUSCLES[muscle]}: {heatmap.scores[muscle]>0?"trained":"missed"}</button>)}</div></details>
        <div className="progress-coverage-action">
          <div><strong>{heatmap.missed.length?`${heatmap.missed.length} muscle groups need attention`:"Full coverage"}</strong><span>{heatmap.missed.length?"Review gaps and verified exercise suggestions.":"Every mapped muscle received work in this period."}</span></div>
          {heatmap.missed.length>0&&<Button variant="tonal" onClick={event=>openMuscleDetails(null,event.currentTarget)}>Review muscle guidance</Button>}
        </div>
        <Sheet open={muscleSheetOpen} title="Muscle guidance" closeLabel="Close muscle guidance" initialFocusRef={guidanceInitialRef} returnFocusRef={guidanceReturnRef} dismissOnHistory onClose={()=>setMuscleSheetOpen(false)}>
          <div role="group" aria-labelledby="muscles-needing-attention"><h3 id="muscles-needing-attention">Muscles needing attention</h3><div className="progress-muscle-chips">{heatmap.missed.map((muscle,index)=><button ref={index===0?guidanceInitialRef:null} type="button" aria-pressed={selectedMuscle===muscle} onClick={()=>setSelectedMuscle(muscle)} key={muscle}>{MUSCLES[muscle]}</button>)}</div></div>
          {selectedPriority&&<div className="progress-muscle-detail">
            <h3>{MUSCLES[selectedMuscle]}</h3><p>{MUSCLES[selectedMuscle]}: {selectedPriority.done.toFixed(1)} of {selectedPriority.target} estimated sets</p>
            <div className="progress-target-track"><span style={{width:selectedPriority.pct+"%"}} /></div>
            <label>Weekly target sets <input type="number" min="1" max="40" value={settings.targets[selectedMuscle]} onChange={event=>{const target=Math.max(1,Math.min(40,Number(event.target.value)||1));saveSettings(current=>({targets:{...current.targets,[selectedMuscle]:target}}));}}/></label>
            <h4>Recent exercises</h4>{selectedHistory.length?<div className="progress-history-list">{selectedHistory.map((item,index)=><div key={item.date+item.name+index}>{item.date} · {item.name} · {item.sets} set{item.sets===1?"":"s"}</div>)}</div>:<p>No matching exercise in this range.</p>}
          </div>}
          {exerciseSuggestions.suggestions.length>0?<div className="progress-suggestions"><h3>Exercises to fill the gaps</h3><p>Chosen from the app's verified muscle guide, with direct work preferred.</p>
            {latestReadiness?.pain&&<div className="progress-caution">Your latest check-in reported pain. Avoid painful movements and seek qualified advice if pain persists.</div>}
            {!latestReadiness?.pain&&Number(latestReadiness?.soreness)>=4&&<div className="progress-caution">Your latest soreness was high. Consider recovery before adding more work.</div>}
            {exerciseSuggestions.suggestions.map(item=><div key={item.name} className="progress-suggestion"><div><strong>{item.name}</strong><span>{item.direct.length?`Direct: ${item.direct.map(muscle=>MUSCLES[muscle]).join(", ")}`:`Supporting: ${item.supporting.map(muscle=>MUSCLES[muscle]).join(", ")}`}</span></div>{onAddExercise&&<Button aria-label={`Add ${item.name}`} onClick={()=>formGuide[item.name]&&onAddExercise(item.name)}>Add exercise</Button>}</div>)}
          </div>:<p>No verified suggestions are available for this gap yet.</p>}
          <p className="progress-guidance-caveat">Custom exercises without a muscle guide cannot be classified yet. Guidance is trend-based and not medical advice.</p>
        </Sheet>
        <div className="progress-method-note">Primary work counts fully; secondary work appears amber. Custom exercises need a muscle guide before they can affect this map.</div>
      </div>}
      {rendersGroup("trend")&&<div className="progress-legacy-card progress-legacy-card--summary">
        <div className="progress-summary-heading"><div className="progress-section-label">RANGE SUMMARY</div><label>Planned days <input type="number" min="1" max="7" value={settings.plannedDays} onChange={event=>saveSettings({plannedDays:Math.max(1,Math.min(7,Number(event.target.value)||1))})}/></label></div>
        <div className="progress-summary-grid">
          <div>
            <div className="progress-summary-value is-primary">{rangeSummary.sessions}</div>
            <div className="progress-summary-label">Session{rangeSummary.sessions !== 1 ? "s" : ""} logged</div>
          </div>
          <div>
            <div className="progress-summary-value is-success">
              {fmtVolume(rangeSummary.volume, unit)}<span> {unit}</span>
            </div>
            <div className="progress-summary-label">Total volume</div>
          </div>
          <div>
            <div className="progress-summary-value is-warn">{rangeSummary.sets}</div>
            <div className="progress-summary-label">Working sets</div>
          </div>
          <div>
            <div className={`progress-summary-value ${rangeSummary.workoutDays>=Math.ceil(settings.plannedDays*rangeDays/7)?"is-success":"is-secondary"}`}>{rangeSummary.workoutDays}<span> / {Math.ceil(settings.plannedDays*rangeDays/7)}</span></div>
            <div className="progress-summary-label">Planned workout days</div>
          </div>
        </div>
      </div>}

      {rendersGroup("trend")&&<div className="progress-legacy-card progress-legacy-card--calendar">
        <div className="progress-calendar-heading">
          <div><div className="progress-section-label">TRAINING CALENDAR</div><div className="progress-section-note">{periodLabel} · darker squares mean more sessions</div></div>
          <div className="progress-calendar-stats">
            <div><strong className="is-primary">{consistency.workouts}</strong><span>days / 28</span></div>
            <div><strong className="is-success">{consistency.activeWeeks}</strong><span>active weeks</span></div>
            <div><strong className={consistency.goalPct>=80?"is-success":consistency.goalPct>=50?"is-warn":""}>{consistency.goalPct}%</strong><span>5-day goal</span></div>
          </div>
        </div>
        <div className="progress-calendar-actions">{historyControls}</div>
        <div className="progress-calendar-layout">
          <div className="progress-calendar-days">{["M","","W","","F","",""] .map((label,index)=><span key={index}>{label}</span>)}</div>
          <div className="progress-calendar-scroll">
          <div aria-label="12-week training calendar" className="progress-calendar-grid">
            {calendar.map((week,wi)=><div key={wi} className="progress-calendar-week">{week.map(day=>{
              const volumeLabel = day.count ? `, ${fmtVolume(day.volume,unit)} ${unit} volume` : "";
              return <button ref={node => { if (node) dateButtonRefs.current.set(day.date, node); else dateButtonRefs.current.delete(day.date); }} key={day.date} onClick={()=>day.count&&setSelectedDate(day.date)} disabled={!day.count} aria-label={`${day.date}: ${day.count} session${day.count===1?"":"s"}${volumeLabel}${day.count?". View details.":""}`} title={`${day.date}: ${day.count} session${day.count===1?"":"s"}${volumeLabel}`} className={`progress-calendar-day${selectedDate===day.date?" is-selected":""}${day.future?" is-future":""}`} data-level={day.level} />;
            })}</div>)}
          </div>
          </div>
        </div>
        <p className="progress-consistency-caption">5-day goal progress · {consistency.goalPct}%</p>
        <div className="progress-consistency-track" role="img" aria-label={`5-day goal progress: ${consistency.goalPct}%`}><div className={consistency.goalPct>=80?"is-success":""} style={{width:consistency.goalPct+"%"}} /></div>
        {selectedSessions.length>0&&(
          <div className="progress-workout-details">
            <div className="progress-workout-details-heading">
              <div><strong>{new Date(selectedDate+"T12:00:00").toLocaleDateString([], {weekday:"long",month:"short",day:"numeric",year:"numeric"})}</strong><span>{selectedSessions.length} saved workout{selectedSessions.length===1?"":"s"}</span></div>
              <button onClick={closeSelectedDate} aria-label="Close workout details" className="progress-details-close">×</button>
            </div>
            <div className="progress-workout-list">{selectedSessions.map((session,index)=><div key={session.id||index} className="progress-workout-item">
              <div className="progress-workout-item-heading"><strong>{session.day||"Workout"}</strong><span>{fmtVolume(sessionVolume(session),unit)} {unit} volume</span></div>
              <div className="progress-workout-exercises">{(session.exercises||[]).map((exercise,exerciseIndex)=><span key={(exercise.name||"exercise")+exerciseIndex}>{exercise.name} · {(exercise.sets||[]).length} set{(exercise.sets||[]).length===1?"":"s"}</span>)}</div>
              {session.notes&&<div className="progress-workout-notes">“{session.notes}”</div>}
            </div>)}</div>
          </div>
        )}
      </div>}

      {rendersGroup("trend")&&<div className="progress-legacy-card progress-legacy-card--trend">
        <div className="progress-trend-heading"><div className="progress-section-label">TRAINING TREND <span>· {metricLabels[chartMetric]}</span></div></div>
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
              <Tooltip labelFormatter={(_,payload)=>payload?.[0]?.payload?.date||""} formatter={value => [`${value}${chartMetric === "sessions" ? "" : ` ${unit}`}`, metricLabels[chartMetric]]} contentStyle={{ background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="value" name={metricLabels[chartMetric]} fill={chartTheme.primary} radius={[5, 5, 0, 0]} isAnimationActive={!reducedMotion} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {!chartHasResults&&<p className="progress-daily-empty">No {metricLabels[chartMetric]} recorded for this selection in the last {rangeDays} days.</p>}
        <details className="progress-data-details"><summary>View daily trend data</summary><div className="progress-data-table-wrap"><table><caption>{metricLabels[chartMetric]} by day</caption><thead><tr><th scope="col">Date</th><th scope="col">Value</th></tr></thead><tbody>{chartData.map(point=><tr key={point.date}><td>{point.date}</td><td>{point.value}{chartMetric === "sessions" ? "" : ` ${unit}`}</td></tr>)}</tbody></table></div></details>
      </div>}

      {rendersGroup("balance")&&<div className="progress-legacy-card progress-legacy-card--balance">
        {balanceError?<div className="progress-group-error" role="alert"><strong>Balance couldn’t be calculated.</strong><p>Your other progress analytics are still available.</p><Button variant="tonal" onClick={() => window.location.reload()}>Try again</Button></div>:<>
        <p className="progress-balance-range">Mapped working sets in the last {rangeDays} days</p>
        <div className="progress-push-pull" aria-label={pushPull.push+pushPull.pull>0?`${pushPull.pushPct}% push and ${pushPull.pullPct}% pull`:"No mapped push or pull sets"}>
          <div className="progress-push-pull__labels"><span><strong>{pushPull.pushPct}%</strong> Push</span><span>Pull <strong>{pushPull.pullPct}%</strong></span></div>
          {pushPull.push+pushPull.pull>0&&<div className="progress-push-pull__track" aria-hidden="true"><span style={{width:`${pushPull.pushPct}%`}} /><span style={{width:`${pushPull.pullPct}%`}} /></div>}
          <p>{pushPull.push+pushPull.pull>0?"Based on mapped working sets in this range.":"Log mapped push and pull exercises to see your ratio."}</p>
        </div>
        {balance.length === 0
          ? <div className="progress-balance-empty">Not enough mapped exercises to show muscle-group balance yet.</div>
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
        </>}
      </div>}
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
