import { useState, useEffect, useRef } from "react";
import { todayISO, todaysDayKey } from "./dateUtils.js";
import { dayTemplates, variantFor, allVariantNames, exerciseForVariantName } from "./data/exercises.js";
import { emptySets, hasEnteredData, buildDraftExercise, isCompleteSet, newSession } from "./draft.js";
import { loadPrefs, savePrefs, setPref, prefFor } from "./equipmentPrefs.js";
import { buildBackup, validateBackup, mergeBackup, replaceBackup } from "./backup.js";
import { firebaseConfigured, observeAuth, signInWithGoogle, signOutFirebase, loadCloudData, saveCloudSession, deleteCloudSession, saveCloudBodyweight, deleteCloudBodyweight, saveCloudSettings, saveCloudSnapshot } from "./firebase.js";
import { reconcileCloudData } from "./cloudData.js";
import { clearDraft, draftHasContent, loadDraft, saveDraft } from "./draftStorage.js";
import { getProgressionIncrements, getProgressionRecommendation, setProgressionIncrement } from "./progression.js";
import { announceRestComplete, getRestTimerSeconds, setRestTimerSeconds } from "./restTimer.js";
import { trackingForExercise, trackingLabels, TRACKING_TYPES } from "./exerciseTracking.js";
import { createWorkoutSummary } from "./workoutSummary.js";
import { lastSameDaySummary, toLb } from "./stats.js";
import { addExerciseToDraft, applyWorkoutTemplate, createCustomExercise, createCustomExerciseFromLibrary, getCustomExercises, getWorkoutTemplates, saveWorkoutTemplate } from "./customWorkouts.js";
import { addGoal, getGoals, normalizeReadiness } from "./userFeatures.js";
import { profileLoadErrors, readLocalProfileResult, runLocalProfileLoad, sessionKey, weightKey } from "./localProfileData.js";
import { commitHistoryMutation, prepareHistoryUpdate } from "./historyRecords.js";
import { commitWeightMutation, createWeightCloudOperation, prepareWeightMutation } from "./weightRecords.js";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { BarChart3, Cloud, Download, Home, History, Scale, Settings, Upload, X } from "lucide-react";
import { AppBar, Button, NavBar, Toast } from "./components/index.js";
import SettingsScreen from "./screens/SettingsScreen.jsx";
import packageInfo from "../package.json";
import HomeScreen from "./screens/HomeScreen.jsx";
import ProgressScreen from "./screens/ProgressScreen.jsx";
import HistoryScreen from "./screens/HistoryScreen.jsx";
import WeightScreen from "./screens/WeightScreen.jsx";
import SessionScreen from "./screens/SessionScreen.jsx";

const NAV_ITEMS = [
  { id: "log",      label: "Home",     Icon: Home },
  { id: "history",  label: "History",  Icon: History },
  { id: "progress", label: "Progress", Icon: BarChart3 },
  { id: "weight",   label: "Weight",   Icon: Scale },
  { id: "settings", label: "Settings", Icon: Settings },
];

// ─── STORAGE ──────────────────────────────────────────────────────────────────
// The session/weigh-in key builders live in localProfileData.js so the forgiving
// reader below and the strict screen-owned reader can never drift apart.
const TAB_KEY         = "workout-active-tab";
const LEGACY_ACTIVE_KEY = "workout-active-profile";
const LEGACY_OWNER_KEY = "workout-legacy-claimed-by";
const REST_TIMER_PREFIX = "workout-rest-timer:";

const storage = {
  get(key)        { try { return window.localStorage.getItem(key); }      catch { return null; } },
  set(key, value) { try { window.localStorage.setItem(key, value); return true; } catch { return false; } },
  remove(key)     { try { window.localStorage.removeItem(key); return true; }    catch { return false; } },
};

