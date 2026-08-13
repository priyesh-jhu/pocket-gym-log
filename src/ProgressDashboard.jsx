import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { activityCalendar, consistencySummary, dominantUnit, weeklyVolume, weekSummary, muscleBalance } from "./stats.js";

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

  if (list.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px", color: "#444", fontSize: 13 }}>
        Log a few sessions first to see your training overview.
      </div>
    );
  }

  const unit = dominantUnit(list);
  const summary = weekSummary(list);
  const weeks = weeklyVolume(list, 12);
  const balance = muscleBalance(list, 4);
  const calendar = activityCalendar(list, 12);
  const consistency = consistencySummary(list);

  const chartData = weeks.map(w => ({ label: w.label, volume: Math.round(toDisplay(w.volume, unit)) }));

  const deltaColor = summary.deltaPct === null ? "#9CA3AF" : summary.deltaPct >= 0 ? "#22C55E" : summary.deltaPct >= -10 ? "#F59E0B" : "#EF4444";
  const deltaText = summary.deltaPct === null ? "No data last week" : (summary.deltaPct >= 0 ? "▲ +" : "▼ ") + Math.abs(summary.deltaPct) + "% vs last week";

  return (
    <div>
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
          <div><div style={{...sectionLabel,marginBottom:3}}>TRAINING CALENDAR</div><div style={{fontSize:10,color:"#444"}}>Last 12 weeks · darker squares mean more sessions</div></div>
          <div style={{display:"flex",gap:14}}>
            <div style={{textAlign:"center"}}><div style={{fontSize:17,fontWeight:900,color:"#3B82F6"}}>{consistency.workouts}</div><div style={{fontSize:9,color:"#555"}}>days / 28</div></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:17,fontWeight:900,color:"#22C55E"}}>{consistency.activeWeeks}</div><div style={{fontSize:9,color:"#555"}}>active weeks</div></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:17,fontWeight:900,color:consistency.goalPct>=80?"#22C55E":consistency.goalPct>=50?"#F59E0B":"#9CA3AF"}}>{consistency.goalPct}%</div><div style={{fontSize:9,color:"#555"}}>5-day goal</div></div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"18px minmax(0,1fr)",gap:6,alignItems:"stretch"}}>
          <div style={{display:"grid",gridTemplateRows:"repeat(7,1fr)",gap:4,fontSize:8,color:"#555",textAlign:"right",alignItems:"center"}}>{["M","","W","","F","",""] .map((label,index)=><span key={index}>{label}</span>)}</div>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${calendar.length},minmax(8px,1fr))`,gap:4}}>
            {calendar.map((week,wi)=><div key={wi} style={{display:"grid",gridTemplateRows:"repeat(7,1fr)",gap:4}}>{week.map(day=><div key={day.date} title={`${day.date}: ${day.count} session${day.count===1?"":"s"}`} style={{aspectRatio:"1",minHeight:8,borderRadius:3,background:day.future?"#0B0C13":day.count>1?"#2563EB":day.count===1?"#3B82F6":"#171824",border:"1px solid "+(day.count?"#60A5FA30":"#1E203520"),opacity:day.future?0.35:1}} />)}</div>)}
          </div>
        </div>
        <div style={{height:5,borderRadius:4,background:"#161723",overflow:"hidden",marginTop:12}}><div style={{height:"100%",width:consistency.goalPct+"%",background:consistency.goalPct>=80?"#22C55E":"#3B82F6",borderRadius:4}} /></div>
      </div>

      <div style={card}>
        <div style={sectionLabel}>WEEKLY VOLUME <span style={{ color: "#444", fontWeight: 500 }}>({unit}, last 12 weeks)</span></div>
        <div style={{ width: "100%", height: 180 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid stroke="#1E2035" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#444" tick={{ fontSize: 10 }} />
              <YAxis stroke="#444" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#161723", border: "1px solid #2A2A3A", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="volume" fill="#3B82F6" radius={[3, 3, 0, 0]} />
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
