import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { todayISO, todaysDayKey, addDaysISO } from "./dateUtils.js";
import { MUSCLES, formGuide } from "./data/formGuide.js";
import { dayOrder, dayTemplates, variantFor, allVariantNames, exerciseForVariantName } from "./data/exercises.js";
import { emptySets, hasEnteredData, countEnteredSets, buildDraftExercise, isCompleteSet, newSession } from "./draft.js";
import { loadPrefs, savePrefs, setPref, prefFor } from "./equipmentPrefs.js";
import { buildBackup, validateBackup, mergeBackup, replaceBackup } from "./backup.js";
import { firebaseConfigured, observeAuth, signInWithGoogle, signOutFirebase, loadCloudData, saveCloudSession, deleteCloudSession, saveCloudBodyweight, deleteCloudBodyweight, saveCloudSettings, saveCloudSnapshot } from "./firebase.js";
import { reconcileCloudData } from "./cloudData.js";
import { clearDraft, draftHasContent, loadDraft, saveDraft } from "./draftStorage.js";
import { getProgressionIncrements, getProgressionRecommendation, setProgressionIncrement } from "./progression.js";
import { announceRestComplete, getRestTimerSeconds, REST_TIMER_OPTIONS, setRestTimerSeconds } from "./restTimer.js";
import { trackingForExercise, trackingLabels, TRACKING_TYPES } from "./exerciseTracking.js";
import { createWorkoutSummary } from "./workoutSummary.js";
import { addExerciseToDraft, applyWorkoutTemplate, createCustomExercise, getCustomExercises, getWorkoutTemplates, saveWorkoutTemplate } from "./customWorkouts.js";
import { addGoal, getGoals, goalProgress, normalizeReadiness, readinessScore, removeGoal } from "./userFeatures.js";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { BarChart3, Cloud, Download, Dumbbell, History, Scale, Settings, Upload, X } from "lucide-react";
import { AppBar, Button, NavBar } from "./components/index.js";

const ProgressDashboard=lazy(()=>import("./ProgressDashboard.jsx"));
const NAV_ITEMS = [
  { id: "log",      label: "Workout",  Icon: Dumbbell },
  { id: "history",  label: "History",  Icon: History },
  { id: "progress", label: "Progress", Icon: BarChart3 },
  { id: "weight",   label: "Weight",   Icon: Scale },
  { id: "settings", label: "Settings", Icon: Settings },
];

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const SESSION_PREFIX  = "workout-sessions:";
const WEIGHT_PREFIX   = "workout-bodyweight:";
const TAB_KEY         = "workout-active-tab";
const LEGACY_ACTIVE_KEY = "workout-active-profile";
const LEGACY_OWNER_KEY = "workout-legacy-claimed-by";
const REST_TIMER_PREFIX = "workout-rest-timer:";

const storage = {
  get(key)        { try { return window.localStorage.getItem(key); }      catch { return null; } },
  set(key, value) { try { window.localStorage.setItem(key, value); return true; } catch { return false; } },
  remove(key)     { try { window.localStorage.removeItem(key); return true; }    catch { return false; } },
};