// Forgiving reader: any problem reads as "nothing stored". Correct for auth
// reconciliation and import, where one bad blob must not block merging the rest.
// Screens that show their own loading state use readLocalProfileResult instead.
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

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState(() => { try { return storage.get(TAB_KEY)||"log"; } catch { return "log"; } });
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  // Per-collection read failures: { sessions, bodyweights }, or null when this
  // device's saved records read cleanly. History and Weight each surface only
  // their own collection's failure as a retryable error, so a failed read is
  // never mistaken for an empty log — and a corrupt weigh-in blob can never make
  // a perfectly readable workout history unreachable.
  const [localLoadError, setLocalLoadError] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [statusMsg, setStatusMsg] = useState(null);
  const [workoutSummary, setWorkoutSummary] = useState(null);
  const [toastPRs, setToastPRs] = useState(null);
  const [sameDayCompare, setSameDayCompare] = useState(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [confirmExitSession, setConfirmExitSession] = useState(false);
  const [activeExercise, setActiveExercise] = useState(0);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const sessionHistoryRef = useRef(false);

  // Internal storage namespace: Firebase UID when signed in, isolated guest
  // storage otherwise. This value is never used as the displayed username.
  const [activeProfile, setActiveProfile] = useState("guest");

  const [currentDay, setCurrentDay] = useState(() => todaysDayKey());
  const [draft, setDraft] = useState(() => newSession(todaysDayKey(), {}));
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [confirmDiscardDraft, setConfirmDiscardDraft] = useState(false);
  const draftNamespaceRef = useRef("guest");
  const [confirmReset, setConfirmReset] = useState(false);
  const [showCoach, setShowCoach] = useState(true);
  const [showWarmup, setShowWarmup] = useState(true);
  const [sessionSheet, setSessionSheet] = useState(null);

  const [restSeconds, setRestSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [restTarget, setRestTarget] = useState(90);
  const [restComplete, setRestComplete] = useState(false);

  const [bodyweights, setBodyweights] = useState([]);
  const [weightDisplayUnit, setWeightDisplayUnit] = useState("lb");

  const [guideExercise, setGuideExercise] = useState(null);
  const [guideImageIndex, setGuideImageIndex] = useState(0);
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
    const result = readLocalProfileResult({ storage, profile: "guest", loadPrefs });
    if (!cancelled) {
      // Whichever collection read cleanly is used as-is. A collection that could
      // not be read falls back to the long-standing forgiving reader, so the rest
      // of the app still starts, and its failure is recorded separately so only
      // the destination that owns it shows an error.
      const prefs = result.equipmentPrefs;
      setSessions(result.sessions.ok ? result.sessions.data : readStoredArray(sessionKey("guest")));
      setBodyweights(result.bodyweights.ok ? result.bodyweights.data : readStoredArray(weightKey("guest")));
      setEquipmentPrefs(prefs);
      restoreDraft("guest", prefs);
      setLocalLoadError(profileLoadErrors(result));
      setLoading(false);
    }
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

  // Retry for the destinations that own their own loading/error state. Only the
  // collections that read cleanly are applied, so retrying from History cannot
  // blank weigh-ins that are still unreadable, or the reverse. It deliberately
  // leaves the workout draft alone: this re-reads saved records, so it must not
  // roll back anything the user is typing on the Log tab.
  function retryLocalProfileLoad() {
    runLocalProfileLoad({
      readResult: () => readLocalProfileResult({ storage, profile:activeProfile, loadPrefs }),
      setLoading,
      setError: setLocalLoadError,
      applyData: data => {
        if (data.sessions) setSessions(data.sessions);
        if (data.bodyweights) setBodyweights(data.bodyweights);
        if (data.equipmentPrefs) setEquipmentPrefs(data.equipmentPrefs);
      },
    });
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

  function switchDay(k) { setCurrentDay(k); setDraft(newSession(k, equipmentPrefs)); setDraftSavedAt(null); setConfirmDiscardDraft(false); setConfirmSwitch(null); }

  function discardDraft() {
    clearDraft(storage, activeProfile);
    const fresh = newSession(currentDay, equipmentPrefs);
    draftNamespaceRef.current = activeProfile;
    setDraft(fresh); setDraftSavedAt(null); setConfirmDiscardDraft(false); setConfirmSwitch(null); setPlateFor(null);
    leaveSession();
  }

  function startSession() {
    setDraft(previous => ({ ...previous, startedAt: previous.startedAt || new Date().toISOString() }));
    if (!sessionHistoryRef.current) {
      window.history.pushState({ workoutSession: true }, "");
      sessionHistoryRef.current = true;
    }
    setSessionActive(true);
    setActiveExercise(0);
  }

  function leaveSession() {
    setSessionActive(false);
    setConfirmExitSession(false);
    if (sessionHistoryRef.current) {
      sessionHistoryRef.current = false;
      window.history.back();
    }
  }

  function requestSessionExit() {
    if (draftHasContent(draft)) setConfirmExitSession(true);
    else leaveSession();
  }

  useEffect(() => {
    if (!sessionActive) return undefined;
    const handleBack = () => {
      if (!sessionHistoryRef.current) return;
      sessionHistoryRef.current = false;
      if (draftHasContent(draft)) setConfirmExitSession(true);
      else setSessionActive(false);
    };
    window.addEventListener("popstate", handleBack);
    return () => window.removeEventListener("popstate", handleBack);
  }, [sessionActive, draft]);

  useEffect(() => {
    if (!sessionActive) return undefined;
    const updateElapsed = () => {
      const started = new Date(draft.startedAt).getTime();
      setSessionElapsed(Number.isFinite(started) ? Math.max(0, Math.floor((Date.now() - started) / 1000)) : 0);
    };
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [sessionActive, draft.startedAt]);

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

  function saveProgressPreferences(updated) {
    if (!savePrefs(storage, activeProfile, updated)) return false;
    setEquipmentPrefs(updated);
    if (firebaseUser) runCloud(saveCloudSettings(firebaseUser.uid, updated, accountMetadata()));
    return true;
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

  function addLibraryExercise(libraryEntry) {
    const result = createCustomExerciseFromLibrary(equipmentPrefs, libraryEntry);
    if (!result.ok) { setWorkoutToolsMsg(result.error); return; }
    saveAccountPrefs(result.prefs);
    setDraft(prev=>addExerciseToDraft(prev,result.exercise));
    setWorkoutToolsMsg(`Added ${result.exercise.name}.`);
  }

  function openGuide(name) {
    setGuideExercise(name);
    setGuideImageIndex(0);
  }

  function toggleGuideImage() {
    setGuideImageIndex(index => (index + 1) % 2);
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
    setActiveExercise(current => current > index ? current - 1 : Math.min(current, draft.exercises.length - 2));
  }

  function moveDraftExercise(index, direction) {
    setDraft(prev=>{
      const target=index+direction;
      if (target<0||target>=prev.exercises.length) return prev;
      const exercises=[...prev.exercises];
      [exercises[index],exercises[target]]=[exercises[target],exercises[index]];
      return {...prev,exercises};
    });
    setActiveExercise(current => current === index ? index + direction : current === index + direction ? index : current);
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
    const summary = createWorkoutSummary(saved, sessions, completedAt);
    setWorkoutSummary(summary);
    setToastPRs(summary.prs.length > 0 ? summary.prs : null);
    const priorSameDay = lastSameDaySummary(sessions, saved.day, saved.date);
    if (priorSameDay) {
      const currentTopSets = saved.exercises.map(exercise => {
        let best = null;
        for (const set of exercise.sets) {
          const weightLb = toLb(set.weight, set.unit);
          if (weightLb <= 0) continue;
          if (!best || weightLb > best.weightLb) best = { weightLb, weight: Number(set.weight), unit: set.unit === "kg" ? "kg" : "lb" };
        }
        return best ? { name: exercise.name, weight: best.weight, unit: best.unit, weightLb: best.weightLb } : null;
      }).filter(Boolean);
      setSameDayCompare({ priorSameDay, volumeLb: summary.volumeLb, currentTopSets });
    } else {
      setSameDayCompare(null);
    }
    const updated = [...sessions, saved].sort((a,b)=>a.date.localeCompare(b.date));
    setSessions(updated); persist(updated, firebaseUser ? ()=>saveCloudSession(firebaseUser.uid, saved) : null);
    clearDraft(storage, activeProfile);
    setDraft(newSession(currentDay, equipmentPrefs)); setDraftSavedAt(null); setConfirmDiscardDraft(false); setConfirmSwitch(null); setRestRunning(false); setRestComplete(false); setRestSeconds(0);
    leaveSession();
  }

  // History mutations: App validates, prepares, and hands the ordering to the
  // tested commitHistoryMutation seam — device first, then React state, then the
  // optional cloud mirror. Never a handwritten write/state sequence here.
  function saveHistoricalWorkout(draftWorkout) {
    const original = sessions.find(item => item?.id === draftWorkout?.id);
    if (!original) return { ok:false, error:"That workout is no longer available on this device." };
    const prepared = prepareHistoryUpdate(original, draftWorkout);
    if (!prepared.ok) return { ok:false, error:prepared.error, field:prepared.field };
    const updated = sessions
      .map(item => (item?.id === original.id ? prepared.session : item))
      .sort((a,b)=>String(a?.date).localeCompare(String(b?.date)));
    const committed = commitHistoryMutation({
      nextSessions: updated,
      writeLocal: writeSessions,
      applyState: setSessions,
      mirrorCloud: firebaseUser ? () => runCloud(() => saveCloudSession(firebaseUser.uid, prepared.session)) : null,
    });
    if (!committed.ok) {
      setSaveStatus("error"); setStatusMsg("Workout changes couldn’t be saved. Your original workout is unchanged.");
      setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},3000);
      return { ok:false, error:"Workout changes couldn’t be saved. Your original workout is unchanged. Try again." };
    }
    setSaveStatus("saved"); setStatusMsg("Workout updated ✓");
    setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},1500);
    return { ok:true };
  }

  function deleteHistoricalWorkout(id) {
    const target = sessions.find(item => item?.id === id);
    if (!target) return { ok:false, error:"That workout is no longer available on this device." };
    const committed = commitHistoryMutation({
      nextSessions: sessions.filter(item => item?.id !== id),
      writeLocal: writeSessions,
      applyState: setSessions,
      mirrorCloud: firebaseUser ? () => runCloud(() => deleteCloudSession(firebaseUser.uid, id)) : null,
    });
    if (!committed.ok) {
      setSaveStatus("error"); setStatusMsg("Could not delete that workout. It is still saved on this device.");
      setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},3000);
      return { ok:false, error:"This workout couldn’t be deleted. It’s still saved on this device. Try again." };
    }
    setSaveStatus("saved"); setStatusMsg("Workout deleted ✓");
    setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},1500);
    return { ok:true };
  }

  function resetAll() { setSessions([]); persist([]); pushSnapshot({sessions:[],bodyweights,equipmentPrefs}, true); setConfirmReset(false); }

  // Weight mutations: same two-stage seam as History — the device write is
  // synchronous and authoritative; the cloud mirror (including an old-date
  // delete when an edit moves dates) runs only after that write is confirmed,
  // through the existing runCloud status path.
  function saveWeighIn(draft) {
    const editingId = draft?.id || null;
    const prepared = prepareWeightMutation(bodyweights, draft, { editingId });
    if (!prepared.ok) return { ok:false, error:prepared.error, field:prepared.field };
    const committed = commitWeightMutation({
      nextWeights: prepared.nextWeights,
      writeLocal: writeWeights,
      applyState: setBodyweights,
    });
    if (!committed.ok) {
      setSaveStatus("error"); setStatusMsg("This weigh-in couldn’t be saved. Your previous entry is unchanged.");
      setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},3000);
      return { ok:false, error:"This weigh-in couldn’t be saved. Your previous entry is unchanged. Try again." };
    }
    if (firebaseUser) {
      runCloud(createWeightCloudOperation({
        deleteOld: prepared.cloud.kind === "move" ? () => deleteCloudBodyweight(firebaseUser.uid, prepared.cloud.oldDate) : null,
        saveNew: () => saveCloudBodyweight(firebaseUser.uid, prepared.entry),
      }));
    }
    setSaveStatus("saved"); setStatusMsg("Weigh-in saved ✓");
    setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},1500);
    return { ok:true };
  }

  function deleteWeighIn(id) {
    const target = bodyweights.find(item => item?.id === id);
    if (!target) return { ok:false, error:"That weigh-in is no longer available on this device." };
    const committed = commitWeightMutation({
      nextWeights: bodyweights.filter(item => item?.id !== id),
      writeLocal: writeWeights,
      applyState: setBodyweights,
    });
    if (!committed.ok) {
      setSaveStatus("error"); setStatusMsg("Could not delete that weigh-in. It is still saved on this device.");
      setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},3000);
      return { ok:false, error:"This weigh-in couldn’t be deleted. It’s still saved on this device. Try again." };
    }
    if (firebaseUser) runCloud(createWeightCloudOperation({ deleteOld: () => deleteCloudBodyweight(firebaseUser.uid, target.date) }));
    setSaveStatus("saved"); setStatusMsg("Weigh-in deleted ✓");
    setTimeout(()=>{setSaveStatus("idle");setStatusMsg(null);},1500);
    return { ok:true };
  }

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
    // persist()/commitWeightMutation()/savePrefs()), attempt every write FIRST,
    // and only update state once all three have actually landed.
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

  const customExercises = getCustomExercises(equipmentPrefs);
  const workoutTemplates = getWorkoutTemplates(equipmentPrefs);
  const trainingGoals = getGoals(equipmentPrefs);
  const allExNames = Array.from(new Set([...allVariantNames(),...customExercises.map(item=>item.name),...sessions.flatMap(session=>session.exercises.map(ex=>ex.name))])).sort();
  const dayMeta = dayTemplates[currentDay];
  const draftFilled = draft.exercises.reduce((n,ex)=>n+ex.sets.filter(set=>isCompleteSet(set,trackingForExercise(ex))).length,0);
  const progressionIncrements = getProgressionIncrements(equipmentPrefs);
  const restTimerDefault = getRestTimerSeconds(equipmentPrefs);

  // History and Weight render their own loading and load-error states, so they
  // are the only destinations allowed past this blocking hydration return.
  // Progress keeps the root loading behaviour it already had.
  const screenOwnsLoadingState = ["history", "weight"].includes(activeTab);

  if (loading && !screenOwnsLoadingState) return (
    <div className="app-loading">
      Loading your training log...
    </div>
  );

  return (
    <div className="app-shell">
      <AppBar
        overline={sessionActive ? `Workout · ${fmtRest(sessionElapsed)}` : new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
        title={sessionActive ? dayMeta.label : <>Pocket Gym Log <sup>v{packageInfo.version}</sup></>}
        actions={sessionActive
          ? <Button variant="text" onClick={requestSessionExit} aria-label="Exit workout"><X size={20} /></Button>
          : <>
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
            <input ref={importInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} className="hidden-file-input"/>
          </>}
      />

      <main className="app-content">

        <Toast open={!!toastPRs} onClose={() => setToastPRs(null)}>
          {toastPRs && `🏆 New PR${toastPRs.length !== 1 ? "s" : ""}: ${toastPRs.map(pr => `${pr.name} ${pr.weight}${pr.unit} × ${pr.reps}`).join(" · ")}`}
        </Toast>

        {/* Status banners */}
        {saveStatus==="saving"&&<div className="status-banner status-banner--info">Saving...</div>}
        {saveStatus==="saved"&&<div className="status-banner status-banner--success">{statusMsg||"Saved ✓"}</div>}
        {saveStatus==="error"&&<div className="status-banner status-banner--error">{statusMsg||"Something went wrong."}</div>}

        {workoutSummary&&(
          <div className="workout-summary">
            <div className="workout-summary__head">
              <div><div className="workout-summary__title">✓ Workout complete</div><div className="workout-summary__meta">{workoutSummary.date} · {dayTemplates[workoutSummary.day]?.label || workoutSummary.day || "Workout"}</div></div>
              <button onClick={()=>setWorkoutSummary(null)} aria-label="Dismiss workout summary" className="workout-summary__close">×</button>
            </div>
            <div className={`workout-summary__stats${workoutSummary.prs.length||workoutSummary.improvements.length||workoutSummary.notes?" workout-summary__stats--tight":""}`}>
              {[[workoutSummary.durationMinutes?workoutSummary.durationMinutes+"m":"—","Duration"],[workoutSummary.exercises,"Exercises"],[workoutSummary.sets,"Sets"],[workoutSummary.volumeLb.toLocaleString(),"Volume (lb)"]].map(([value,label])=><div key={label} className="workout-summary__stat"><div className="workout-summary__stat-value">{value}</div><div className="workout-summary__stat-label">{label}</div></div>)}
            </div>
            {workoutSummary.prs.length>0&&<div className="workout-summary__prs">🏆 New PR{workoutSummary.prs.length!==1?"s":""}: {workoutSummary.prs.map(pr=>`${pr.name} ${pr.weight}${pr.unit} × ${pr.reps}`).join(" · ")}</div>}
            {workoutSummary.improvements.length>0&&<div className="workout-summary__improvements">↗ Heavier than last time: {workoutSummary.improvements.map(item=>`${item.name} +${item.increaseLb} lb`).join(" · ")}</div>}
            {sameDayCompare && (() => {
              const { priorSameDay, volumeLb, currentTopSets } = sameDayCompare;
              const volumeDeltaPct = priorSameDay.volume > 0 ? Math.round(((volumeLb - priorSameDay.volume) / priorSameDay.volume) * 100) : null;
              const priorByName = new Map(priorSameDay.exercises.map(ex => [ex.name, ex]));
              const exerciseDeltas = currentTopSets
                .filter(current => priorByName.has(current.name))
                .map(current => {
                  const prior = priorByName.get(current.name);
                  const priorLb = toLb(String(prior.weight), prior.unit);
                  const deltaLb = Math.round((current.weightLb - priorLb) * 10) / 10;
                  return { name: current.name, deltaLb };
                })
                .filter(item => Math.abs(item.deltaLb) >= 0.1);
              return (
                <div className="workout-summary__sameday">
                  vs last {dayTemplates[workoutSummary.day]?.label || workoutSummary.day} day ({priorSameDay.date}):{" "}
                  {volumeDeltaPct === null ? "no prior volume to compare" : `volume ${volumeDeltaPct >= 0 ? "up" : "down"} ${Math.abs(volumeDeltaPct)}%`}
                  {exerciseDeltas.length > 0 && " · " + exerciseDeltas.map(item => `${item.name} ${item.deltaLb >= 0 ? "+" : ""}${item.deltaLb}lb`).join(" · ")}
                </div>
              );
            })()}
            {workoutSummary.notes&&<div className="workout-summary__notes">“{workoutSummary.notes}”</div>}
          </div>
        )}

        {/* ── IMPORT CONFIRMATION ── */}
        {pendingImport&&(
          <div className="import-confirm">
            <div className="import-confirm__title">Import workout data</div>
            <div className="import-confirm__body">
              File contains <b>{pendingImport.sessions.length}</b> session{pendingImport.sessions.length!==1?"s":""} and <b>{pendingImport.bodyweights.length}</b> weigh-in{pendingImport.bodyweights.length!==1?"s":""}, exported from profile <b>{pendingImport.profile||"unknown"}</b>.
              {(pendingImport.skipped.sessions>0||pendingImport.skipped.bodyweights>0)&&(
                <div className="import-confirm__skipped">Skipped {pendingImport.skipped.sessions} malformed session{pendingImport.skipped.sessions!==1?"s":""} and {pendingImport.skipped.bodyweights} malformed weigh-in{pendingImport.skipped.bodyweights!==1?"s":""}.</div>
              )}
              {pendingOverwrite>0&&(
                <div className="import-confirm__merge-note">Merging will update {pendingOverwrite} weigh-in{pendingOverwrite!==1?"s":""} you already logged for those dates with the imported value.</div>
              )}
            </div>
            <div className="import-confirm__account">
              This will apply to <b>{firebaseUser?.displayName||firebaseUser?.email||"this device's guest log"}</b>, regardless of which account the file was exported from.
            </div>
            <div className="import-confirm__actions">
              <Button variant="filled" onClick={confirmImportMerge}>Merge (recommended)</Button>
              <Button variant="danger" onClick={confirmImportReplace}>Replace — deletes {sessions.length} existing session{sessions.length!==1?"s":""}</Button>
              <Button variant="tonal" onClick={()=>setPendingImport(null)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* ── HOME TAB ── */}
        {activeTab === "log" && !sessionActive && (
          <HomeScreen
            sessions={sessions}
            dayMeta={dayMeta}
            currentDay={currentDay}
            displayName={firebaseUser?.displayName}
            hasDraft={draftHasContent(draft)}
            draftSavedAt={draftSavedAt}
            onStart={startSession}
            onProgress={() => switchTab("progress")}
          />
        )}

        {/* ── ACTIVE SESSION ── */}
        {activeTab==="log" && sessionActive && (
          <SessionScreen
            draft={draft} setDraft={setDraft} dayMeta={dayMeta} currentDay={currentDay} switchDay={switchDay}
            sessions={sessions}
            confirmExitSession={confirmExitSession} setConfirmExitSession={setConfirmExitSession} leaveSession={leaveSession} sessionHistoryRef={sessionHistoryRef}
            draftSavedAt={draftSavedAt} confirmDiscardDraft={confirmDiscardDraft} setConfirmDiscardDraft={setConfirmDiscardDraft} discardDraft={discardDraft}
            showCoach={showCoach} setShowCoach={setShowCoach} showWarmup={showWarmup} setShowWarmup={setShowWarmup}
            sessionSheet={sessionSheet} setSessionSheet={setSessionSheet}
            restRunning={restRunning} restSeconds={restSeconds} restTarget={restTarget} setRestTarget={setRestTarget} setRestSeconds={setRestSeconds} restComplete={restComplete} setRestComplete={setRestComplete} setRestRunning={setRestRunning}
            startRestTimer={startRestTimer} stopRestTimer={stopRestTimer} addRestTime={addRestTime} updateRestTimerDefault={updateRestTimerDefault}
            activeExercise={activeExercise} setActiveExercise={setActiveExercise} draftFilled={draftFilled}
            prMap={prMap} getLastTime={getLastTime} copyLastTime={copyLastTime} progressionIncrements={progressionIncrements}
            moveDraftExercise={moveDraftExercise} removeDraftExercise={removeDraftExercise}
            confirmSwitch={confirmSwitch} setConfirmSwitch={setConfirmSwitch} requestEquipmentSwitch={requestEquipmentSwitch} applyEquipmentSwitch={applyEquipmentSwitch}
            toggleSetDone={toggleSetDone} updateSet={updateSet} removeSet={removeSet} addSet={addSet}
            plateFor={plateFor} setPlateFor={setPlateFor}
            guideExercise={guideExercise} setGuideExercise={setGuideExercise} guideImageIndex={guideImageIndex} toggleGuideImage={toggleGuideImage} openGuide={openGuide}
            customExercises={customExercises} customExerciseId={customExerciseId} setCustomExerciseId={setCustomExerciseId} addSavedCustomExercise={addSavedCustomExercise} addLibraryExercise={addLibraryExercise}
            newExerciseName={newExerciseName} setNewExerciseName={setNewExerciseName} newExerciseTarget={newExerciseTarget} setNewExerciseTarget={setNewExerciseTarget} createAndAddExercise={createAndAddExercise}
            templateName={templateName} setTemplateName={setTemplateName} storeWorkoutTemplate={storeWorkoutTemplate} workoutTemplates={workoutTemplates} pendingTemplate={pendingTemplate} setPendingTemplate={setPendingTemplate} applySavedWorkoutTemplate={applySavedWorkoutTemplate}
            workoutToolsMsg={workoutToolsMsg}
            readiness={readiness} setReadiness={setReadiness}
            saveSession={saveSession} draftHasContent={draftHasContent} getProgressionRecommendation={getProgressionRecommendation}
          />
        )}
        {/* ── History destination ── */}
        {activeTab==="history" && (
          <HistoryScreen
            sessions={sessions}
            loading={loading}
            loadError={localLoadError?.sessions || null}
            onRetryLoad={retryLocalProfileLoad}
            onStartWorkout={() => { switchTab("log"); startSession(); }}
            onSaveWorkout={saveHistoricalWorkout}
            onDeleteWorkout={deleteHistoricalWorkout}
          />
        )}

        {/* ── PROGRESS TAB ── */}
        {activeTab==="progress" && (
          <ProgressScreen sessions={sessions} preferences={equipmentPrefs} onSavePreferences={saveProgressPreferences} onAddExercise={addDashboardExercise} onGoHome={() => switchTab("log")} loading={loading}/>
        )}

        {/* ── Weight destination ── */}
        {activeTab==="weight" && (
          <WeightScreen
            bodyweights={bodyweights}
            displayUnit={weightDisplayUnit}
            onChangeDisplayUnit={setWeightDisplayUnit}
            loading={loading}
            loadError={localLoadError?.bodyweights || null}
            onRetryLoad={retryLocalProfileLoad}
            onSaveWeighIn={saveWeighIn}
            onDeleteWeighIn={deleteWeighIn}
          />
        )}

        {/* ── SETTINGS TAB ── */}
        {activeTab === "settings" && (
          <SettingsScreen
            firebaseUser={firebaseUser}
            version={packageInfo.version}
            progressionIncrements={progressionIncrements}
            updateProgressionIncrement={updateProgressionIncrement}
            restTimerDefault={restTimerDefault}
            updateRestTimerDefault={updateRestTimerDefault}
            allExNames={allExNames}
            goalExercise={goalExercise}
            setGoalExercise={setGoalExercise}
            goalTarget={goalTarget}
            setGoalTarget={setGoalTarget}
            goalUnit={goalUnit}
            setGoalUnit={setGoalUnit}
            goalMsg={goalMsg}
            createTrainingGoal={createTrainingGoal}
            trainingGoals={trainingGoals}
            sessions={sessions}
            equipmentPrefs={equipmentPrefs}
            saveAccountPrefs={saveAccountPrefs}
            confirmReset={confirmReset}
            setConfirmReset={setConfirmReset}
            resetAll={resetAll}
          />
        )}

      </main>

      {!sessionActive && <NavBar items={NAV_ITEMS} active={activeTab} onChange={switchTab} />}

    </div>
  );
}
