import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { todayISO, todaysDayKey, addDaysISO } from "./dateUtils.js";
import { MUSCLES, formGuide } from "./data/formGuide.js";
import { dayOrder, dayTemplates, variantFor, allVariantNames } from "./data/exercises.js";
import { emptySets, hasEnteredData, countEnteredSets, buildDraftExercise, newSession } from "./draft.js";
import { loadPrefs, savePrefs, setPref } from "./equipmentPrefs.js";

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const SESSION_PREFIX  = "workout-sessions:";
const WEIGHT_PREFIX   = "workout-bodyweight:";
const PROFILES_KEY    = "workout-profiles";
const ACTIVE_KEY      = "workout-active-profile";
const TAB_KEY         = "workout-active-tab";

const storage = {
  get(key)        { try { return window.localStorage.getItem(key); }      catch { return null; } },
  set(key, value) { try { window.localStorage.setItem(key, value); return true; } catch { return false; } },
  remove(key)     { try { window.localStorage.removeItem(key); return true; }    catch { return false; } },
};

function sessionKey(u) { return SESSION_PREFIX + u; }
function weightKey(u)  { return WEIGHT_PREFIX  + u; }
function cleanUsername(r) { return String(r || "").trim().slice(0, 24); }

// ─── PLATE CALCULATOR ─────────────────────────────────────────────────────────
const PLATE_SETS = {
  lb: { bar:45, plates:[45,35,25,10,5,2.5] },
  kg: { bar:20, plates:[25,20,15,10,5,2.5,1.25] },
};

function calcPlates(total, unit) {
  const { bar, plates } = PLATE_SETS[unit] || PLATE_SETS.lb;
  if (isNaN(total) || total <= bar) return { perSide:[], leftover:0, bar };
  let rem = (total - bar) / 2;
  const result = [];
  for (const p of plates) {
    let count = 0;
    while (rem + 1e-9 >= p) { rem -= p; count++; }
    if (count > 0) result.push({ plate:p, count });
  }
  return { perSide:result, leftover:Math.round(rem * 100) / 100, bar };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function downloadJSON(data, filename) {
  try {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)], {type:"application/json"}));
    const a = Object.assign(document.createElement("a"), { href:url, download:filename });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch { return false; }
}

function buildPRMap(sessions) {
  const map = {};
  sessions.forEach(s => s.exercises.forEach(ex => ex.sets.forEach(set => {
    const w = parseFloat(set.weight), r = parseFloat(set.reps);
    if (isNaN(w)) return;
    const cur = map[ex.name];
    if (!cur || w > cur.weight || (w === cur.weight && (r||0) > cur.reps))
      map[ex.name] = { weight:w, reps:r||0, date:s.date };
  })));
  return map;
}

function fmtRest(sec) { return Math.floor(sec/60) + ":" + String(sec%60).padStart(2,"0"); }

// ─── BODY MAP ─────────────────────────────────────────────────────────────────
function BodyMap({ view="front", primary=[], secondary=[], color="#3B82F6" }) {
  const fill = id => primary.includes(id) ? color : secondary.includes(id) ? color+"66" : "#1C1D2A";
  const strk = id => (primary.includes(id)||secondary.includes(id)) ? color : "#23243A";

  if (view === "back") return (
    <svg viewBox="0 0 120 220" style={{width:"100%",height:"100%",maxHeight:280}}>
      <circle cx="60" cy="20" r="12" fill="#161826" stroke="#23243A" strokeWidth="1.5"/>
      <rect x="54" y="31" width="12" height="8" fill="#161826" stroke="#23243A" strokeWidth="1"/>
      <path d="M50 40 q10 -4 20 0 q-2 9 -10 11 q-8 -2 -10 -11 z" fill={fill("traps")} stroke={strk("traps")} strokeWidth="1.2"/>
      <path d="M40 44 q-10 2 -11 14 q9 -3 14 -5 z" fill={fill("rearDelts")} stroke={strk("rearDelts")} strokeWidth="1"/>
      <path d="M80 44 q10 2 11 14 q-9 -3 -14 -5 z" fill={fill("rearDelts")} stroke={strk("rearDelts")} strokeWidth="1"/>
      <path d="M47 52 q13 -3 26 0 q1 9 -2 16 q-11 3 -22 0 q-3 -7 -2 -16 z" fill={fill("midBack")} stroke={strk("midBack")} strokeWidth="1.1"/>
      <path d="M44 56 q-4 14 1 24 q6 -2 9 -7 q-2 -10 -2 -19 q-5 0 -8 2 z" fill={fill("lats")} stroke={strk("lats")} strokeWidth="1"/>
      <path d="M76 56 q4 14 -1 24 q-6 -2 -9 -7 q2 -10 2 -19 q5 0 8 2 z" fill={fill("lats")} stroke={strk("lats")} strokeWidth="1"/>
      <path d="M28 60 q-5 9 -4 21 q5 -1 8 -3 q1 -10 1 -19 z" fill={fill("triceps")} stroke={strk("triceps")} strokeWidth="1"/>
      <path d="M92 60 q5 9 4 21 q-5 -1 -8 -3 q-1 -10 -1 -19 z" fill={fill("triceps")} stroke={strk("triceps")} strokeWidth="1"/>
      <path d="M22 83 q-2 14 1 25 q5 -1 7 -3 q-1 -12 -1 -24 q-4 0 -7 2 z" fill={fill("forearms")} stroke={strk("forearms")} strokeWidth="1"/>
      <path d="M98 83 q2 14 -1 25 q-5 -1 -7 -3 q1 -12 1 -24 q4 0 7 2 z" fill={fill("forearms")} stroke={strk("forearms")} strokeWidth="1"/>
      <path d="M50 70 q10 -2 20 0 q1 10 -1 18 q-9 2 -18 0 q-2 -8 -1 -18 z" fill={fill("lowerBack")} stroke={strk("lowerBack")} strokeWidth="1.1"/>
      <path d="M49 90 q11 -3 22 0 q2 9 -1 16 q-10 3 -20 0 q-3 -7 -1 -16 z" fill={fill("glutes")} stroke={strk("glutes")} strokeWidth="1.2"/>
      <path d="M49 108 q-3 20 0 36 q6 2 9 0 q1 -18 1 -36 q-5 -2 -10 0 z" fill={fill("hamstrings")} stroke={strk("hamstrings")} strokeWidth="1"/>
      <path d="M71 108 q3 20 0 36 q-6 2 -9 0 q-1 -18 -1 -36 q5 -2 10 0 z" fill={fill("hamstrings")} stroke={strk("hamstrings")} strokeWidth="1"/>
      <path d="M50 146 q-3 26 0 50 q5 2 8 0 q2 -26 1 -50 q-5 -2 -9 0 z" fill={fill("calves")} stroke={strk("calves")} strokeWidth="1"/>
      <path d="M70 146 q3 26 0 50 q-5 2 -8 0 q-2 -26 -1 -50 q5 -2 9 0 z" fill={fill("calves")} stroke={strk("calves")} strokeWidth="1"/>
    </svg>
  );

  return (
    <svg viewBox="0 0 120 220" style={{width:"100%",height:"100%",maxHeight:280}}>
      <circle cx="60" cy="20" r="12" fill="#161826" stroke="#23243A" strokeWidth="1.5"/>
      <rect x="54" y="31" width="12" height="8" fill="#161826" stroke="#23243A" strokeWidth="1"/>
      <path d="M40 44 q-10 2 -11 14 q8 -4 13 -4 z" fill={fill("sideDelts")} stroke={strk("sideDelts")} strokeWidth="1"/>
      <path d="M80 44 q10 2 11 14 q-8 -4 -13 -4 z" fill={fill("sideDelts")} stroke={strk("sideDelts")} strokeWidth="1"/>
      <path d="M41 43 q6 -3 12 0 l-1 11 q-7 -2 -12 1 z" fill={fill("frontDelts")} stroke={strk("frontDelts")} strokeWidth="1"/>
      <path d="M79 43 q-6 -3 -12 0 l1 11 q7 -2 12 1 z" fill={fill("frontDelts")} stroke={strk("frontDelts")} strokeWidth="1"/>
      <path d="M48 47 q-7 1 -8 12 q0 6 7 8 q6 1 12 -1 l0 -19 q-6 -1 -11 0 z" fill={fill("chest")} stroke={strk("chest")} strokeWidth="1.2"/>
      <path d="M72 47 q7 1 8 12 q0 6 -7 8 q-6 1 -12 -1 l0 -19 q6 -1 11 0 z" fill={fill("chest")} stroke={strk("chest")} strokeWidth="1.2"/>
      <path d="M30 60 q-5 8 -4 20 q5 -1 8 -3 q1 -10 1 -18 z" fill={fill("biceps")} stroke={strk("biceps")} strokeWidth="1"/>
      <path d="M90 60 q5 8 4 20 q-5 -1 -8 -3 q-1 -10 -1 -18 z" fill={fill("biceps")} stroke={strk("biceps")} strokeWidth="1"/>
      <path d="M27 61 q-5 9 -4 20 q-4 -2 -5 -6 q0 -9 4 -16 z" fill={fill("triceps")} stroke={strk("triceps")} strokeWidth="1"/>
      <path d="M93 61 q5 9 4 20 q4 -2 5 -6 q0 -9 -4 -16 z" fill={fill("triceps")} stroke={strk("triceps")} strokeWidth="1"/>
      <path d="M22 82 q-2 14 1 26 q5 -1 7 -3 q-1 -13 -1 -25 q-4 0 -7 2 z" fill={fill("forearms")} stroke={strk("forearms")} strokeWidth="1"/>
      <path d="M98 82 q2 14 -1 26 q-5 -1 -7 -3 q1 -13 1 -25 q4 0 7 2 z" fill={fill("forearms")} stroke={strk("forearms")} strokeWidth="1"/>
      <path d="M50 68 q10 -2 20 0 q1 16 -2 30 q-8 3 -16 0 q-3 -14 -2 -30 z" fill={fill("abs")} stroke={strk("abs")} strokeWidth="1.2"/>
      <path d="M47 70 q-3 12 -1 24 q4 -1 6 -3 q-1 -11 -1 -21 z" fill={fill("obliques")} stroke={strk("obliques")} strokeWidth="0.9"/>
      <path d="M73 70 q3 12 1 24 q-4 -1 -6 -3 q1 -11 1 -21 z" fill={fill("obliques")} stroke={strk("obliques")} strokeWidth="0.9"/>
      <path d="M48 100 q-4 22 0 44 q6 2 10 0 q2 -22 1 -44 q-6 -2 -11 0 z" fill={fill("quads")} stroke={strk("quads")} strokeWidth="1"/>
      <path d="M72 100 q4 22 0 44 q-6 2 -10 0 q-2 -22 -1 -44 q6 -2 11 0 z" fill={fill("quads")} stroke={strk("quads")} strokeWidth="1"/>
      <path d="M58 100 q4 18 0 38 q-3 1 -5 0 q-3 -20 0 -38 z" fill={fill("adductors")} stroke={strk("adductors")} strokeWidth="0.9"/>
      <path d="M62 100 q-4 18 0 38 q3 1 5 0 q3 -20 0 -38 z" fill={fill("adductors")} stroke={strk("adductors")} strokeWidth="0.9"/>
      <path d="M50 146 q-3 30 0 60 q5 2 8 0 q2 -30 1 -60 z" fill={fill("calves")} stroke={strk("calves")} strokeWidth="1"/>
      <path d="M70 146 q3 30 0 60 q-5 2 -8 0 q-2 -30 -1 -60 z" fill={fill("calves")} stroke={strk("calves")} strokeWidth="1"/>
    </svg>
  );
}