function sessionKey(u) { return SESSION_PREFIX + u; }
function weightKey(u)  { return WEIGHT_PREFIX  + u; }
function readStoredArray(key) {
  try {
    const raw = storage.get(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function firebaseErrorMessage(error, fallback) {
  const messages = {
    "auth/configuration-not-found": "Firebase Authentication is not configured. Open Authentication in the Firebase console, click Get started, then enable and save the Google provider.",
    "auth/operation-not-allowed": "Google sign-in is not enabled in Firebase Authentication.",
    "auth/unauthorized-domain": "This site is not listed under Firebase Authentication → Authorized domains.",
    "auth/popup-blocked": "The browser blocked the Google sign-in popup. Allow popups for this site and retry.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled before it completed.",
    "auth/network-request-failed": "Google sign-in could not reach Firebase. Check your connection and retry.",
    "permission-denied": "Firestore denied access. Publish the owner-only rules from firestore.rules.",
    "firestore/permission-denied": "Firestore denied access. Publish the owner-only rules from firestore.rules.",
    "cloud/timeout": "Firestore did not respond. Confirm that a Firestore database has been created for this Firebase project.",
  };
  return messages[error?.code] || (error?.message ? `${fallback} (${error.message})` : fallback);
}

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
  } catch { /* Leave the chart empty when a stored date cannot be parsed. */ }

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
  const [workoutSummary, setWorkoutSummary] = useState(null);

  // Internal storage namespace: Firebase UID when signed in, isolated guest
  // storage otherwise. This value is never used as the displayed username.
  const [activeProfile, setActiveProfile] = useState("guest");

  const [currentDay, setCurrentDay] = useState(() => todaysDayKey());
  const [draft, setDraft] = useState(() => newSession(todaysDayKey(), {}));
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [confirmDiscardDraft, setConfirmDiscardDraft] = useState(false);
  const draftNamespaceRef = useRef("guest");
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [progressExercise, setProgressExercise] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showCoach, setShowCoach] = useState(true);
  const [showWarmup, setShowWarmup] = useState(true);

  const [restSeconds, setRestSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [restTarget, setRestTarget] = useState(90);
  const [restComplete, setRestComplete] = useState(false);

  const [bodyweights, setBodyweights] = useState([]);
  const [weightInput, setWeightInput] = useState("");
  const [weightUnit, setWeightUnit] = useState("lb");
  const [weightDate, setWeightDate] = useState(() => todayISO());
  const [confirmDeleteWeight, setConfirmDeleteWeight] = useState(null);

  const [guideExercise, setGuideExercise] = useState(null);
  const [plateFor, setPlateFor] = useState(null);

  const [equipmentPrefs, setEquipmentPrefs] = useState({});
  const [confirmSwitch, setConfirmSwitch] = useState(null); // { ei, equipment } | null
  const [customExerciseId, setCustomExerciseId] = useState("");
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseTarget, setNewExerciseTarget] = useState("3 x 8-12");
  const [templateName, setTemplateName] = useState("");
  const [pendingTemplate, setPendingTemplate] = useState(null);
  const [workoutToolsMsg, setWorkoutToolsMsg] = useState(null);
  const [readiness, setReadiness] = useState(()=>normalizeReadiness());
  const [goalExercise, setGoalExercise] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalUnit, setGoalUnit] = useState("lb");
  const [goalMsg, setGoalMsg] = useState(null);

  const [pendingImport, setPendingImport] = useState(null); // { sessions, bodyweights, equipmentPrefs, profile, skipped } | null
  const importInputRef = useRef(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [cloudStatus, setCloudStatus] = useState(firebaseConfigured ? "signed-out" : "unconfigured");

  function switchTab(t) {
    const change=()=>setActiveTab(t);
    if(document.startViewTransition) document.startViewTransition(change); else change();
    try { if(navigator.vibrate) navigator.vibrate(8); } catch { /* Haptics are optional. */ }
    try { storage.set(TAB_KEY, t); } catch { /* Tab choice is not persisted when storage is unavailable. */ }
  }

  function restoreDraft(namespace, prefs) {
    const saved = loadDraft(storage, namespace);
    const next = saved?.draft || newSession(todaysDayKey(), prefs);
    draftNamespaceRef.current = namespace;
    setCurrentDay(next.day);
    setDraft(next);
    setDraftSavedAt(saved?.savedAt || null);
    setConfirmDiscardDraft(false);
  }

  // Bootstrap
  useEffect(() => {
    let cancelled = false;
    try {
      if (!cancelled) {
        const prefs = loadPrefs(storage, "guest");
        setSessions(readStoredArray(sessionKey("guest")));
        setBodyweights(readStoredArray(weightKey("guest")));
        setEquipmentPrefs(prefs);
        restoreDraft("guest", prefs);
      }
    } catch { /* Guest mode remains empty if device storage is unavailable. */ }
    finally { if (!cancelled) setLoading(false); }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => observeAuth(user => {
    setFirebaseUser(user);
    const namespace = user ? user.uid : "guest";
    setActiveProfile(namespace);
    setCloudStatus(user ? "connected" : (firebaseConfigured ? "signed-out" : "unconfigured"));
    if (!user) {
      const prefs = loadPrefs(storage, namespace);
      setSessions(readStoredArray(sessionKey(namespace)));
      setBodyweights(readStoredArray(weightKey(namespace)));
      setEquipmentPrefs(prefs);
      restoreDraft(namespace, prefs);
    }
  }), []);

  // Rest timer
  useEffect(()=>{
    const timer=setTimeout(()=>{
      const raw=storage.get(REST_TIMER_PREFIX+activeProfile);
      if (!raw) return;
      try { const saved=JSON.parse(raw),remaining=Math.ceil((saved.endAt-Date.now())/1000); if(remaining>0&&saved.target>0){setRestTarget(saved.target);setRestSeconds(Math.max(0,saved.target-remaining));setRestComplete(false);setRestRunning(true);} else storage.remove(REST_TIMER_PREFIX+activeProfile); } catch { storage.remove(REST_TIMER_PREFIX+activeProfile); }
    },0);
    return ()=>clearTimeout(timer);
  },[activeProfile]);

  useEffect(()=>{
    const key=REST_TIMER_PREFIX+activeProfile;
    if(restRunning) storage.set(key,JSON.stringify({target:restTarget,endAt:Date.now()+Math.max(0,restTarget-restSeconds)*1000}));
    else if(restComplete) storage.remove(key);
  },[activeProfile,restRunning,restComplete,restSeconds,restTarget]);

  useEffect(() => {
    if (!restRunning) return;
    const t = setTimeout(()=>{
      const next=Math.min(restTarget,restSeconds+1);
      setRestSeconds(next);
      if(next>=restTarget) {
        setRestRunning(false);
        setRestComplete(true);
        announceRestComplete({isNative:Capacitor.isNativePlatform()});
      }
    },1000);
    return () => clearTimeout(t);
  }, [restRunning, restTarget, restSeconds]);

  function localProfileData(profile) {
    return { sessions:readStoredArray(sessionKey(profile)), bodyweights:readStoredArray(weightKey(profile)), equipmentPrefs:loadPrefs(storage, profile) };
  }

  async function syncProfileFromCloud(user, profile) {
    setCloudStatus("syncing");
    try {
      let local = localProfileData(profile);
      const legacyOwner = storage.get(LEGACY_OWNER_KEY);
      if (!legacyOwner) {
        const legacyProfile = storage.get(LEGACY_ACTIVE_KEY) || "default";
        const legacy = localProfileData(legacyProfile);
        local = mergeBackup(local, legacy);
      }
      const cloud = await loadCloudData(user.uid);
      const merged = reconcileCloudData(local, cloud);
      const sessionsOk = storage.set(sessionKey(profile), JSON.stringify(merged.sessions));
      const weightsOk = storage.set(weightKey(profile), JSON.stringify(merged.bodyweights));
      const prefsOk = savePrefs(storage, profile, merged.equipmentPrefs);
      if (!sessionsOk || !weightsOk || !prefsOk) throw new Error("Could not save merged data on this device.");
      await saveCloudSnapshot(user.uid, { ...merged, account:{ displayName:user.displayName||null, email:user.email||null } });
      if (!legacyOwner) storage.set(LEGACY_OWNER_KEY, user.uid);
      setSessions(merged.sessions); setBodyweights(merged.bodyweights); setEquipmentPrefs(merged.equipmentPrefs);
      restoreDraft(profile, merged.equipmentPrefs);
      setCloudStatus("connected");
    } catch (error) {
      console.error("Firebase sync failed", error);
      setCloudStatus("error"); setSaveStatus("error");
      setStatusMsg(firebaseErrorMessage(error, "Cloud sync failed") + " Your data is still saved on this device.");
    }
  }

  async function connectFirebase() {
    setCloudStatus("syncing");
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Google sign-in failed", error);
      setCloudStatus("error"); setSaveStatus("error");
      setStatusMsg(firebaseErrorMessage(error, "Google sign-in failed"));
    }
  }

  async function disconnectFirebase() { await signOutFirebase(); setCloudStatus("signed-out"); }

  function runCloud(operation) {
    if (!firebaseUser || !operation) return;
    setCloudStatus("syncing");
    const promise = typeof operation === "function" ? operation() : operation;
    promise
      .then(()=>setCloudStatus("connected"))
      .catch(error=>{ console.error("Firebase save failed", error); setCloudStatus("error"); });
  }

  function accountMetadata() {
    return { displayName:firebaseUser?.displayName||null, email:firebaseUser?.email||null };
  }

  function pushSnapshot(data, replace=false) {
    if (!firebaseUser) return;
    runCloud(saveCloudSnapshot(firebaseUser.uid, { ...data, account:accountMetadata() }, { replace }));
  }

  useEffect(() => {
    if (loading || !firebaseUser || !activeProfile) return;
    const timer = setTimeout(() => syncProfileFromCloud(firebaseUser, activeProfile), 0);
    return () => clearTimeout(timer);
    // Sync only when authentication or the selected local profile changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, firebaseUser, activeProfile]);

  useEffect(() => {
    if (loading || draftNamespaceRef.current !== activeProfile) return;
    const timer = setTimeout(() => {
      if (draftHasContent(draft)) {
        const now = new Date();
        if (saveDraft(storage, activeProfile, draft, now)) setDraftSavedAt(now.toISOString());
      } else {
        clearDraft(storage, activeProfile);
        setDraftSavedAt(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, activeProfile, loading]);

  // Raw disk write, no saveStatus side effects — used by persist() below for
  // the normal save flow, and directly by applyImportedData(), which needs to
  // attempt (and potentially roll back) a write without an intermediate
  // "saving..." flicker or timeout racing its own status messages.
  function writeSessions(updated) {
    if (!activeProfile) return false;
    return storage.set(sessionKey(activeProfile), JSON.stringify(updated));
  }

  function persist(updated, cloudOperation=null) {
    if (!activeProfile) return false;
    setSaveStatus("saving");
    const ok = writeSessions(updated);
    if (ok) { runCloud(cloudOperation); setSaveStatus("saved"); setTimeout(()=>setSaveStatus("idle"),1500); }
    else { setSaveStatus("error"); setStatusMsg("Could not save."); }
    return ok;
  }

  function writeWeights(updated) {
    if (!activeProfile) return false;
    return storage.set(weightKey(activeProfile), JSON.stringify(updated));
  }

  function persistWeights(updated, cloudOperation=null) {
    const ok = writeWeights(updated);
    if (ok) runCloud(cloudOperation);
    return ok;
  }

  function switchDay(k) { setCurrentDay(k); setDraft(newSession(k, equipmentPrefs)); setDraftSavedAt(null); setConfirmDiscardDraft(false); setConfirmSwitch(null); }

  function discardDraft() {
    clearDraft(storage, activeProfile);
    const fresh = newSession(currentDay, equipmentPrefs);
    draftNamespaceRef.current = activeProfile;
    setDraft(fresh); setDraftSavedAt(null); setConfirmDiscardDraft(false); setConfirmSwitch(null); setPlateFor(null);
  }

  function requestEquipmentSwitch(ei, equipment) {
    const ex = draft.exercises[ei];
    if (!ex || ex.equipment === equipment) return;
    if (hasEnteredData(ex.sets)) { setConfirmSwitch({ ei, equipment }); return; }
    applyEquipmentSwitch(ei, equipment);
  }

  function applyEquipmentSwitch(ei, equipment) {
    const planEx = exerciseForVariantName(draft.exercises[ei]?.name);
    if (!planEx) return;
    const v = variantFor(planEx, equipment);
    setDraft(prev => ({ ...prev, exercises: prev.exercises.map((ex,i) => i!==ei ? ex : buildDraftExercise(v)) }));
    const updated = setPref(equipmentPrefs, planEx.variants[0].name, v.equipment);
    setEquipmentPrefs(updated);
    savePrefs(storage, activeProfile, updated);
    if (firebaseUser) runCloud(saveCloudSettings(firebaseUser.uid, updated, accountMetadata()));
    setConfirmSwitch(null);
    setPlateFor(null);
  }

  function saveAccountPrefs(updated) {
    setEquipmentPrefs(updated);
    savePrefs(storage, activeProfile, updated);
    if (firebaseUser) runCloud(saveCloudSettings(firebaseUser.uid, updated, accountMetadata()));
  }

  function createAndAddExercise() {
    const result = createCustomExercise(equipmentPrefs, {name:newExerciseName,target:newExerciseTarget});
    if (!result.ok) { setWorkoutToolsMsg(result.error); return; }
    saveAccountPrefs(result.prefs);
    setDraft(prev=>addExerciseToDraft(prev,result.exercise));
    setNewExerciseName(""); setNewExerciseTarget("3 x 8-12"); setWorkoutToolsMsg(`Added ${result.exercise.name}.`);
  }

  function addDashboardExercise(name) {
    const family=exerciseForVariantName(name);
    if(!family) { setSaveStatus("error"); setStatusMsg("That exercise is not available in the built-in workout plan."); return; }
    const variant=family.variants.find(item=>item.name===name)||variantFor(family,prefFor(equipmentPrefs,family.variants[0].name));
    setDraft(previous=>previous.exercises.some(exercise=>family.variants.some(item=>item.name===exercise.name))
      ? previous
      : {...previous,exercises:[...previous.exercises,buildDraftExercise(variant)]});
    switchTab("log");
    setWorkoutToolsMsg(`${variant.name} added to your current workout.`);
  }

  function addSavedCustomExercise() {
    const exercise = getCustomExercises(equipmentPrefs).find(item=>item.id===customExerciseId);
    if (!exercise) return;
    setDraft(prev=>addExerciseToDraft(prev,exercise));
    setWorkoutToolsMsg(`Added ${exercise.name}.`);
  }

  function storeWorkoutTemplate() {
    const result = saveWorkoutTemplate(equipmentPrefs,templateName,draft,{restSeconds:restTimerDefault});
    if (!result.ok) { setWorkoutToolsMsg(result.error); return; }
    saveAccountPrefs(result.prefs); setTemplateName(""); setWorkoutToolsMsg(`Saved template “${result.template.name}”.`);
  }

  function applySavedWorkoutTemplate(template) {
    setDraft(prev=>applyWorkoutTemplate(prev,template));
    if(dayTemplates[template.day]) setCurrentDay(template.day);
    setRestTarget(template.restSeconds||restTimerDefault); setRestSeconds(0); setRestRunning(false); setRestComplete(false);
    setPendingTemplate(null); setDraftSavedAt(null); setConfirmSwitch(null); setPlateFor(null); setWorkoutToolsMsg(`Applied “${template.name}”.`);
  }

  function removeDraftExercise(index) {
    if (draft.exercises.length<=1) return;
    setDraft(prev=>({...prev,exercises:prev.exercises.filter((_,i)=>i!==index)}));
  }

  function moveDraftExercise(index, direction) {
    setDraft(prev=>{
      const target=index+direction;
      if (target<0||target>=prev.exercises.length) return prev;
      const exercises=[...prev.exercises];
      [exercises[index],exercises[target]]=[exercises[target],exercises[index]];
      return {...prev,exercises};
    });
  }

  function updateProgressionIncrement(unit, value) {
    const updated = setProgressionIncrement(equipmentPrefs, unit, value);
    setEquipmentPrefs(updated);
    savePrefs(storage, activeProfile, updated);
    if (firebaseUser) runCloud(saveCloudSettings(firebaseUser.uid, updated, accountMetadata()));
  }

  function updateRestTimerDefault(seconds) {
    const updated = setRestTimerSeconds(equipmentPrefs, seconds);
    setEquipmentPrefs(updated);
    savePrefs(storage, activeProfile, updated);
    setRestTarget(getRestTimerSeconds(updated));
    setRestSeconds(0);
    setRestRunning(false);
    setRestComplete(false);
    if (firebaseUser) runCloud(saveCloudSettings(firebaseUser.uid, updated, accountMetadata()));
  }

  function startRestTimer(seconds = restTimerDefault) {
    if(typeof Notification!=="undefined"&&Notification.permission==="default") Notification.requestPermission().catch(()=>{});
    setRestTarget(seconds);
    setRestSeconds(0);
    setRestComplete(false);
    setRestRunning(true);
    if(Capacitor.isNativePlatform()) LocalNotifications.requestPermissions().then(permission=>permission.display==="granted"&&LocalNotifications.schedule({notifications:[{id:90901,title:"Rest complete",body:"Time for your next set.",schedule:{at:new Date(Date.now()+seconds*1000)}}]})).catch(()=>{});
  }

  function addRestTime(seconds=30) {
    setRestTarget(target=>target+seconds);
    if(!restRunning){setRestComplete(false);setRestRunning(true);}
    if(Capacitor.isNativePlatform()) LocalNotifications.cancel({notifications:[{id:90901}]}).then(()=>LocalNotifications.schedule({notifications:[{id:90901,title:"Rest complete",body:"Time for your next set.",schedule:{at:new Date(Date.now()+(Math.max(0,restTarget-restSeconds)+seconds)*1000)}}]})).catch(()=>{});
  }

  function stopRestTimer() {
    setRestRunning(false);setRestComplete(false);setRestSeconds(0);
    storage.remove(REST_TIMER_PREFIX+activeProfile);
    if(Capacitor.isNativePlatform()) LocalNotifications.cancel({notifications:[{id:90901}]}).catch(()=>{});
  }

  function createTrainingGoal() {
    const result=addGoal(equipmentPrefs,{exercise:goalExercise,target:goalTarget,unit:goalUnit});
    if(!result.ok){setGoalMsg(result.error);return;}
    saveAccountPrefs(result.prefs); setGoalTarget(""); setGoalMsg("Goal added.");
  }

  function updateSet(ei, si, field, val) {
    setDraft(prev => ({ ...prev, startedAt:prev.startedAt || (String(val).trim()!=="" ? new Date().toISOString() : null), exercises: prev.exercises.map((ex,i) => i!==ei?ex:{ ...ex, sets: ex.sets.map((s,j)=>j!==si?s:{...s,[field]:val}) }) }));
  }

  function toggleSetDone(ei, si) {
    const selectedSet=draft.exercises[ei]?.sets[si];
    const tracking=trackingForExercise(draft.exercises[ei]);
    const becomingDone=!selectedSet?.done;
    if(becomingDone&&!isCompleteSet(selectedSet,tracking)) {
      const labels=trackingLabels(tracking);
      setSaveStatus("error"); setStatusMsg(tracking===TRACKING_TYPES.WEIGHTED?"Enter both weight and reps before completing a set.":`Enter ${labels.measure.toLowerCase()} before completing a set.`);
      setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},2500);
      return;
    }
    setDraft(prev => ({ ...prev, startedAt:prev.startedAt || new Date().toISOString(), exercises: prev.exercises.map((ex,i) => i!==ei?ex:{ ...ex, sets: ex.sets.map((s,j)=>j!==si?s:{...s,done:becomingDone}) }) }));
    if (becomingDone) startRestTimer(getRestTimerSeconds(equipmentPrefs));
  }

  function addSet(ei) {
    setDraft(prev => ({ ...prev, exercises: prev.exercises.map((ex,i) => { if(i!==ei)return ex; const last=ex.sets[ex.sets.length-1]; return {...ex,sets:[...ex.sets,last?{weight:last.weight,reps:"",unit:last.unit,done:false}:emptySets()[0]]}; }) }));
  }

  function removeSet(ei, si) {
    setDraft(prev => ({ ...prev, exercises: prev.exercises.map((ex,i) => i!==ei||ex.sets.length<=1?ex:{ ...ex, sets:ex.sets.filter((_,j)=>j!==si) }) }));
  }

  function cleanSession(s) {
    return { ...s, exercises: s.exercises.map(ex=>({ ...ex, tracking:trackingForExercise(ex), sets:ex.sets.filter(set=>isCompleteSet(set,trackingForExercise(ex))).map(({done,...r})=>r) })).filter(ex=>ex.sets.length>0) };
  }

  function saveSession() {
    const cleaned=cleanSession(draft);
    if (!cleaned.exercises.length) { setSaveStatus("error"); setStatusMsg("Complete at least one valid set. Weighted sets need weight and reps; bodyweight, timed, and distance sets need their result."); setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},2500); return; }
    const completedAt = new Date().toISOString();
    const saved = { ...cleaned, readiness:normalizeReadiness(readiness), completedAt };
    setWorkoutSummary(createWorkoutSummary(saved, sessions, completedAt));
    const updated = [...sessions, saved].sort((a,b)=>a.date.localeCompare(b.date));
    setSessions(updated); persist(updated, firebaseUser ? ()=>saveCloudSession(firebaseUser.uid, saved) : null);
    clearDraft(storage, activeProfile);
    setDraft(newSession(currentDay, equipmentPrefs)); setDraftSavedAt(null); setConfirmDiscardDraft(false); setConfirmSwitch(null); setRestRunning(false); setRestComplete(false); setRestSeconds(0);
  }

  function deleteSession(id) { const u=sessions.filter(s=>s.id!==id); setSessions(u); persist(u, firebaseUser ? ()=>deleteCloudSession(firebaseUser.uid, id) : null); setConfirmDelete(null); }
  function resetAll() { setSessions([]); persist([]); pushSnapshot({sessions:[],bodyweights,equipmentPrefs}, true); setConfirmReset(false); }

  function addWeight() {
    const w = parseFloat(weightInput);
    if (isNaN(w)||w<=0) { setSaveStatus("error"); setStatusMsg("Enter a valid weight."); setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},2000); return; }
    const entry = { id:"w_"+Date.now(), date:weightDate, weight:w, unit:weightUnit };
    const updated = [...bodyweights.filter(e=>e.date!==weightDate), entry].sort((a,b)=>a.date.localeCompare(b.date));
    setBodyweights(updated); persistWeights(updated, firebaseUser ? ()=>saveCloudBodyweight(firebaseUser.uid, entry) : null);
    setWeightInput("");
    setSaveStatus("saved"); setStatusMsg("Weight logged ✓"); setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},1500);
  }

  function deleteWeight(id) { const removed=bodyweights.find(e=>e.id===id); const u=bodyweights.filter(e=>e.id!==id); setBodyweights(u); persistWeights(u, firebaseUser&&removed ? ()=>deleteCloudBodyweight(firebaseUser.uid, removed.date) : null); setConfirmDeleteWeight(null); }

  function exportData() {
    const accountName = firebaseUser?.displayName || firebaseUser?.email || "guest";
    const safeName = accountName.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "");
    const backup = buildBackup({ profile:accountName, sessions, bodyweights, equipmentPrefs });
    const ok = downloadJSON(backup, "workout-log-"+(safeName||"guest")+"-"+todayISO()+".json");
    setSaveStatus(ok?"saved":"error"); setStatusMsg(ok?"Export downloaded ✓":"Export failed.");
    setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},2000);
  }

  function triggerImport() { if (importInputRef.current) importInputRef.current.click(); }

  function handleImportFile(e) {
    const file = e.target.files && e.target.files[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try { parsed = JSON.parse(String(reader.result)); }
      catch { setSaveStatus("error"); setStatusMsg("That file isn't valid JSON."); setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},3000); return; }
      const result = validateBackup(parsed);
      if (!result.ok) { setSaveStatus("error"); setStatusMsg(result.error); setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},3000); return; }
      setPendingImport(result.data);
    };
    reader.onerror = () => { setSaveStatus("error"); setStatusMsg("Could not read that file."); setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},3000); };
    reader.readAsText(file);
  }

  function applyImportedData({ sessions:newSessions, bodyweights:newWeights, equipmentPrefs:newPrefs }, msg, replaceCloud=false) {
    // React state must never diverge from disk. Snapshot what's currently
    // persisted (the `sessions`/`bodyweights`/`equipmentPrefs` state variables
    // ARE the on-disk values — nothing else writes to storage except through
    // persist()/persistWeights()/savePrefs()), attempt every write FIRST, and
    // only update state once all three have actually landed.
    const prevSessions = sessions;
    const prevWeights = bodyweights;
    const prevPrefs = equipmentPrefs;

    const sessionsOk = writeSessions(newSessions);
    const weightsOk = writeWeights(newWeights);
    const prefsOk = savePrefs(storage, activeProfile, newPrefs);

    setPendingImport(null);

    if (sessionsOk && weightsOk && prefsOk) {
      setSessions(newSessions);
      setBodyweights(newWeights);
      setEquipmentPrefs(newPrefs);
      pushSnapshot({sessions:newSessions, bodyweights:newWeights, equipmentPrefs:newPrefs}, replaceCloud);

      // Don't wipe a workout the user is mid-typing on the Log tab just
      // because an import happened — only reset the draft when it's still
      // empty, and only on this success path. The imported equipment prefs
      // simply won't apply until the *next* draft.
      const draftHasData = draft.exercises.some(ex => hasEnteredData(ex.sets));
      if (!draftHasData) setDraft(newSession(currentDay, newPrefs));

      setSaveStatus("saved");
      setStatusMsg(msg + (draftHasData ? " Your in-progress workout was kept." : ""));
      setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},3000);
      return;
    }

    // At least one write failed (quota, private-mode Safari, etc). React
    // state is left untouched — but any of the three writes that DID land
    // just pushed disk ahead of state, e.g. sessions saved before bodyweights
    // failed. Left alone, that's a half-applied import sitting on disk, and
    // the very next ordinary save (smaller payload, so it fits) would make it
    // permanent even though the UI never claimed success. Roll those back to
    // the pre-import snapshot so disk matches React state everywhere again.
    const rollbackFailures = [];
    if (sessionsOk && !writeSessions(prevSessions)) rollbackFailures.push("sessions");
    if (weightsOk && !writeWeights(prevWeights)) rollbackFailures.push("weigh-ins");
    if (prefsOk && !savePrefs(storage, activeProfile, prevPrefs)) rollbackFailures.push("equipment preferences");

    setSaveStatus("error");
    setStatusMsg(rollbackFailures.length === 0
      ? "Import did NOT save (device storage may be full) — your previous data is still safely on disk. Free up space and try again before logging anything new."
      : "Import failed AND couldn't fully undo the partial write (" + rollbackFailures.join(", ") + "). Your saved data may now be inconsistent — export immediately if you can, and check your history before logging anything new.");
    setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},3000);
  }

  function confirmImportMerge() {
    if (!pendingImport) return;
    const merged = mergeBackup({ sessions, bodyweights, equipmentPrefs }, pendingImport);
    const overwritten = merged.overwritten.bodyweights;
    applyImportedData(merged, "Imported "+merged.added.sessions+" new session"+(merged.added.sessions!==1?"s":"")+", "+merged.added.bodyweights+" weigh-in"+(merged.added.bodyweights!==1?"s":"")
      +(overwritten>0 ? ", "+overwritten+" weigh-in"+(overwritten!==1?"s":"")+" updated" : ""));
  }

  function confirmImportReplace() {
    if (!pendingImport) return;
    const replaced = replaceBackup(pendingImport);
    applyImportedData(replaced, "Replaced with "+replaced.sessions.length+" session"+(replaced.sessions.length!==1?"s":"")+", "+replaced.bodyweights.length+" weigh-in"+(replaced.bodyweights.length!==1?"s":"")+" from the file.", true);
  }

  const prMap = buildPRMap(sessions);
  // How many weigh-ins the pending import would silently overwrite if merged —
  // shown in the confirm panel so "Merge (recommended)" doesn't hide it.
  const pendingOverwrite = pendingImport ? mergeBackup({ sessions, bodyweights, equipmentPrefs }, pendingImport).overwritten.bodyweights : 0;

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

  const customExercises = getCustomExercises(equipmentPrefs);
  const workoutTemplates = getWorkoutTemplates(equipmentPrefs);
  const trainingGoals = getGoals(equipmentPrefs);
  const allExNames = Array.from(new Set([...allVariantNames(),...customExercises.map(item=>item.name),...sessions.flatMap(session=>session.exercises.map(ex=>ex.name))])).sort();
  const sortedSessions = [...sessions].sort((a,b)=>b.date.localeCompare(a.date));
  const dayMeta = dayTemplates[currentDay];
  const draftFilled = draft.exercises.reduce((n,ex)=>n+ex.sets.filter(set=>isCompleteSet(set,trackingForExercise(ex))).length,0);
  const progressionIncrements = getProgressionIncrements(equipmentPrefs);
  const restTimerDefault = getRestTimerSeconds(equipmentPrefs);

  if (loading) return (
    <div style={{background:"#08090E",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"#666",fontFamily:"sans-serif"}}>
      Loading your training log...
    </div>
  );

  return (
    <div className="app-shell">
      <AppBar
        overline={new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
        title="Pocket Gym Log"
        actions={
          <>
            {firebaseConfigured && (firebaseUser
              ? <Button variant="text" onClick={disconnectFirebase}
                        title={(firebaseUser.email || "Signed in") + " — click to sign out"}>
                  <Cloud size={16} />
                  {cloudStatus === "syncing" ? "Syncing…" : cloudStatus === "error" ? "Sync error" : "Synced"}
                </Button>
              : <Button variant="text" onClick={connectFirebase} disabled={cloudStatus === "syncing"}>
                  <Cloud size={16} />
                  {cloudStatus === "syncing" ? "Connecting…" : "Sign in"}
                </Button>)}
            <Button variant="text" onClick={exportData} aria-label="Export workout data">
              <Download size={16} />
            </Button>
            <Button variant="text" onClick={triggerImport} aria-label="Import workout data">
              <Upload size={16} />
            </Button>
            <input ref={importInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} style={{display:"none"}}/>
          </>
        }
      />

      <main className="app-content" style={{maxWidth:720,margin:"0 auto",padding:"20px 16px 0"}}>

        {/* Status banners */}
        {saveStatus==="saving"&&<div style={{background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:10,padding:"8px 14px",marginBottom:14,fontSize:12,color:"#60A5FA"}}>Saving...</div>}
        {saveStatus==="saved"&&<div style={{background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:10,padding:"8px 14px",marginBottom:14,fontSize:12,color:"#4ADE80"}}>{statusMsg||"Saved ✓"}</div>}
        {saveStatus==="error"&&<div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"8px 14px",marginBottom:14,fontSize:12,color:"#F87171"}}>{statusMsg||"Something went wrong."}</div>}

        {workoutSummary&&(
          <div style={{background:"linear-gradient(145deg,rgba(52,211,153,0.12),#0F1018 55%)",border:"1px solid rgba(52,211,153,0.3)",borderRadius:14,padding:"16px",marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:14}}>
              <div><div style={{fontSize:16,fontWeight:900,color:"#34D399"}}>✓ Workout complete</div><div style={{fontSize:11,color:"#777",marginTop:2}}>{workoutSummary.date} · {dayTemplates[workoutSummary.day]?.label || workoutSummary.day || "Workout"}</div></div>
              <button onClick={()=>setWorkoutSummary(null)} aria-label="Dismiss workout summary" style={{background:"none",border:"none",color:"#777",fontSize:18,cursor:"pointer",fontFamily:"inherit"}}>×</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8,marginBottom:workoutSummary.prs.length||workoutSummary.improvements.length||workoutSummary.notes?12:0}}>
              {[[workoutSummary.durationMinutes?workoutSummary.durationMinutes+"m":"—","Duration"],[workoutSummary.exercises,"Exercises"],[workoutSummary.sets,"Sets"],[workoutSummary.volumeLb.toLocaleString(),"Volume (lb)"]].map(([value,label])=><div key={label} style={{background:"rgba(8,9,14,0.55)",borderRadius:8,padding:"8px 6px",textAlign:"center"}}><div style={{fontSize:15,fontWeight:900,color:"#ECEAF4",overflow:"hidden",textOverflow:"ellipsis"}}>{value}</div><div style={{fontSize:9,color:"#666",marginTop:2}}>{label}</div></div>)}
            </div>
            {workoutSummary.prs.length>0&&<div style={{fontSize:11,color:"#FBBF24",lineHeight:1.55,marginTop:7}}>🏆 New PR{workoutSummary.prs.length!==1?"s":""}: {workoutSummary.prs.map(pr=>`${pr.name} ${pr.weight}${pr.unit} × ${pr.reps}`).join(" · ")}</div>}
            {workoutSummary.improvements.length>0&&<div style={{fontSize:11,color:"#60A5FA",lineHeight:1.55,marginTop:7}}>↗ Heavier than last time: {workoutSummary.improvements.map(item=>`${item.name} +${item.increaseLb} lb`).join(" · ")}</div>}
            {workoutSummary.notes&&<div style={{fontSize:11,color:"#9CA3AF",lineHeight:1.5,marginTop:9,paddingTop:8,borderTop:"1px solid #1E2035"}}>“{workoutSummary.notes}”</div>}
          </div>
        )}

        {/* ── IMPORT CONFIRMATION ── */}
        {pendingImport&&(
          <div style={{background:"#0F1018",border:"1px solid #2A2A3A",borderRadius:14,padding:"14px 16px",marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:800,color:"#ECEAF4",marginBottom:6}}>Import workout data</div>
            <div style={{fontSize:12,color:"#9CA3AF",lineHeight:1.6}}>
              File contains <b style={{color:"#ECEAF4"}}>{pendingImport.sessions.length}</b> session{pendingImport.sessions.length!==1?"s":""} and <b style={{color:"#ECEAF4"}}>{pendingImport.bodyweights.length}</b> weigh-in{pendingImport.bodyweights.length!==1?"s":""}, exported from profile <b style={{color:"#ECEAF4"}}>{pendingImport.profile||"unknown"}</b>.
              {(pendingImport.skipped.sessions>0||pendingImport.skipped.bodyweights>0)&&(
                <div style={{color:"#F59E0B",marginTop:4}}>Skipped {pendingImport.skipped.sessions} malformed session{pendingImport.skipped.sessions!==1?"s":""} and {pendingImport.skipped.bodyweights} malformed weigh-in{pendingImport.skipped.bodyweights!==1?"s":""}.</div>
              )}
              {pendingOverwrite>0&&(
                <div style={{color:"#60A5FA",marginTop:4}}>Merging will update {pendingOverwrite} weigh-in{pendingOverwrite!==1?"s":""} you already logged for those dates with the imported value.</div>
              )}
            </div>
            <div style={{fontSize:11,color:"#666",marginTop:8,background:"#0C0D16",border:"1px solid #16172A",borderRadius:8,padding:"8px 10px"}}>
              This will apply to <b style={{color:"#9CA3AF"}}>{firebaseUser?.displayName||firebaseUser?.email||"this device's guest log"}</b>, regardless of which account the file was exported from.
            </div>
            <div style={{marginTop:10,display:"flex",gap:8,flexWrap:"wrap"}}>
              <button onClick={confirmImportMerge} style={{background:"#3B82F6",border:"none",borderRadius:8,padding:"8px 16px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Merge (recommended)</button>
              <button onClick={confirmImportReplace} style={{background:"#EF4444",border:"none",borderRadius:8,padding:"8px 16px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Replace — deletes {sessions.length} existing session{sessions.length!==1?"s":""}</button>
              <button onClick={()=>setPendingImport(null)} style={{background:"#1E2035",border:"none",borderRadius:8,padding:"8px 16px",color:"#888",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
            </div>
          </div>
        )}

        {/* ── LOG TAB ── */}
        {activeTab==="log" && (
          <div>
            <div className="day-switcher" style={{display:"flex",gap:6,marginBottom:16,overflowX:"auto",paddingBottom:4}}>
              {dayOrder.map(k => {
                const t=dayTemplates[k]; const active=currentDay===k;
                return <button key={k} onClick={()=>switchDay(k)} style={{flex:"0 0 auto",background:active?t.color:"#13141F",color:active?"#fff":"#666",border:"1px solid "+(active?t.color:"#1E2035"),borderRadius:10,padding:"8px 14px",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit",transition:"all 0.2s"}}>
                  <div style={{fontSize:9,opacity:0.8,marginBottom:1}}>{k}</div>{t.emoji} {t.label}
                </button>;
              })}
            </div>

            {draftHasContent(draft)&&(
              <div style={{background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.22)",borderRadius:10,padding:"9px 12px",marginBottom:12,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <span style={{fontSize:11,color:"#60A5FA",fontWeight:700,flex:1}}>
                  {draftSavedAt ? "Draft saved on this device · "+new Date(draftSavedAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"}) : "Saving draft…"}
                </span>
                {confirmDiscardDraft ? (
                  <span style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:10,color:"#9CA3AF"}}>Discard entered workout?</span>
                    <button onClick={discardDraft} style={{background:"#EF4444",border:"none",borderRadius:6,padding:"4px 9px",color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Discard</button>
                    <button onClick={()=>setConfirmDiscardDraft(false)} style={{background:"#1E2035",border:"none",borderRadius:6,padding:"4px 9px",color:"#888",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
                  </span>
                ) : (
                  <button onClick={()=>setConfirmDiscardDraft(true)} style={{background:"none",border:"none",color:"#777",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>Discard draft</button>
                )}
              </div>
            )}

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

            {/* Rest timer controls are always visible during a workout. */}
            <div style={{background:"#0F1018",border:"1px solid "+dayMeta.color+"30",borderRadius:12,padding:"11px 14px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:12,fontWeight:800,color:dayMeta.color}}>⏱ Rest timer</div>
                <div style={{fontSize:10,color:"#666",marginTop:2}}>{restRunning?`${fmtRest(Math.max(0,restTarget-restSeconds))} remaining`:restComplete?"Rest complete":"Starts automatically when you check off a set"}</div>
              </div>
              <div style={{display:"flex",gap:5,alignItems:"center"}}>
                {REST_TIMER_OPTIONS.map(value=><button key={value} onClick={()=>startRestTimer(value)} aria-label={`Start a ${value} second rest timer`} style={{background:restTarget===value&&restRunning?dayMeta.color:"#161723",border:"1px solid "+(restTarget===value&&restRunning?dayMeta.color:"#2A2A3A"),borderRadius:7,padding:"6px 9px",color:restTarget===value&&restRunning?"#fff":"#888",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{value}s</button>)}
                {(restRunning||restComplete)&&<button onClick={stopRestTimer} style={{background:"none",border:"none",color:"#888",fontSize:18,cursor:"pointer",padding:"0 3px"}} aria-label="Stop rest timer">×</button>}
              </div>
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
              const family=exerciseForVariantName(ex.name);
              const planEx=family?variantFor(family,ex.equipment):{name:ex.name,equipment:"custom",target:ex.target||"3 x 8-12",tip:ex.tip||"Custom exercise"};
              const tracking=trackingForExercise({...ex,target:planEx.target});
              const trackingCopy=trackingLabels(tracking);
              const variants=family?family.variants:[planEx];
              const pr=prMap[ex.name];
              const last=getLastTime(ex.name);
              const progression=last&&getProgressionRecommendation(last.sets,planEx.target,progressionIncrements);
              return (
                <div className="workout-card" key={ei} style={{background:"#0F1018",border:"1px solid "+dayMeta.color+"20",borderRadius:14,padding:"14px 16px",marginBottom:10}}>
                  <div className="exercise-head" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4,gap:8}}>
                    <button onClick={()=>formGuide[ex.name]&&setGuideExercise(ex.name)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",padding:0,cursor:formGuide[ex.name]?"pointer":"default",fontFamily:"inherit",textAlign:"left"}}>
                      <span style={{fontWeight:700,fontSize:14,color:dayMeta.color}}>{ex.name}</span>
                      {formGuide[ex.name]&&<span style={{fontSize:9,color:dayMeta.color,border:"1px solid "+dayMeta.color+"55",borderRadius:5,padding:"1px 5px",fontWeight:700,flexShrink:0}}>ⓘ form</span>}
                    </button>
                    <div className="exercise-actions" style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}><div style={{fontSize:10,color:"#444",background:"#161723",borderRadius:6,padding:"2px 8px"}}>Target: {planEx.target}</div><span title={trackingCopy.help} style={{fontSize:8,color:tracking===TRACKING_TYPES.WEIGHTED?"#777":"#60A5FA",border:"1px solid #2A2A3A",borderRadius:5,padding:"2px 5px",textTransform:"uppercase"}}>{tracking}</span><button onClick={()=>moveDraftExercise(ei,-1)} disabled={ei===0} title="Move up" style={{background:"none",border:"none",color:ei===0?"#333":"#777",cursor:ei===0?"default":"pointer"}}>↑</button><button onClick={()=>moveDraftExercise(ei,1)} disabled={ei===draft.exercises.length-1} title="Move down" style={{background:"none",border:"none",color:ei===draft.exercises.length-1?"#333":"#777",cursor:ei===draft.exercises.length-1?"default":"pointer"}}>↓</button><button onClick={()=>removeDraftExercise(ei)} disabled={draft.exercises.length<=1} title="Remove exercise" style={{background:"none",border:"none",color:draft.exercises.length<=1?"#2A2A35":"#666",fontSize:15,cursor:draft.exercises.length<=1?"default":"pointer",padding:0}}>×</button></div>
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
                        {last.sets.map((s,j)=><span key={j} style={{fontSize:10,color:"#9CA3AF",background:"#161723",borderRadius:5,padding:"2px 7px"}}>{s.weight?`${s.weight}${s.unit} × `:""}{s.reps||"0"}{tracking===TRACKING_TYPES.TIMED?" sec":tracking===TRACKING_TYPES.DISTANCE?" m":" reps"}</span>)}
                      </div>
                      <button onClick={()=>copyLastTime(ei,ex.name)} style={{background:"rgba(59,130,246,0.1)",border:"1px solid "+dayMeta.color+"40",borderRadius:6,padding:"3px 9px",color:dayMeta.color,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Copy last</button>
                    </div>
                  )}

                  {progression&&(
                    <div style={{background:progression.action==="increase"?"rgba(52,211,153,0.08)":progression.action==="reduce"?"rgba(251,191,36,0.08)":"rgba(59,130,246,0.08)",border:"1px solid "+(progression.action==="increase"?"#34D39935":progression.action==="reduce"?"#FBBF2435":"#3B82F635"),borderRadius:8,padding:"8px 10px",marginBottom:10,fontSize:10,lineHeight:1.45,color:"#9CA3AF"}}>
                      <span style={{fontWeight:800,color:progression.action==="increase"?"#34D399":progression.action==="reduce"?"#FBBF24":"#60A5FA"}}>↗ {progression.label}: </span>{progression.message}
                    </div>
                  )}

                  {ex.sets.map((set,si)=>{
                    const isPR=pr&&parseFloat(set.weight)>pr.weight;
                    const pKey=ei+"-"+si;
                    const pOpen=plateFor===pKey;
                    const pData=pOpen?calcPlates(parseFloat(set.weight),set.unit):null;
                    return (
                      <div key={si} style={{position:"relative",marginBottom:8}}>
                        <div className="set-row" style={{display:"flex",gap:8,alignItems:"center"}}>
                          <button onClick={()=>toggleSetDone(ei,si)} aria-label={`${set.done?"Mark incomplete":"Complete"} set ${si+1}${set.done?"":" and start rest timer"}`} title={set.done?"Mark this set incomplete":"Mark this set done and start the rest timer"} style={{width:58,height:28,flexShrink:0,borderRadius:6,border:"1px solid "+(set.done?dayMeta.color:"#2A2A3A"),background:set.done?dayMeta.color:"#161723",color:set.done?"#fff":"#9CA3AF",fontSize:10,fontWeight:800,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>
                            {set.done?"✓ Done":`Set ${si+1}`}
                          </button>
                          <input type="number" inputMode="decimal" placeholder={trackingCopy.weight+(tracking===TRACKING_TYPES.WEIGHTED?"":" (optional)")} value={set.weight} onChange={e=>updateSet(ei,si,"weight",e.target.value)}
                            style={{flex:1,background:"#161723",border:"1px solid "+(isPR?"#FBBF24":"#1E2035"),borderRadius:8,padding:"8px 10px",color:"#ECEAF4",fontSize:13,fontFamily:"inherit",minWidth:0}}/>
                          <button onClick={()=>setPlateFor(pOpen?null:pKey)} disabled={!parseFloat(set.weight)} title="Plate calculator"
                            style={{background:pOpen?dayMeta.color:"#161723",border:"1px solid "+(pOpen?dayMeta.color:"#1E2035"),borderRadius:8,padding:"8px 9px",color:pOpen?"#fff":(parseFloat(set.weight)?"#9CA3AF":"#3A3A45"),fontSize:13,cursor:parseFloat(set.weight)?"pointer":"default",fontFamily:"inherit",flexShrink:0}}>🏋</button>
                          <select value={set.unit} onChange={e=>updateSet(ei,si,"unit",e.target.value)}
                            style={{background:"#161723",border:"1px solid #1E2035",borderRadius:8,padding:"8px 6px",color:"#888",fontSize:12,fontFamily:"inherit",flexShrink:0}}>
                            <option value="lb">lb</option><option value="kg">kg</option>
                          </select>
                          <input type="number" inputMode="numeric" placeholder={trackingCopy.measure} value={set.reps} onChange={e=>updateSet(ei,si,"reps",e.target.value)}
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

            <div style={{background:"#0F1018",border:"1px solid #16172A",borderRadius:14,padding:"14px 16px",marginBottom:12}}>
              <div style={{fontSize:12,color:"#666",fontWeight:800,marginBottom:10}}>CUSTOMIZE WORKOUT</div>
              {customExercises.length>0&&<div style={{display:"flex",gap:7,marginBottom:10}}>
                <select value={customExerciseId} onChange={e=>setCustomExerciseId(e.target.value)} style={{flex:1,minWidth:0,background:"#161723",border:"1px solid #1E2035",borderRadius:8,padding:"8px 9px",color:"#ECEAF4",fontSize:12,fontFamily:"inherit"}}><option value="">Add a saved exercise…</option>{customExercises.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
                <button onClick={addSavedCustomExercise} disabled={!customExerciseId} style={{background:customExerciseId?"#3B82F6":"#1E2035",border:"none",borderRadius:8,padding:"8px 13px",color:customExerciseId?"#fff":"#555",fontSize:11,fontWeight:700,cursor:customExerciseId?"pointer":"default",fontFamily:"inherit"}}>Add</button>
              </div>}
              <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.5fr) minmax(95px,0.8fr) auto",gap:7,marginBottom:12}}>
                <input value={newExerciseName} onChange={e=>setNewExerciseName(e.target.value)} placeholder="New exercise name" style={{minWidth:0,background:"#161723",border:"1px solid #1E2035",borderRadius:8,padding:"8px 9px",color:"#ECEAF4",fontSize:12,fontFamily:"inherit"}} />
                <input value={newExerciseTarget} onChange={e=>setNewExerciseTarget(e.target.value)} placeholder="3 x 8-12" style={{minWidth:0,background:"#161723",border:"1px solid #1E2035",borderRadius:8,padding:"8px 9px",color:"#ECEAF4",fontSize:12,fontFamily:"inherit"}} />
                <button onClick={createAndAddExercise} style={{background:"#1E2035",border:"1px solid #2A2A3A",borderRadius:8,padding:"8px 11px",color:"#9CA3AF",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Create + add</button>
              </div>
              <div style={{borderTop:"1px solid #1A1A28",paddingTop:11}}>
                <div style={{display:"flex",gap:7,marginBottom:workoutTemplates.length?9:0}}><input value={templateName} onChange={e=>setTemplateName(e.target.value)} placeholder="Template name (e.g. Quick Push)" style={{flex:1,minWidth:0,background:"#161723",border:"1px solid #1E2035",borderRadius:8,padding:"8px 9px",color:"#ECEAF4",fontSize:12,fontFamily:"inherit"}} /><button onClick={storeWorkoutTemplate} style={{background:"#1E2035",border:"1px solid #2A2A3A",borderRadius:8,padding:"8px 11px",color:"#9CA3AF",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Save current template</button></div>
                {workoutTemplates.map(template=><div key={template.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"7px 0",borderTop:"1px solid #16172A"}}><div><div style={{fontSize:11,fontWeight:700}}>{template.name}</div><div style={{fontSize:9,color:"#555"}}>{template.exercises.length} exercise{template.exercises.length!==1?"s":""}</div></div>{pendingTemplate?.id===template.id?<div style={{display:"flex",gap:5,alignItems:"center"}}><span style={{fontSize:9,color:"#FBBF24"}}>Replace current draft?</span><button onClick={()=>applySavedWorkoutTemplate(template)} style={{background:"#3B82F6",border:"none",borderRadius:6,padding:"4px 8px",color:"#fff",fontSize:9,fontWeight:700,cursor:"pointer"}}>Apply</button><button onClick={()=>setPendingTemplate(null)} style={{background:"#1E2035",border:"none",borderRadius:6,padding:"4px 8px",color:"#777",fontSize:9,cursor:"pointer"}}>Cancel</button></div>:<button onClick={()=>draftHasContent(draft)?setPendingTemplate(template):applySavedWorkoutTemplate(template)} style={{background:"none",border:"1px solid #2A2A3A",borderRadius:6,padding:"4px 9px",color:"#777",fontSize:9,fontWeight:700,cursor:"pointer"}}>Use template</button>}</div>)}
              </div>
              {workoutToolsMsg&&<div style={{fontSize:10,color:workoutToolsMsg.includes("exists")||workoutToolsMsg.startsWith("Enter")?"#F87171":"#4ADE80",marginTop:8}}>{workoutToolsMsg}</div>}
            </div>

            <div style={{background:"#0F1018",border:"1px solid #16172A",borderRadius:14,padding:"14px 16px",marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}><div><div style={{fontSize:12,color:"#9CA3AF",fontWeight:800}}>READINESS CHECK-IN</div><div style={{fontSize:9,color:"#555"}}>Optional · saved with this workout</div></div><div style={{fontSize:16,fontWeight:900,color:readinessScore(readiness)>=70?"#22C55E":readinessScore(readiness)>=50?"#F59E0B":"#F87171"}}>{readinessScore(readiness)}%</div></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:7}}>{[["energy","Energy"],["sleep","Sleep"],["soreness","Soreness"]].map(([key,label])=><label key={key} style={{fontSize:9,color:"#666"}}>{label}<select value={readiness[key]} onChange={event=>setReadiness(value=>({...value,[key]:Number(event.target.value)}))} style={{display:"block",width:"100%",marginTop:3,background:"#161723",border:"1px solid #2A2A3A",borderRadius:6,padding:"5px",color:"#9CA3AF",fontSize:10}}>{[1,2,3,4,5].map(value=><option key={value} value={value}>{value}/5</option>)}</select></label>)}</div>
              <label style={{display:"flex",gap:7,alignItems:"center",fontSize:10,color:readiness.pain?"#F87171":"#666",marginTop:9}}><input type="checkbox" checked={readiness.pain} onChange={event=>setReadiness(value=>({...value,pain:event.target.checked}))}/> Pain or unusual discomfort today</label>
            </div>

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
                            {ex.sets.map((s,j)=>{const type=trackingForExercise(ex);return <span key={j} style={{background:"#161723",borderRadius:6,padding:"3px 10px",fontSize:11,color:"#9CA3AF"}}>{s.weight?`${s.weight}${s.unit} × `:""}{s.reps||"0"}{type===TRACKING_TYPES.TIMED?" sec":type===TRACKING_TYPES.DISTANCE?" m":" reps"}</span>;})}
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
                  <Suspense fallback={<div style={{padding:24,textAlign:"center",color:"#666",fontSize:12}}>Loading training analytics…</div>}><ProgressDashboard sessions={sessions} preferences={equipmentPrefs} onSavePreferences={saveAccountPrefs} onAddExercise={addDashboardExercise}/></Suspense>
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

        {/* ── SETTINGS TAB ── */}
        {activeTab==="settings"&&(
          <div>
            <div style={{fontSize:18,fontWeight:900,marginBottom:4}}>Settings</div>
            <div style={{fontSize:12,color:"#666",marginBottom:16}}>Preferences are saved for {firebaseUser?"your Google account":"guest mode on this device"}.</div>
            <div style={{background:"#0F1018",border:"1px solid #16172A",borderRadius:14,padding:"16px",marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:800,marginBottom:5}}>Progression increments</div>
              <div style={{fontSize:11,color:"#777",lineHeight:1.5,marginBottom:14}}>When you complete the top of an exercise's rep range, recommendations use these steps. Reductions use the same amount.</div>
              {[["lb","Pounds",[2.5,5,10]],["kg","Kilograms",[1,2.5,5]]].map(([unit,label,options])=>(
                <div key={unit} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"10px 0",borderTop:"1px solid #16172A"}}>
                  <div><div style={{fontSize:12,fontWeight:700}}>{label}</div><div style={{fontSize:10,color:"#555"}}>Current step: {progressionIncrements[unit]} {unit}</div></div>
                  <div style={{display:"flex",gap:5}}>
                    {options.map(value=><button key={value} onClick={()=>updateProgressionIncrement(unit,value)} style={{background:progressionIncrements[unit]===value?"#3B82F6":"#161723",border:"1px solid "+(progressionIncrements[unit]===value?"#3B82F6":"#2A2A3A"),borderRadius:7,padding:"6px 10px",color:progressionIncrements[unit]===value?"#fff":"#888",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{value}</button>)}
                  </div>
                </div>
              ))}
            </div>
            <div style={{background:"#0F1018",border:"1px solid #16172A",borderRadius:14,padding:"16px",marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:800,marginBottom:5}}>Rest timer</div>
              <div style={{fontSize:11,color:"#777",lineHeight:1.5,marginBottom:14}}>The timer starts automatically whenever you check off a set. A supported phone will vibrate when rest is complete.</div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,paddingTop:10,borderTop:"1px solid #16172A"}}>
                <div><div style={{fontSize:12,fontWeight:700}}>Default duration</div><div style={{fontSize:10,color:"#555"}}>{restTimerDefault} seconds after each set</div></div>
                <div style={{display:"flex",gap:5}}>
                  {REST_TIMER_OPTIONS.map(value=><button key={value} onClick={()=>updateRestTimerDefault(value)} style={{background:restTimerDefault===value?"#3B82F6":"#161723",border:"1px solid "+(restTimerDefault===value?"#3B82F6":"#2A2A3A"),borderRadius:7,padding:"6px 10px",color:restTimerDefault===value?"#fff":"#888",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{value}s</button>)}
                </div>
              </div>
            </div>
            <div style={{background:"#0F1018",border:"1px solid #16172A",borderRadius:14,padding:"16px",marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:800,marginBottom:5}}>Strength goals</div>
              <div style={{fontSize:11,color:"#777",lineHeight:1.5,marginBottom:10}}>Set a target weight for any exercise. Progress updates from saved sessions.</div>
              <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 80px 60px auto",gap:6}}><select value={goalExercise} onChange={event=>setGoalExercise(event.target.value)} style={{minWidth:0,background:"#161723",border:"1px solid #2A2A3A",borderRadius:7,padding:"6px",color:"#9CA3AF",fontSize:10}}><option value="">Exercise…</option>{allExNames.map(name=><option key={name}>{name}</option>)}</select><input type="number" placeholder="Target" value={goalTarget} onChange={event=>setGoalTarget(event.target.value)} style={{minWidth:0,background:"#161723",border:"1px solid #2A2A3A",borderRadius:7,padding:"6px",color:"#E5E7EB",fontSize:10}}/><select value={goalUnit} onChange={event=>setGoalUnit(event.target.value)} style={{background:"#161723",border:"1px solid #2A2A3A",borderRadius:7,color:"#9CA3AF",fontSize:10}}><option>lb</option><option>kg</option></select><button onClick={createTrainingGoal} style={{background:"#3B82F6",border:"none",borderRadius:7,color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer"}}>Add</button></div>
              {goalMsg&&<div style={{fontSize:9,color:goalMsg==="Goal added."?"#4ADE80":"#F87171",marginTop:6}}>{goalMsg}</div>}
              <div style={{display:"flex",flexDirection:"column",gap:7,marginTop:trainingGoals.length?10:0}}>{trainingGoals.map(goal=>{const progress=goalProgress(goal,sessions);return <div key={goal.id} style={{borderTop:"1px solid #1A1A28",paddingTop:7}}><div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:4,gap:6}}><span style={{fontWeight:700,color:progress.complete?"#4ADE80":"#D4D4D8"}}>{progress.complete?"✓ ":""}{goal.exercise}</span><span style={{color:"#777",marginLeft:"auto"}}>{progress.best}/{goal.target} {goal.unit} · {progress.pct}%</span><button onClick={()=>saveAccountPrefs(removeGoal(equipmentPrefs,goal.id))} aria-label={`Remove ${goal.exercise} goal`} style={{background:"none",border:"none",color:"#666",cursor:"pointer",padding:0}}>×</button></div><div style={{height:5,background:"#161723",borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:progress.pct+"%",background:progress.complete?"#22C55E":"#3B82F6"}}/></div></div>;})}</div>
            </div>
          </div>
        )}

      </main>

      <NavBar items={NAV_ITEMS} active={activeTab} onChange={switchTab} />

      {/* Rest timer */}
      {(restRunning||restComplete)&&(
        <div className="rest-dock" style={{position:"fixed",bottom:16,left:"50%",transform:"translateX(-50%)",background:"#13141F",border:"1px solid "+(restComplete?"#34D39970":dayMeta.color+"40"),borderRadius:14,padding:"10px 16px",display:"flex",alignItems:"center",gap:14,boxShadow:"0 6px 24px rgba(0,0,0,0.5)",zIndex:50}}>
          <div style={{fontSize:11,color:restComplete?"#34D399":"#888",fontWeight:700}}>{restComplete?"REST COMPLETE":"REST"}</div>
          <div style={{fontSize:22,fontWeight:900,color:restComplete?"#34D399":dayMeta.color,fontVariantNumeric:"tabular-nums",minWidth:56,textAlign:"center"}}>{fmtRest(Math.max(0,restTarget-restSeconds))}</div>
          <div style={{display:"flex",gap:4}}>
            {REST_TIMER_OPTIONS.map(t=><button key={t} onClick={()=>{setRestTarget(t);setRestSeconds(0);setRestComplete(false);setRestRunning(true);}} style={{background:restTarget===t&&!restComplete?dayMeta.color:"#1E2035",border:"none",borderRadius:6,padding:"4px 8px",color:restTarget===t&&!restComplete?"#fff":"#888",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{t}s</button>)}
            <button onClick={()=>addRestTime(30)} style={{background:"#1E2035",border:"none",borderRadius:6,padding:"4px 8px",color:"#9CA3AF",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+30s</button>
          </div>
          <button aria-label="Close rest timer" onClick={stopRestTimer} style={{background:"none",border:"none",color:"#888",fontSize:18,cursor:"pointer",fontFamily:"inherit",padding:"0 2px"}}><X size={18}/></button>
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
                      <div style={{fontSize:8.5,color:"#555",marginTop:6,textAlign:"center"}}>● primary ○ secondary</div>
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