// ─── GUIDE SECTION (sub-component) ────────────────────────────────────────────
function GuideSection({ icon, title, items, color }) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:11,color,fontWeight:800,letterSpacing:"0.06em",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
        <span>{icon}</span>{title}
      </div>
      {items.map((c,i) => (
        <div key={i} style={{display:"flex",gap:9,marginBottom:7,alignItems:"flex-start"}}>
          <span style={{flexShrink:0,width:17,height:17,borderRadius:"50%",background:color+"22",color,fontSize:9,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",marginTop:2}}>{i+1}</span>
          <span style={{fontSize:12.5,color:"#C4C2D4",lineHeight:1.5}}>{c}</span>
        </div>
      ))}
    </div>
  );
}

// ─── WEIGHT TAB (sub-component) ───────────────────────────────────────────────
function WeightTab({ bodyweights, weightInput, setWeightInput, weightUnit, setWeightUnit, weightDate, setWeightDate, confirmDeleteWeight, setConfirmDeleteWeight, onAdd, onDelete }) {
  const safe = (Array.isArray(bodyweights) ? bodyweights : [])
    .filter(e => e && e.date && !isNaN(parseFloat(e.weight)))
    .map(e => ({ id:e.id||("w_"+e.date), date:String(e.date), weight:parseFloat(e.weight), unit:e.unit==="kg"?"kg":"lb" }));

  function toLb(e) { const w=parseFloat(e.weight); return isNaN(w)?0:(e.unit==="kg"?w*2.20462:w); }

  let chartData = [];
  try {
    const sorted = [...safe].sort((a,b)=>a.date.localeCompare(b.date));
    const conv = lb => weightUnit==="kg" ? lb/2.20462 : lb;
    chartData = sorted.map(e => {
      const ws = new Date(e.date); ws.setDate(ws.getDate()-6);
      const startISO = ws.toISOString().slice(0,10);
      const win = sorted.filter(p=>p.date>=startISO&&p.date<=e.date);
      const avgLb = win.reduce((s,p)=>s+toLb(p),0) / (win.length||1);
      return { date:e.date.slice(5), weight:Math.round(conv(toLb(e))*10)/10, trend:Math.round(conv(avgLb)*10)/10 };
    });
  } catch { chartData = []; }

  const sortedW = [...safe].sort((a,b)=>b.date.localeCompare(a.date));
  const latest = sortedW[0];
  const oldest = [...safe].sort((a,b)=>a.date.localeCompare(b.date))[0];
  const netLb = latest&&oldest ? toLb(latest)-toLb(oldest) : 0;
  const netDisp = weightUnit==="kg" ? netLb/2.20462 : netLb;
  const latestDisp = latest ? (weightUnit==="kg" ? Math.round(toLb(latest)/2.20462*10)/10 : Math.round(toLb(latest)*10)/10) : 0;

  return (
    <div>
      <div style={{background:"#0F1018",border:"1px solid #16172A",borderRadius:14,padding:"14px 16px",marginBottom:16}}>
        <div style={{fontSize:12,color:"#666",fontWeight:700,marginBottom:10}}>LOG BODYWEIGHT</div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <input type="number" inputMode="decimal" placeholder="Weight" value={weightInput}
            onChange={e=>setWeightInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")onAdd();}}
            style={{flex:"1 1 90px",background:"#161723",border:"1px solid #1E2035",borderRadius:8,padding:"9px 11px",color:"#ECEAF4",fontSize:14,fontFamily:"inherit",minWidth:0}}/>
          <select value={weightUnit} onChange={e=>setWeightUnit(e.target.value)}
            style={{background:"#161723",border:"1px solid #1E2035",borderRadius:8,padding:"9px 8px",color:"#888",fontSize:13,fontFamily:"inherit",flexShrink:0}}>
            <option value="lb">lb</option>
            <option value="kg">kg</option>
          </select>
          <input type="date" value={weightDate} onChange={e=>setWeightDate(e.target.value)}
            style={{background:"#161723",border:"1px solid #1E2035",borderRadius:8,padding:"9px 10px",color:"#ECEAF4",fontSize:13,fontFamily:"inherit",flexShrink:0}}/>
          <button onClick={onAdd}
            style={{background:"#3B82F6",border:"none",borderRadius:8,padding:"9px 18px",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
            Add
          </button>
        </div>
        <div style={{fontSize:10,color:"#555",marginTop:8}}>One entry per day — same date updates the existing entry.</div>
      </div>

      {safe.length === 0 ? (
        <div style={{textAlign:"center",padding:"30px 20px",color:"#444",fontSize:13}}>
          No weigh-ins yet. Add your first above to start the chart.
        </div>
      ) : (
        <>
          <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:16,background:"#0F1018",border:"1px solid #16172A",borderRadius:14,padding:"14px 16px"}}>
            <div>
              <div style={{fontSize:22,fontWeight:900,color:"#3B82F6"}}>{latestDisp}<span style={{fontSize:12,color:"#666",fontWeight:600}}> {weightUnit}</span></div>
              <div style={{fontSize:11,color:"#555"}}>Latest ({latest.date.slice(5)})</div>
            </div>
            <div>
              <div style={{fontSize:22,fontWeight:900,color:netDisp<=0?"#22C55E":"#F59E0B"}}>{netDisp>=0?"+":""}{Math.round(netDisp*10)/10}</div>
              <div style={{fontSize:11,color:"#555"}}>Net change</div>
            </div>
            <div>
              <div style={{fontSize:22,fontWeight:900,color:"#9CA3AF"}}>{safe.length}</div>
              <div style={{fontSize:11,color:"#555"}}>Weigh-ins</div>
            </div>
          </div>

          {chartData.length >= 2 ? (
            <div style={{background:"#0F1018",border:"1px solid #16172A",borderRadius:14,padding:"16px",marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Bodyweight Trend <span style={{fontSize:11,color:"#666",fontWeight:500}}>({weightUnit})</span></div>
              <div style={{width:"100%",height:240}}>
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{top:5,right:10,left:-18,bottom:5}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E2035"/>
                    <XAxis dataKey="date" stroke="#444" tick={{fontSize:10}}/>
                    <YAxis stroke="#444" tick={{fontSize:10}} domain={["dataMin - 2","dataMax + 2"]}/>
                    <Tooltip contentStyle={{background:"#161723",border:"1px solid #2A2A3A",borderRadius:8,fontSize:12}}/>
                    <Legend wrapperStyle={{fontSize:11}}/>
                    <Line type="monotone" dataKey="weight" name="Weigh-in" stroke="#3B82F6" strokeWidth={2} dot={{r:3}}/>
                    <Line type="monotone" dataKey="trend" name="7-day avg" stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 4" dot={false}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div style={{background:"#0F1018",border:"1px solid #16172A",borderRadius:14,padding:"20px 16px",marginBottom:16,textAlign:"center",color:"#666",fontSize:13}}>
              Log at least 2 weigh-ins to see the trend chart.
            </div>
          )}

          <div style={{fontSize:12,color:"#666",fontWeight:700,marginBottom:8}}>HISTORY</div>
          {sortedW.map(e => (
            <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#0F1018",border:"1px solid #16172A",borderRadius:10,padding:"10px 14px",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"baseline",gap:10}}>
                <span style={{fontSize:15,fontWeight:800,color:"#ECEAF4"}}>{e.weight}<span style={{fontSize:11,color:"#666",fontWeight:600}}> {e.unit}</span></span>
                <span style={{fontSize:12,color:"#555"}}>{e.date}</span>
              </div>
              {confirmDeleteWeight === e.id ? (
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <button onClick={()=>onDelete(e.id)} style={{background:"#EF4444",border:"none",borderRadius:6,padding:"3px 9px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Delete</button>
                  <button onClick={()=>setConfirmDeleteWeight(null)} style={{background:"#1E2035",border:"none",borderRadius:6,padding:"3px 9px",color:"#888",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
                </div>
              ) : (
                <button onClick={()=>setConfirmDeleteWeight(e.id)} style={{background:"none",border:"none",color:"#444",fontSize:16,cursor:"pointer",fontFamily:"inherit",padding:"0 4px"}}>×</button>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState(() => { try { return storage.get(TAB_KEY)||"log"; } catch { return "log"; } });
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [statusMsg, setStatusMsg] = useState(null);

  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfile] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [confirmDeleteProfile, setConfirmDeleteProfile] = useState(false);

  const [currentDay, setCurrentDay] = useState(() => todaysDayKey());
  const [draft, setDraft] = useState(() => newSession(todaysDayKey(), {}));
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [progressExercise, setProgressExercise] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showCoach, setShowCoach] = useState(true);
  const [showWarmup, setShowWarmup] = useState(true);

  const [restSeconds, setRestSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [restTarget, setRestTarget] = useState(90);

  const [bodyweights, setBodyweights] = useState([]);
  const [weightInput, setWeightInput] = useState("");
  const [weightUnit, setWeightUnit] = useState("lb");
  const [weightDate, setWeightDate] = useState(() => todayISO());
  const [confirmDeleteWeight, setConfirmDeleteWeight] = useState(null);

  const [guideExercise, setGuideExercise] = useState(null);
  const [plateFor, setPlateFor] = useState(null);

  const [equipmentPrefs, setEquipmentPrefs] = useState({});
  const [confirmSwitch, setConfirmSwitch] = useState(null); // { ei, equipment } | null

  function switchTab(t) { setActiveTab(t); try { storage.set(TAB_KEY, t); } catch {} }

  // Bootstrap
  useEffect(() => {
    let cancelled = false;
    try {
      let list = [];
      const rawList = storage.get(PROFILES_KEY);
      if (rawList) { try { const p = JSON.parse(rawList); if (Array.isArray(p)) list = p; } catch {} }
      const legacy = storage.get("workout-sessions");
      if (legacy && list.length === 0) {
        storage.set(sessionKey("default"), legacy);
        storage.remove("workout-sessions");
        list = ["default"];
      }
      if (list.length === 0) list = ["default"];
      let active = storage.get(ACTIVE_KEY);
      if (!active || !list.includes(active)) active = list[0];
      storage.set(PROFILES_KEY, JSON.stringify(list));
      storage.set(ACTIVE_KEY, active);
      if (!cancelled) {
        setProfiles(list);
        setActiveProfile(active);
        try { const r = storage.get(sessionKey(active)); if (r) { const p = JSON.parse(r); setSessions(Array.isArray(p)?p:[]); } } catch { setSessions([]); }
        try { const r = storage.get(weightKey(active));  if (r) { const p = JSON.parse(r); setBodyweights(Array.isArray(p)?p:[]); } } catch { setBodyweights([]); }
        const prefs = loadPrefs(storage, active);
        setEquipmentPrefs(prefs);
        setDraft(newSession(todaysDayKey(), prefs));
      }
    } catch { if (!cancelled) { setProfiles(["default"]); setActiveProfile("default"); } }
    finally { if (!cancelled) setLoading(false); }
    return () => { cancelled = true; };
  }, []);

  // Rest timer
  useEffect(() => {
    if (!restRunning) return;
    const t = setInterval(() => setRestSeconds(s => { if (s+1>=restTarget){setRestRunning(false);return restTarget;} return s+1; }), 1000);
    return () => clearInterval(t);
  }, [restRunning, restTarget]);

  function loadProfile(user) {
    try { const r = storage.get(sessionKey(user)); setSessions(r?JSON.parse(r):[]); } catch { setSessions([]); }
    try { const r = storage.get(weightKey(user));  setBodyweights(r?JSON.parse(r):[]); } catch { setBodyweights([]); }
    const prefs = loadPrefs(storage, user);
    setEquipmentPrefs(prefs);
    return prefs;
  }

  function switchProfile(user) {
    if (user === activeProfile) { setShowProfileMenu(false); return; }
    setActiveProfile(user); storage.set(ACTIVE_KEY, user);
    const prefs = loadProfile(user);
    setDraft(newSession(currentDay, prefs));
    setConfirmSwitch(null);
    setExpandedHistory(null); setProgressExercise(null);
    setConfirmDelete(null); setConfirmReset(false);
    setRestRunning(false); setRestSeconds(0);
    setShowProfileMenu(false);
  }

  function createProfile() {
    const name = cleanUsername(newProfileName);
    if (!name) return;
    if (profiles.includes(name)) { switchProfile(name); setNewProfileName(""); return; }
    const updated = [...profiles, name];
    setProfiles(updated);
    storage.set(PROFILES_KEY, JSON.stringify(updated));
    storage.set(sessionKey(name), JSON.stringify([]));
    setNewProfileName("");
    switchProfile(name);
  }

  function deleteProfile(user) {
    const rem = profiles.filter(p => p !== user);
    storage.remove(sessionKey(user));
    const list = rem.length > 0 ? rem : ["default"];
    if (rem.length === 0) storage.set(sessionKey("default"), JSON.stringify([]));
    setProfiles(list); storage.set(PROFILES_KEY, JSON.stringify(list));
    const next = list[0]; setActiveProfile(next); storage.set(ACTIVE_KEY, next);
    loadProfile(next); setConfirmDeleteProfile(false); setShowProfileMenu(false);
  }

  function persist(updated) {
    if (!activeProfile) return;
    setSaveStatus("saving");
    const ok = storage.set(sessionKey(activeProfile), JSON.stringify(updated));
    if (ok) { setSaveStatus("saved"); setTimeout(()=>setSaveStatus("idle"),1500); }
    else { setSaveStatus("error"); setStatusMsg("Could not save."); }
  }

  function persistWeights(updated) {
    if (!activeProfile) return;
    storage.set(weightKey(activeProfile), JSON.stringify(updated));
  }

  function switchDay(k) { setCurrentDay(k); setDraft(newSession(k, equipmentPrefs)); setConfirmSwitch(null); }

  function requestEquipmentSwitch(ei, equipment) {
    const ex = draft.exercises[ei];
    if (!ex || ex.equipment === equipment) return;
    if (hasEnteredData(ex.sets)) { setConfirmSwitch({ ei, equipment }); return; }
    applyEquipmentSwitch(ei, equipment);
  }

  function applyEquipmentSwitch(ei, equipment) {
    const planEx = dayTemplates[currentDay].exercises[ei];
    const v = variantFor(planEx, equipment);
    setDraft(prev => ({ ...prev, exercises: prev.exercises.map((ex,i) => i!==ei ? ex : buildDraftExercise(v)) }));
    const updated = setPref(equipmentPrefs, planEx.variants[0].name, v.equipment);
    setEquipmentPrefs(updated);
    savePrefs(storage, activeProfile, updated);
    setConfirmSwitch(null);
    setPlateFor(null);
  }

  function updateSet(ei, si, field, val) {
    setDraft(prev => ({ ...prev, exercises: prev.exercises.map((ex,i) => i!==ei?ex:{ ...ex, sets: ex.sets.map((s,j)=>j!==si?s:{...s,[field]:val}) }) }));
  }

  function toggleSetDone(ei, si) {
    let nd = false;
    setDraft(prev => ({ ...prev, exercises: prev.exercises.map((ex,i) => i!==ei?ex:{ ...ex, sets: ex.sets.map((s,j)=>{ if(j!==si)return s; nd=!s.done; return {...s,done:!s.done}; }) }) }));
    if (nd) { setRestSeconds(0); setRestRunning(true); }
  }

  function addSet(ei) {
    setDraft(prev => ({ ...prev, exercises: prev.exercises.map((ex,i) => { if(i!==ei)return ex; const last=ex.sets[ex.sets.length-1]; return {...ex,sets:[...ex.sets,last?{weight:last.weight,reps:"",unit:last.unit,done:false}:emptySets()[0]]}; }) }));
  }

  function removeSet(ei, si) {
    setDraft(prev => ({ ...prev, exercises: prev.exercises.map((ex,i) => i!==ei||ex.sets.length<=1?ex:{ ...ex, sets:ex.sets.filter((_,j)=>j!==si) }) }));
  }

  function cleanSession(s) {
    return { ...s, exercises: s.exercises.map(ex=>({ ...ex, sets:ex.sets.filter(s=>String(s.weight).trim()!==""||String(s.reps).trim()!=="").map(({done,...r})=>r) })).filter(ex=>ex.sets.length>0) };
  }

  function saveSession() {
    if (!draft.exercises.some(ex => hasEnteredData(ex.sets))) { setSaveStatus("error"); setStatusMsg("Add at least one value."); setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},2500); return; }
    const updated = [...sessions, cleanSession(draft)].sort((a,b)=>a.date.localeCompare(b.date));
    setSessions(updated); persist(updated);
    setDraft(newSession(currentDay, equipmentPrefs)); setConfirmSwitch(null); setRestRunning(false); setRestSeconds(0);
  }

  function deleteSession(id) { const u=sessions.filter(s=>s.id!==id); setSessions(u); persist(u); setConfirmDelete(null); }
  function resetAll() { setSessions([]); persist([]); setConfirmReset(false); }

  function addWeight() {
    const w = parseFloat(weightInput);
    if (isNaN(w)||w<=0) { setSaveStatus("error"); setStatusMsg("Enter a valid weight."); setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},2000); return; }
    const entry = { id:"w_"+Date.now(), date:weightDate, weight:w, unit:weightUnit };
    const updated = [...bodyweights.filter(e=>e.date!==weightDate), entry].sort((a,b)=>a.date.localeCompare(b.date));
    setBodyweights(updated); persistWeights(updated);
    setWeightInput("");
    setSaveStatus("saved"); setStatusMsg("Weight logged ✓"); setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},1500);
  }

  function deleteWeight(id) { const u=bodyweights.filter(e=>e.id!==id); setBodyweights(u); persistWeights(u); setConfirmDeleteWeight(null); }

  function exportData() {
    const ok = downloadJSON({ exportedAt:new Date().toISOString(), profile:activeProfile, loggedSessions:sessions, bodyweights }, "workout-log-"+(activeProfile||"default")+"-"+todayISO()+".json");
    setSaveStatus(ok?"saved":"error"); setStatusMsg(ok?"Export downloaded ✓":"Export failed.");
    setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},2000);
  }

  const prMap = buildPRMap(sessions);

  function getLastTime(name) {
    for (const s of [...sessions].sort((a,b)=>b.date.localeCompare(a.date))) {
      const ex = s.exercises.find(e=>e.name===name);
      if (ex&&ex.sets.length>0) return {date:s.date, sets:ex.sets};
    }
    return null;
  }

  function copyLastTime(ei, name) {
    const last = getLastTime(name);
    if (!last) return;
    setDraft(prev => ({ ...prev, exercises: prev.exercises.map((ex,i) => i!==ei?ex:{ ...ex, sets:last.sets.map(s=>({weight:String(s.weight??""),reps:"",unit:s.unit||"lb",done:false})) }) }));
  }

  function getProgressData(name) {
    return sessions.filter(s=>s.exercises.some(e=>e.name===name)).map(s => {
      const ex = s.exercises.find(e=>e.name===name);
      const weights = ex.sets.map(s=>parseFloat(s.weight)).filter(w=>!isNaN(w));
      if (!weights.length) return null;
      return { date:s.date, maxWeight:Math.max(...weights), volume:ex.sets.reduce((sum,s)=>(parseFloat(s.weight)||0)*(parseFloat(s.reps)||0)+sum,0) };
    }).filter(Boolean);
  }

  function getBest1RM(name) {
    let best = 0;
    sessions.forEach(s => s.exercises.find(e=>e.name===name)?.sets.forEach(set => {
      const w=parseFloat(set.weight), r=parseFloat(set.reps);
      if (!isNaN(w)&&!isNaN(r)&&r>0) best=Math.max(best,w*(1+r/30));
    }));
    return best>0?Math.round(best):null;
  }

  function getStreak() {
    if (!sessions.length) return 0;
    const dates = Array.from(new Set(sessions.map(s=>s.date))).sort((a,b)=>b.localeCompare(a));
    const today = todayISO();
    if (dates[0]!==today&&dates[0]!==addDaysISO(today,-1)) return 0;
    let streak=0; let cursor=dates[0];
    for (const d of dates) {
      if (d===cursor) { streak++; cursor=addDaysISO(cursor,-1); } else break;
    }
    return streak;
  }

  const allExNames = Array.from(new Set(allVariantNames())).sort();
  const sortedSessions = [...sessions].sort((a,b)=>b.date.localeCompare(a.date));
  const dayMeta = dayTemplates[currentDay];
  const draftFilled = draft.exercises.reduce((n,ex)=>n+ex.sets.filter(s=>String(s.weight).trim()!==""&&String(s.reps).trim()!=="").length,0);

  if (loading) return (
    <div style={{background:"#08090E",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"#666",fontFamily:"sans-serif"}}>
      Loading your training log...
    </div>
  );

  return (
    <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",background:"#08090E",minHeight:"100vh",color:"#ECEAF4",paddingBottom:80}}>

      {/* ── HERO ── */}
      <div style={{padding:"32px 20px 24px",background:"linear-gradient(160deg,#0F101A 0%,#08090E 70%)",borderBottom:"1px solid #16172A"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
          <div>
            <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.25)",borderRadius:100,padding:"4px 14px",marginBottom:12,fontSize:11,fontWeight:700,color:"#60A5FA",letterSpacing:"0.12em"}}>TRAINING LOG</div>
            <h1 style={{fontSize:"clamp(22px,5vw,32px)",fontWeight:900,margin:"0 0 4px",letterSpacing:"-0.02em"}}>12-Week Tracker</h1>
            <p style={{color:"#666",fontSize:13,margin:0}}>{sessions.length} session{sessions.length!==1?"s":""} logged · auto-saved{getStreak()>1?"  ·  🔥 "+getStreak()+"-day streak":""}</p>
          </div>
          <button onClick={exportData} style={{background:"#13141F",border:"1px solid #2A2A3A",borderRadius:10,padding:"10px 14px",color:"#9CA3AF",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0,whiteSpace:"nowrap"}}>⬇ Export</button>
        </div>

        {/* Profile bar */}
        <div style={{marginTop:18,position:"relative"}}>
          <button onClick={()=>{setShowProfileMenu(v=>!v);setConfirmDeleteProfile(false);}} style={{display:"inline-flex",alignItems:"center",gap:10,background:"#13141F",border:"1px solid #2A2A3A",borderRadius:100,padding:"6px 8px 6px 6px",cursor:"pointer",fontFamily:"inherit"}}>
            <span style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",color:"#fff",fontSize:13,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",textTransform:"uppercase"}}>{(activeProfile||"?").slice(0,1)}</span>
            <span style={{fontSize:13,fontWeight:700,color:"#ECEAF4",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{activeProfile}</span>
            <span style={{fontSize:10,color:"#666",paddingRight:4}}>{showProfileMenu?"▲":"▼"}</span>
          </button>

          {showProfileMenu && (
            <div style={{position:"absolute",top:"calc(100% + 8px)",left:0,zIndex:60,background:"#0F1018",border:"1px solid #2A2A3A",borderRadius:14,padding:10,width:280,boxShadow:"0 12px 40px rgba(0,0,0,0.6)"}}>
              <div style={{fontSize:10,color:"#666",fontWeight:700,letterSpacing:"0.1em",padding:"4px 8px 8px"}}>SWITCH PROFILE</div>
              {profiles.map(p => (
                <button key={p} onClick={()=>switchProfile(p)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,background:p===activeProfile?"#161723":"none",border:"none",borderRadius:8,padding:"8px",cursor:"pointer",fontFamily:"inherit",marginBottom:2}}>
                  <span style={{width:24,height:24,borderRadius:"50%",background:p===activeProfile?"linear-gradient(135deg,#3B82F6,#8B5CF6)":"#1E2035",color:"#fff",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",textTransform:"uppercase",flexShrink:0}}>{p.slice(0,1)}</span>
                  <span style={{fontSize:13,color:p===activeProfile?"#ECEAF4":"#9CA3AF",fontWeight:p===activeProfile?700:500,flex:1,textAlign:"left",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p}</span>
                  {p===activeProfile&&<span style={{fontSize:10,color:"#4ADE80"}}>● active</span>}
                </button>
              ))}
              <div style={{borderTop:"1px solid #1A1A28",margin:"8px 0",paddingTop:10}}>
                <div style={{display:"flex",gap:6}}>
                  <input type="text" value={newProfileName} onChange={e=>setNewProfileName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")createProfile();}} placeholder="New username..." maxLength={24}
                    style={{flex:1,background:"#161723",border:"1px solid #1E2035",borderRadius:8,padding:"8px 10px",color:"#ECEAF4",fontSize:13,fontFamily:"inherit",minWidth:0}}/>
                  <button onClick={createProfile} disabled={!cleanUsername(newProfileName)}
                    style={{background:cleanUsername(newProfileName)?"#3B82F6":"#1E2035",border:"none",borderRadius:8,padding:"8px 14px",color:cleanUsername(newProfileName)?"#fff":"#555",fontSize:13,fontWeight:700,cursor:cleanUsername(newProfileName)?"pointer":"default",fontFamily:"inherit",flexShrink:0}}>Add</button>
                </div>
              </div>
              {profiles.length > 1 && (
                <div style={{borderTop:"1px solid #1A1A28",marginTop:8,paddingTop:8}}>
                  {confirmDeleteProfile ? (
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"4px 8px"}}>
                      <span style={{fontSize:11,color:"#888",flex:1}}>Delete "{activeProfile}"?</span>
                      <button onClick={()=>deleteProfile(activeProfile)} style={{background:"#EF4444",border:"none",borderRadius:6,padding:"4px 10px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Yes</button>
                      <button onClick={()=>setConfirmDeleteProfile(false)} style={{background:"#1E2035",border:"none",borderRadius:6,padding:"4px 10px",color:"#888",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>No</button>
                    </div>
                  ) : (
                    <button onClick={()=>setConfirmDeleteProfile(true)} style={{background:"none",border:"none",color:"#5A5A66",fontSize:11,cursor:"pointer",fontFamily:"inherit",padding:"4px 8px",textDecoration:"underline"}}>Delete current profile</button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{display:"flex",borderBottom:"1px solid #16172A",maxWidth:720,margin:"0 auto",overflowX:"auto"}}>
        {[["log","Log Workout"],["history","History"],["progress","Progress"],["weight","Weight"]].map(([id,label])=>(
          <button key={id} onClick={()=>switchTab(id)} style={{background:"none",border:"none",color:activeTab===id?"#ECEAF4":"#444",fontWeight:700,fontSize:13,padding:"14px 18px",cursor:"pointer",borderBottom:activeTab===id?"2px solid #3B82F6":"2px solid transparent",transition:"all 0.15s",fontFamily:"inherit",whiteSpace:"nowrap"}}>{label}</button>
        ))}
      </div>

      <div style={{maxWidth:720,margin:"0 auto",padding:"20px 16px 0"}}>

        {/* Status banners */}
        {saveStatus==="saving"&&<div style={{background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:10,padding:"8px 14px",marginBottom:14,fontSize:12,color:"#60A5FA"}}>Saving...</div>}
        {saveStatus==="saved"&&<div style={{background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:10,padding:"8px 14px",marginBottom:14,fontSize:12,color:"#4ADE80"}}>{statusMsg||"Saved ✓"}</div>}
        {saveStatus==="error"&&<div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"8px 14px",marginBottom:14,fontSize:12,color:"#F87171"}}>{statusMsg||"Something went wrong."}</div>}

        {/* ── LOG TAB ── */}
        {activeTab==="log" && (
          <div>
            <div style={{display:"flex",gap:6,marginBottom:16,overflowX:"auto",paddingBottom:4}}>
              {dayOrder.map(k => {
                const t=dayTemplates[k]; const active=currentDay===k;
                return <button key={k} onClick={()=>switchDay(k)} style={{flex:"0 0 auto",background:active?t.color:"#13141F",color:active?"#fff":"#666",border:"1px solid "+(active?t.color:"#1E2035"),borderRadius:10,padding:"8px 14px",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit",transition:"all 0.2s"}}>
                  <div style={{fontSize:9,opacity:0.8,marginBottom:1}}>{k}</div>{t.emoji} {t.label}
                </button>;
              })}
            </div>

            {/* Coach note */}
            <div style={{background:"#0F1018",border:"1px solid "+dayMeta.color+"25",borderRadius:12,padding:"12px 16px",marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                <div>
                  <div style={{fontSize:14,fontWeight:800,color:dayMeta.color}}>{dayMeta.emoji} {dayMeta.label}</div>
                  <div style={{fontSize:11,color:"#777",marginTop:2}}>{dayMeta.focus}</div>
                </div>
                <button onClick={()=>setShowCoach(v=>!v)} style={{background:"none",border:"1px solid #2A2A3A",borderRadius:6,padding:"4px 10px",color:"#777",fontSize:11,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>{showCoach?"Hide":"Coach"}</button>
              </div>
              {showCoach&&<div style={{marginTop:10,fontSize:12,color:"#9CA3AF",lineHeight:1.5,borderTop:"1px solid #1A1A28",paddingTop:10}}>
                <div>📋 {dayMeta.coachNote}</div>
                <div style={{marginTop:6,color:"#666"}}>🏃 Cardio: {dayMeta.cardio}</div>
              </div>}
            </div>

            {/* Date */}
            <div style={{background:"#0F1018",border:"1px solid #16172A",borderRadius:12,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
              <label style={{fontSize:12,color:"#666",fontWeight:600}}>Date</label>
              <input type="date" value={draft.date} onChange={e=>setDraft(p=>({...p,date:e.target.value}))} style={{background:"#161723",border:"1px solid #1E2035",borderRadius:8,padding:"6px 10px",color:"#ECEAF4",fontSize:13,fontFamily:"inherit"}}/>
            </div>

            {/* Warm-up */}
            {dayMeta.warmup&&(
              <div style={{background:"#0F1018",border:"1px solid "+dayMeta.color+"20",borderRadius:14,padding:"14px 16px",marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:15}}>🤸</span>
                    <div><div style={{fontSize:13,fontWeight:800,color:dayMeta.color}}>Warm-Up</div><div style={{fontSize:10,color:"#666",marginTop:1}}>~5-8 min · do this before set 1</div></div>
                  </div>
                  <button onClick={()=>setShowWarmup(v=>!v)} style={{background:"none",border:"1px solid #2A2A3A",borderRadius:6,padding:"4px 10px",color:"#777",fontSize:11,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>{showWarmup?"Hide":"Show"}</button>
                </div>
                {showWarmup&&<div style={{marginTop:12,borderTop:"1px solid #1A1A28",paddingTop:12}}>
                  <div style={{fontSize:12,color:"#9CA3AF",marginBottom:12,display:"flex",gap:8,alignItems:"flex-start"}}>
                    <span style={{flexShrink:0}}>🔥</span><span><b style={{color:"#CFCDE0"}}>General:</b> {dayMeta.warmup.general}</span>
                  </div>
                  {dayMeta.warmup.drills.map((d,i)=>(
                    <div key={i} style={{display:"flex",gap:10,marginBottom:9,alignItems:"flex-start"}}>
                      <span style={{flexShrink:0,width:18,height:18,borderRadius:5,background:dayMeta.color+"22",color:dayMeta.color,fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",marginTop:1}}>{i+1}</span>
                      <div style={{fontSize:12,lineHeight:1.45}}><span style={{fontWeight:700,color:"#CFCDE0"}}>{d.name}</span><span style={{color:"#777"}}> — {d.detail}</span></div>
                    </div>
                  ))}
                </div>}
              </div>
            )}

            {/* Exercises */}
            {draft.exercises.map((ex,ei)=>{
              const planEx=variantFor(dayMeta.exercises[ei], ex.equipment);
              const variants=dayMeta.exercises[ei].variants;
              const pr=prMap[ex.name];
              const last=getLastTime(ex.name);
              return (
                <div key={ei} style={{background:"#0F1018",border:"1px solid "+dayMeta.color+"20",borderRadius:14,padding:"14px 16px",marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4,gap:8}}>
                    <button onClick={()=>formGuide[ex.name]&&setGuideExercise(ex.name)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",padding:0,cursor:formGuide[ex.name]?"pointer":"default",fontFamily:"inherit",textAlign:"left"}}>
                      <span style={{fontWeight:700,fontSize:14,color:dayMeta.color}}>{ex.name}</span>
                      {formGuide[ex.name]&&<span style={{fontSize:9,color:dayMeta.color,border:"1px solid "+dayMeta.color+"55",borderRadius:5,padding:"1px 5px",fontWeight:700,flexShrink:0}}>ⓘ form</span>}
                    </button>
                    <div style={{fontSize:10,color:"#444",background:"#161723",borderRadius:6,padding:"2px 8px",flexShrink:0}}>Target: {planEx.target}</div>
                  </div>

                  {variants.length>1&&(
                    <div style={{display:"flex",gap:4,marginBottom:8}}>
                      {variants.map(v=>{
                        const on=ex.equipment===v.equipment;
                        return (
                          <button key={v.equipment} onClick={()=>requestEquipmentSwitch(ei,v.equipment)}
                            style={{background:on?dayMeta.color:"#161723",border:"1px solid "+(on?dayMeta.color:"#1E2035"),borderRadius:7,padding:"3px 11px",color:on?"#fff":"#777",fontSize:10,fontWeight:700,cursor:on?"default":"pointer",fontFamily:"inherit"}}>
                            {v.equipment==="free"?"Free":"Machine"}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {confirmSwitch&&confirmSwitch.ei===ei&&(
                    <div style={{background:"#0C0D16",border:"1px solid "+dayMeta.color+"40",borderRadius:8,padding:"9px 12px",marginBottom:8}}>
                      <div style={{fontSize:11,color:"#9CA3AF",lineHeight:1.45,marginBottom:8}}>
                        Switch to {confirmSwitch.equipment==="machine"?"the machine":"free weights"}? The {countEnteredSets(ex.sets)} set{countEnteredSets(ex.sets)!==1?"s":""} you've entered will be cleared.
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>applyEquipmentSwitch(ei,confirmSwitch.equipment)}
                          style={{background:dayMeta.color,border:"none",borderRadius:6,padding:"4px 12px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Switch</button>
                        <button onClick={()=>setConfirmSwitch(null)}
                          style={{background:"#1E2035",border:"none",borderRadius:6,padding:"4px 12px",color:"#888",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {pr&&<div style={{fontSize:10,color:"#FBBF24",marginBottom:6,fontWeight:600}}>🏆 Best: {pr.weight}{ex.sets[0]?.unit||"lb"} × {pr.reps} ({pr.date})</div>}

                  {last&&(
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                      <span style={{fontSize:10,color:"#666",fontWeight:600,flexShrink:0}}>↩ Last ({last.date.slice(5)}):</span>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap",flex:1,minWidth:0}}>
                        {last.sets.map((s,j)=><span key={j} style={{fontSize:10,color:"#9CA3AF",background:"#161723",borderRadius:5,padding:"2px 7px"}}>{s.weight||"0"}{s.unit} × {s.reps||"0"}</span>)}
                      </div>
                      <button onClick={()=>copyLastTime(ei,ex.name)} style={{background:"rgba(59,130,246,0.1)",border:"1px solid "+dayMeta.color+"40",borderRadius:6,padding:"3px 9px",color:dayMeta.color,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Copy weights</button>
                    </div>
                  )}

                  {ex.sets.map((set,si)=>{
                    const isPR=pr&&parseFloat(set.weight)>pr.weight;
                    const pKey=ei+"-"+si;
                    const pOpen=plateFor===pKey;
                    const pData=pOpen?calcPlates(parseFloat(set.weight),set.unit):null;
                    return (
                      <div key={si} style={{position:"relative",marginBottom:8}}>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <button onClick={()=>toggleSetDone(ei,si)} style={{width:22,height:22,flexShrink:0,borderRadius:6,border:"1px solid "+(set.done?dayMeta.color:"#2A2A3A"),background:set.done?dayMeta.color:"transparent",color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>
                            {set.done?"✓":(si+1)}
                          </button>
                          <input type="number" inputMode="decimal" placeholder="Weight" value={set.weight} onChange={e=>updateSet(ei,si,"weight",e.target.value)}
                            style={{flex:1,background:"#161723",border:"1px solid "+(isPR?"#FBBF24":"#1E2035"),borderRadius:8,padding:"8px 10px",color:"#ECEAF4",fontSize:13,fontFamily:"inherit",minWidth:0}}/>
                          <button onClick={()=>setPlateFor(pOpen?null:pKey)} disabled={!parseFloat(set.weight)} title="Plate calculator"
                            style={{background:pOpen?dayMeta.color:"#161723",border:"1px solid "+(pOpen?dayMeta.color:"#1E2035"),borderRadius:8,padding:"8px 9px",color:pOpen?"#fff":(parseFloat(set.weight)?"#9CA3AF":"#3A3A45"),fontSize:13,cursor:parseFloat(set.weight)?"pointer":"default",fontFamily:"inherit",flexShrink:0}}>🏋</button>
                          <select value={set.unit} onChange={e=>updateSet(ei,si,"unit",e.target.value)}
                            style={{background:"#161723",border:"1px solid #1E2035",borderRadius:8,padding:"8px 6px",color:"#888",fontSize:12,fontFamily:"inherit",flexShrink:0}}>
                            <option value="lb">lb</option><option value="kg">kg</option>
                          </select>
                          <input type="number" inputMode="numeric" placeholder="Reps" value={set.reps} onChange={e=>updateSet(ei,si,"reps",e.target.value)}
                            style={{flex:1,background:"#161723",border:"1px solid #1E2035",borderRadius:8,padding:"8px 10px",color:"#ECEAF4",fontSize:13,fontFamily:"inherit",minWidth:0}}/>
                          <button onClick={()=>removeSet(ei,si)} disabled={ex.sets.length<=1}
                            style={{background:"none",border:"none",color:ex.sets.length<=1?"#2A2A35":"#F87171",fontSize:16,cursor:ex.sets.length<=1?"default":"pointer",flexShrink:0,padding:"0 4px",fontFamily:"inherit"}}>×</button>
                        </div>
                        {pOpen&&pData&&(
                          <div style={{background:"#0C0D16",border:"1px solid "+dayMeta.color+"30",borderRadius:8,padding:"8px 12px",marginTop:6,fontSize:11}}>
                            {pData.perSide.length===0
                              ? <span style={{color:"#888"}}>At or below bar weight ({pData.bar}{set.unit}) — no plates needed.</span>
                              : <div>
                                  <span style={{color:"#666",fontWeight:700}}>Per side ({pData.bar}{set.unit} bar): </span>
                                  {pData.perSide.map((p,k)=><span key={k} style={{color:dayMeta.color,fontWeight:700}}>{p.count}×{p.plate}{k<pData.perSide.length-1?"  ·  ":""}</span>)}
                                  {pData.leftover>0&&<span style={{color:"#F87171",marginLeft:6}}>(+{pData.leftover}{set.unit} unmatched)</span>}
                                </div>
                            }
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <button onClick={()=>addSet(ei)} style={{background:"rgba(255,255,255,0.03)",border:"1px dashed #2A2A3A",borderRadius:8,padding:"6px 12px",color:"#666",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",width:"100%",marginTop:2}}>+ Add Set</button>
                  <div style={{marginTop:8,fontSize:11,color:"#555",lineHeight:1.5}}>💡 {planEx.tip}</div>
                </div>
              );
            })}

            <div style={{background:"#0F1018",border:"1px solid #16172A",borderRadius:14,padding:"14px 16px",marginBottom:16}}>
              <div style={{fontSize:12,color:"#666",fontWeight:600,marginBottom:8}}>Session Notes (optional)</div>
              <textarea value={draft.notes} onChange={e=>setDraft(p=>({...p,notes:e.target.value}))} placeholder="How did it feel? Energy, soreness..." rows={2}
                style={{width:"100%",background:"#161723",border:"1px solid #1E2035",borderRadius:8,padding:"8px 10px",color:"#ECEAF4",fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
            </div>

            <button onClick={saveSession} style={{width:"100%",background:dayMeta.color,border:"none",borderRadius:12,padding:"14px",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 20px "+dayMeta.color+"30"}}>
              Save Session{draftFilled>0?"  ·  "+draftFilled+" set"+(draftFilled!==1?"s":""):""}
            </button>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab==="history" && (
          <div>
            {sortedSessions.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:"#444",fontSize:13}}>No sessions logged yet.</div>}
            {sortedSessions.map(session=>{
              const meta=dayTemplates[session.day]; const isExp=expandedHistory===session.id;
              const vol=session.exercises.reduce((s,ex)=>s+ex.sets.reduce((s2,st)=>(parseFloat(st.weight)||0)*(parseFloat(st.reps)||0)+s2,0),0);
              return (
                <div key={session.id} style={{marginBottom:10}}>
                  <div onClick={()=>setExpandedHistory(isExp?null:session.id)} style={{background:isExp?"#161723":"#0F1018",border:"1px solid "+(isExp?meta.color+"30":"#16172A"),borderRadius:isExp?"12px 12px 0 0":"12px",padding:"12px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <span style={{fontSize:18}}>{meta.emoji}</span>
                      <div><div style={{fontWeight:700,fontSize:13}}>{meta.label}</div><div style={{fontSize:11,color:"#555"}}>{session.date}</div></div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      {vol>0&&<span style={{fontSize:10,color:"#555"}}>{Math.round(vol).toLocaleString()} vol</span>}
                      <span style={{fontSize:12,color:"#444"}}>{isExp?"▲":"▼"}</span>
                    </div>
                  </div>
                  {isExp&&(
                    <div style={{background:"#0C0D16",border:"1px solid "+meta.color+"20",borderTop:"none",borderRadius:"0 0 12px 12px",padding:"12px 16px"}}>
                      {session.exercises.map((ex,i)=>(
                        <div key={i} style={{marginBottom:10}}>
                          <div style={{fontSize:12,fontWeight:700,color:meta.color,marginBottom:4}}>{ex.name}</div>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                            {ex.sets.map((s,j)=><span key={j} style={{background:"#161723",borderRadius:6,padding:"3px 10px",fontSize:11,color:"#9CA3AF"}}>{s.weight||"0"}{s.unit} × {s.reps||"0"}</span>)}
                          </div>
                        </div>
                      ))}
                      {session.notes&&<div style={{marginTop:8,fontSize:12,color:"#666",fontStyle:"italic",borderTop:"1px solid #1A1A28",paddingTop:8}}>"{session.notes}"</div>}
                      <div style={{marginTop:10,display:"flex",justifyContent:"flex-end"}}>
                        {confirmDelete===session.id
                          ? <div style={{display:"flex",gap:8,alignItems:"center"}}>
                              <span style={{fontSize:11,color:"#888"}}>Delete this session?</span>
                              <button onClick={()=>deleteSession(session.id)} style={{background:"#EF4444",border:"none",borderRadius:6,padding:"4px 10px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Yes</button>
                              <button onClick={()=>setConfirmDelete(null)} style={{background:"#1E2035",border:"none",borderRadius:6,padding:"4px 10px",color:"#888",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
                            </div>
                          : <button onClick={()=>setConfirmDelete(session.id)} style={{background:"none",border:"1px solid #2A2A35",borderRadius:6,padding:"4px 10px",color:"#666",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Delete</button>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {sessions.length>0&&(
              <div style={{marginTop:24,textAlign:"center",display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}}>
                <button onClick={exportData} style={{background:"none",border:"1px solid #2A2A35",borderRadius:8,padding:"6px 14px",color:"#666",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>⬇ Export all</button>
                {confirmReset
                  ? <div style={{display:"inline-flex",gap:8,alignItems:"center",background:"#0F1018",border:"1px solid #2A2A35",borderRadius:10,padding:"6px 14px"}}>
                      <span style={{fontSize:12,color:"#888"}}>Delete ALL {sessions.length} sessions?</span>
                      <button onClick={resetAll} style={{background:"#EF4444",border:"none",borderRadius:6,padding:"4px 10px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Yes</button>
                      <button onClick={()=>setConfirmReset(false)} style={{background:"#1E2035",border:"none",borderRadius:6,padding:"4px 10px",color:"#888",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
                    </div>
                  : <button onClick={()=>setConfirmReset(true)} style={{background:"none",border:"none",color:"#3A3A45",fontSize:11,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>Reset all data</button>}
              </div>
            )}
          </div>
        )}

        {/* ── PROGRESS TAB ── */}
        {activeTab==="progress" && (
          <div>
            {sessions.length===0
              ? <div style={{textAlign:"center",padding:"40px 20px",color:"#444",fontSize:13}}>Log a few sessions first to see progress charts.</div>
              : <>
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:12,color:"#666",fontWeight:600,marginBottom:8}}>Select an exercise</div>
                    <select value={progressExercise||""} onChange={e=>setProgressExercise(e.target.value)}
                      style={{width:"100%",background:"#0F1018",border:"1px solid #16172A",borderRadius:10,padding:"10px 12px",color:"#ECEAF4",fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}>
                      <option value="">Choose an exercise...</option>
                      {allExNames.map(n=><option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  {progressExercise&&(()=>{
                    const data=getProgressData(progressExercise);
                    const est1RM=getBest1RM(progressExercise);
                    if (!data.length) return <div style={{textAlign:"center",padding:"30px 20px",color:"#444",fontSize:13}}>No logged data yet.</div>;
                    if (data.length===1) return (
                      <div style={{background:"#0F1018",border:"1px solid #16172A",borderRadius:14,padding:"16px"}}>
                        <div style={{fontSize:24,fontWeight:900,color:"#3B82F6"}}>{data[0].maxWeight}</div>
                        <div style={{fontSize:11,color:"#555"}}>max weight on {data[0].date}</div>
                        {est1RM&&<div style={{fontSize:12,color:"#FBBF24",marginTop:8}}>Est. 1RM: {est1RM}</div>}
                      </div>
                    );
                    const delta=data[data.length-1].maxWeight-data[0].maxWeight;
                    return (
                      <div style={{background:"#0F1018",border:"1px solid #16172A",borderRadius:14,padding:"16px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
                          <div style={{fontSize:13,fontWeight:700}}>{progressExercise}</div>
                          <div style={{display:"flex",gap:12}}>
                            {est1RM&&<div style={{fontSize:11,color:"#FBBF24"}}>Est. 1RM <b>{est1RM}</b></div>}
                            <div style={{fontSize:11,color:delta>=0?"#4ADE80":"#F87171"}}>{delta>=0?"▲ +":"▼ "}{delta} since start</div>
                          </div>
                        </div>
                        <div style={{width:"100%",height:220}}>
                          <ResponsiveContainer>
                            <LineChart data={data} margin={{top:5,right:10,left:-20,bottom:5}}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1E2035"/>
                              <XAxis dataKey="date" stroke="#444" tick={{fontSize:10}}/>
                              <YAxis stroke="#444" tick={{fontSize:10}}/>
                              <Tooltip contentStyle={{background:"#161723",border:"1px solid #2A2A3A",borderRadius:8,fontSize:12}}/>
                              <Legend wrapperStyle={{fontSize:11}}/>
                              <Line type="monotone" dataKey="maxWeight" name="Max Weight" stroke="#3B82F6" strokeWidth={2} dot={{r:3}}/>
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={{marginTop:16}}>
                          <div style={{fontSize:11,color:"#666",marginBottom:8,fontWeight:700}}>TOTAL VOLUME (weight × reps)</div>
                          <div style={{width:"100%",height:180}}>
                            <ResponsiveContainer>
                              <LineChart data={data} margin={{top:5,right:10,left:-20,bottom:5}}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1E2035"/>
                                <XAxis dataKey="date" stroke="#444" tick={{fontSize:10}}/>
                                <YAxis stroke="#444" tick={{fontSize:10}}/>
                                <Tooltip contentStyle={{background:"#161723",border:"1px solid #2A2A3A",borderRadius:8,fontSize:12}}/>
                                <Line type="monotone" dataKey="volume" name="Volume" stroke="#22C55E" strokeWidth={2} dot={{r:3}}/>
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <div style={{marginTop:20,background:"#0F1018",border:"1px solid #16172A",borderRadius:14,padding:"16px"}}>
                    <div style={{fontSize:12,color:"#666",fontWeight:700,marginBottom:10}}>OVERVIEW</div>
                    <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                      <div><div style={{fontSize:22,fontWeight:900,color:"#3B82F6"}}>{sessions.length}</div><div style={{fontSize:11,color:"#555"}}>Total sessions</div></div>
                      <div><div style={{fontSize:22,fontWeight:900,color:"#F59E0B"}}>{getStreak()}</div><div style={{fontSize:11,color:"#555"}}>Day streak</div></div>
                      <div><div style={{fontSize:22,fontWeight:900,color:"#22C55E"}}>{sessions.length>0?sessions[sessions.length-1].date:"-"}</div><div style={{fontSize:11,color:"#555"}}>Last session</div></div>
                    </div>
                  </div>
                </>
            }
          </div>
        )}

        {/* ── WEIGHT TAB ── */}
        {activeTab==="weight" && <WeightTab
          bodyweights={bodyweights}
          weightInput={weightInput} setWeightInput={setWeightInput}
          weightUnit={weightUnit} setWeightUnit={setWeightUnit}
          weightDate={weightDate} setWeightDate={setWeightDate}
          confirmDeleteWeight={confirmDeleteWeight} setConfirmDeleteWeight={setConfirmDeleteWeight}
          onAdd={addWeight} onDelete={deleteWeight}
        />}

      </div>

      {/* Rest timer */}
      {restRunning&&(
        <div style={{position:"fixed",bottom:16,left:"50%",transform:"translateX(-50%)",background:"#13141F",border:"1px solid "+dayMeta.color+"40",borderRadius:14,padding:"10px 16px",display:"flex",alignItems:"center",gap:14,boxShadow:"0 6px 24px rgba(0,0,0,0.5)",zIndex:50}}>
          <div style={{fontSize:11,color:"#888",fontWeight:700}}>REST</div>
          <div style={{fontSize:22,fontWeight:900,color:dayMeta.color,fontVariantNumeric:"tabular-nums",minWidth:56,textAlign:"center"}}>{fmtRest(restTarget-restSeconds)}</div>
          <div style={{display:"flex",gap:4}}>
            {[60,90,120].map(t=><button key={t} onClick={()=>{setRestTarget(t);setRestSeconds(0);}} style={{background:restTarget===t?dayMeta.color:"#1E2035",border:"none",borderRadius:6,padding:"4px 8px",color:restTarget===t?"#fff":"#888",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{t}s</button>)}
          </div>
          <button onClick={()=>{setRestRunning(false);setRestSeconds(0);}} style={{background:"none",border:"none",color:"#888",fontSize:18,cursor:"pointer",fontFamily:"inherit",padding:"0 2px"}}>×</button>
        </div>
      )}

      {/* Form guide modal */}
      {guideExercise&&formGuide[guideExercise]&&(()=>{
        const g=formGuide[guideExercise];
        return (
          <div onClick={()=>setGuideExercise(null)} style={{position:"fixed",inset:0,background:"rgba(4,5,10,0.8)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
            <div onClick={e=>e.stopPropagation()} style={{background:"#0B0C14",border:"1px solid #1E2035",borderRadius:"18px 18px 0 0",width:"100%",maxWidth:720,maxHeight:"92vh",overflowY:"auto",padding:"0 0 30px"}}>
              <div style={{position:"sticky",top:0,background:"#0B0C14",borderBottom:"1px solid #16172A",padding:"16px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:2}}>
                <div style={{fontSize:16,fontWeight:800,color:dayMeta.color}}>{guideExercise}</div>
                <button onClick={()=>setGuideExercise(null)} style={{background:"#161723",border:"1px solid #2A2A3A",borderRadius:8,width:30,height:30,color:"#9CA3AF",fontSize:18,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
              </div>
              <div style={{padding:"16px 18px"}}>
                <div style={{display:"grid",gridTemplateColumns:"0.8fr 1.5fr",gap:16}}>
                  <div>
                    <div style={{background:"#0C0D16",border:"1px solid #16172A",borderRadius:12,padding:10,display:"flex",flexDirection:"column",alignItems:"center",position:"sticky",top:70}}>
                      <div style={{fontSize:9,color:"#666",fontWeight:800,letterSpacing:"0.1em",marginBottom:4,alignSelf:"flex-start"}}>MUSCLES · {g.view==="back"?"BACK":"FRONT"}</div>
                      <BodyMap view={g.view} primary={g.primary} secondary={g.secondary} color={dayMeta.color}/>
                      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:8,justifyContent:"center"}}>
                        {g.primary.map(m=><span key={m} style={{fontSize:9,fontWeight:700,color:"#fff",background:dayMeta.color,borderRadius:100,padding:"2px 8px"}}>{MUSCLES[m]}</span>)}
                        {g.secondary.map(m=><span key={m} style={{fontSize:9,fontWeight:600,color:dayMeta.color,background:dayMeta.color+"1A",border:"1px solid "+dayMeta.color+"40",borderRadius:100,padding:"2px 8px"}}>{MUSCLES[m]}</span>)}
                      </div>
                      <div style={{fontSize:8.5,color:"#555",marginTop:6,textAlign:"center"}}>● primary　○ secondary</div>
                    </div>
                  </div>
                  <div>
                    <GuideSection icon="🧩" title="SETUP & POSITION" items={g.setup} color={dayMeta.color}/>
                    <GuideSection icon="🎯" title="EXECUTION" items={g.execution} color={dayMeta.color}/>
                    <div style={{marginBottom:14,background:"#0C0D16",border:"1px solid #16172A",borderRadius:10,padding:"10px 12px"}}>
                      <div style={{fontSize:11,color:"#60A5FA",fontWeight:800,letterSpacing:"0.06em",marginBottom:6}}>💨 BREATHING</div>
                      <div style={{fontSize:12.5,color:"#C4C2D4",lineHeight:1.5}}>{g.breathing}</div>
                    </div>
                    <div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.18)",borderRadius:10,padding:"10px 12px"}}>
                      <div style={{fontSize:11,color:"#F87171",fontWeight:800,letterSpacing:"0.06em",marginBottom:8}}>⚠️ COMMON MISTAKES</div>
                      {g.mistakes.map((c,i)=>(
                        <div key={i} style={{display:"flex",gap:8,marginBottom:6,alignItems:"flex-start"}}>
                          <span style={{flexShrink:0,color:"#F87171",fontSize:12,marginTop:1}}>✕</span>
                          <span style={{fontSize:12,color:"#B59CA0",lineHeight:1.45}}>{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}