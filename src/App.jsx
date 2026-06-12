import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

// ─── STORAGE ─────────────────────────────────────────────────────────────────
// PWA build: data is saved on-device via localStorage. Survives app restarts,
// works fully offline. Per-device (not synced) — use the Export button to back
// up or move data between devices.
//
// PROFILES: each username gets its own isolated log, stored under a namespaced
// key like "workout-sessions:priyesh". Profiles live only on THIS device — a
// username here is not linked to the same username on another phone. The list
// of profiles and the active one are themselves stored in localStorage.

const SESSION_PREFIX = "workout-sessions:";   // + username
const PROFILES_KEY = "workout-profiles";       // JSON array of usernames
const ACTIVE_KEY = "workout-active-profile";   // current username

function sessionKey(user) {
  return SESSION_PREFIX + user;
}

const storage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};

// Normalize a typed username into a safe, consistent handle
function cleanUsername(raw) {
  return String(raw || "").trim().slice(0, 24);
}

// ─── PLAN TEMPLATE (5-day split, with coaching detail + day-specific warm-ups) ─

const dayTemplates = {
  MON: {
    label: "Push", color: "#3B82F6", emoji: "🔺",
    focus: "Chest · Shoulders · Triceps · Serratus",
    coachNote: "Warm up with 2x15 Band Pull-Aparts before you touch a single weight. Protects the rotator cuff for long-term pressing.",
    warmup: {
      general: "3-5 min easy cardio (incline walk / rower) to raise core temp",
      drills: [
        { name: "Band Pull-Aparts", detail: "2 x 15 — wakes up rear delts & rotator cuff before pressing" },
        { name: "Arm Circles + Shoulder Dislocates", detail: "10 each way with a band or broomstick — opens the shoulders" },
        { name: "Scapular Push-ups", detail: "1 x 12 — primes serratus & shoulder blade control" },
        { name: "Empty-bar / light-DB press", detail: "1-2 ramp sets at ~40% before your first working set" },
      ],
    },
    exercises: [
      { name: "Barbell/DB Bench Press", target: "3 x 6-10", muscles: "Mid chest, front delts, triceps",
        tip: "Touch bar to lower chest. Drive feet into the floor.",
        alt: "Push-ups with feet elevated on a chair" },
      { name: "Incline DB Press", target: "3 x 10-12", muscles: "Upper chest, front delts",
        tip: "15-30 degree incline only. Full stretch at the bottom.",
        alt: "Pike push-ups or elevated push-ups on a box" },
      { name: "Overhead Press", target: "3 x 8-10", muscles: "Front + side delts, upper traps, triceps",
        tip: "Bar path straight up — don't press forward.",
        alt: "Seated DB press if balance is an issue" },
      { name: "Lateral Raises", target: "3 x 15-20", muscles: "Side delts (isolated)",
        tip: "Light weight. Lead with elbows, slight forward lean.",
        alt: "Resistance bands work perfectly" },
      { name: "Tricep Dips/Skull Crushers", target: "3 x 10-12", muscles: "All 3 tricep heads",
        tip: "Dips: stay upright for tricep focus.",
        alt: "Bench dips if no dip bars" },
    ],
    cardio: "10 min incline walk — Easy",
  },
  TUE: {
    label: "Pull", color: "#8B5CF6", emoji: "🔻",
    focus: "Back · Biceps · Rear Delts · Traps",
    coachNote: "Initiate every pull by depressing your shoulder blades — feel it in your back first, not your biceps.",
    warmup: {
      general: "3-5 min easy cardio (rower is ideal — it primes the whole pulling chain)",
      drills: [
        { name: "Band Pull-Aparts", detail: "2 x 15 — rear delts & mid traps" },
        { name: "Cat-Cow + T-Spine Rotations", detail: "8 each — mobilizes the thoracic spine for rowing" },
        { name: "Scapular Pull-ups / Dead Hangs", detail: "2 x 8 (or 20s hang) — activates lats before pulling" },
        { name: "Light band rows", detail: "1 x 15 — grooves the 'lead with the back' pattern" },
      ],
    },
    exercises: [
      { name: "Pull-ups/Lat Pulldown", target: "3 x 5-10", muscles: "Lats, teres major, biceps",
        tip: "Dead hang at bottom. Drive elbows to hips, not backward.",
        alt: "Band-assisted pull-ups, or inverted rows under a barbell" },
      { name: "Bent-Over Barbell Row", target: "3 x 8-10", muscles: "Rhomboids, mid traps, rear delts, lats",
        tip: "Hinge to 45 degrees. Pull to belly button, not chest.",
        alt: "Both DBs bent-over, or chest-supported incline DB row (lighter weight, joint-friendly)" },
      { name: "Single-Arm DB Row", target: "3 x 10-12 each", muscles: "Lats, mid back, rear delts",
        tip: "Drive elbow straight back toward hip. Full lat stretch at bottom.",
        alt: "Brace on your own thigh if no bench" },
      { name: "Face Pulls/Band Pull-Aparts", target: "3 x 15-20", muscles: "Rear delts, external rotators, mid traps",
        tip: "Pull to forehead, elbows flared high. Never skip — keeps shoulders healthy.",
        alt: "Band pull-aparts anywhere" },
      { name: "Bicep Curls", target: "3 x 10-12", muscles: "Biceps, brachialis",
        tip: "Strict form, no swinging. Slow on the way down.",
        alt: "Resistance bands, EZ bar, hammer curls" },
    ],
    cardio: "10 min light cycling or brisk walk — Easy",
  },
  WED: {
    label: "Legs", color: "#EC4899", emoji: "🦵",
    focus: "Quads · Hamstrings · Glutes · Calves · Adductors",
    coachNote: "Leg day creates the biggest hormonal response and burns the most calories for 24-48 hrs after. Never skip it.",
    warmup: {
      general: "5 min easy bike or incline walk — legs need a longer ramp than upper body",
      drills: [
        { name: "Leg Swings (front-back & side-side)", detail: "10 each leg, each direction — opens hips & hamstrings" },
        { name: "Bodyweight Squats", detail: "2 x 15 — grooves depth and knee tracking" },
        { name: "Walking Lunges + Glute Bridges", detail: "10 lunges / 15 bridges — fires glutes before they load" },
        { name: "Empty-bar / goblet ramp sets", detail: "2 light sets before your first working squat" },
      ],
    },
    exercises: [
      { name: "Back Squat/Goblet Squat", target: "4 x 6-10", muscles: "Quads, glutes, adductors, core",
        tip: "Depth matters. Knees track over toes. Brace core before every rep.",
        alt: "Goblet squat with one heavy dumbbell" },
      { name: "Romanian Deadlift", target: "3 x 10-12", muscles: "Hamstrings, glutes, erectors",
        tip: "Hinge, not squat. Push hips back until deep hamstring stretch.",
        alt: "Two dumbbells if no barbell" },
      { name: "Bulgarian Split Squat", target: "3 x 8-10 each", muscles: "Quads, glutes, adductors — fixes imbalances",
        tip: "Rear foot elevated. Lower slowly, front knee tracks over toes.",
        alt: "Hold one or two dumbbells" },
      { name: "Glute Bridge/Hip Thrust", target: "3 x 12-15", muscles: "Glutes (primary), hamstrings",
        tip: "Drive through heels. Squeeze 1 sec at top, posterior pelvic tilt.",
        alt: "Floor glute bridge bodyweight, or DB on hips for load" },
      { name: "Standing Calf Raises", target: "4 x 15-20", muscles: "Gastrocnemius (outer calf)",
        tip: "Full stretch at bottom, pause 1 sec at top.",
        alt: "Use a step for full range, hold dumbbells for load" },
    ],
    cardio: "10 min slow walk — active recovery",
  },
  THU: {
    label: "Core+HIIT", color: "#F59E0B", emoji: "🔥",
    focus: "Full Core · Obliques · Fat Burn",
    coachNote: "Core is everything from hips to shoulders. The HIIT after this is your most direct fat-burning tool.",
    warmup: {
      general: "3-4 min easy cardio + dynamic movement to get the heart rate climbing for HIIT",
      drills: [
        { name: "Cat-Cow + Bird Dogs", detail: "8 cat-cows, 8 bird dogs each side — wakes up the deep core" },
        { name: "Dead Bug (slow)", detail: "1 x 10 — connects breathing to bracing before loaded core work" },
        { name: "Hip Circles + Leg Swings", detail: "10 each — loosens hips for leg raises and HIIT" },
        { name: "2-3 short HIIT primers", detail: "20s at 70% effort before going all-out, so round 1 isn't a cold sprint" },
      ],
    },
    exercises: [
      { name: "Plank w/ Shoulder Taps", target: "3 x 30-45 sec", muscles: "Transverse abdominis, anti-rotation core",
        tip: "Keep hips perfectly still while tapping shoulders.",
        alt: "Standard plank if too hard initially" },
      { name: "Hanging Leg Raises", target: "3 x 10-12", muscles: "Lower rectus abdominis, hip flexors",
        tip: "No swinging. Tuck pelvis under at top — posterior tilt activates lower abs.",
        alt: "Lying straight leg raises on the floor" },
      { name: "Ab Wheel/Dead Bug", target: "3 x 8-10", muscles: "Full anterior core",
        tip: "Ab wheel: only as far as you can control. Dead bug: lower opposite arm/leg, press lower back into floor.",
        alt: "Dead bug needs zero equipment" },
      { name: "Cable/DB Woodchop", target: "3 x 12 each side", muscles: "Obliques, rotational core, serratus",
        tip: "Rotate through torso, not just arms.",
        alt: "Resistance band anchored to a door or post" },
      { name: "Weighted Sit-ups/Bicycle Crunches", target: "3 x 15-20", muscles: "Upper rectus abdominis, obliques",
        tip: "Bicycle crunches: rotate fully, slow down — highest rectus activation of any ab move.",
        alt: "Bodyweight, hold a plate on chest for sit-ups" },
    ],
    cardio: "15 min HIIT: 30s max effort / 30s rest x 15 rounds",
  },
  FRI: {
    label: "Full Body", color: "#EF4444", emoji: "⚡",
    focus: "Posterior Chain · Upper Back · Erectors · Calves",
    coachNote: "Targets what the week left undertrained — the entire posterior chain, upper traps, erectors, and a second calf stimulus.",
    warmup: {
      general: "5 min easy cardio — deadlift day demands a thorough ramp to protect the low back",
      drills: [
        { name: "Cat-Cow + Hip Hinges (bodyweight)", detail: "8 cat-cows, 10 hinges — grooves the hinge before loading it" },
        { name: "Glute Bridges + Bird Dogs", detail: "15 bridges, 8 bird dogs each side — fires glutes & braces the core" },
        { name: "Band Pull-Aparts", detail: "2 x 15 — preps upper back for rows and carries" },
        { name: "Deadlift ramp sets", detail: "3-4 progressively heavier sets to your working weight — never jump straight to heavy" },
      ],
    },
    exercises: [
      { name: "Conventional Deadlift", target: "3 x 5-6", muscles: "Erectors, glutes, hamstrings, traps, lats, core",
        tip: "Heavy day, lower reps. Hinge, brace, push the floor away. Bar drags against shins.",
        alt: "DB deadlift, or trap bar deadlift if available" },
      { name: "Back Extensions/Good Mornings", target: "3 x 12-15", muscles: "Erectors (lower back), glutes, hamstrings",
        tip: "Fills the #1 gap of the week — isolated erector work. Don't hyperextend at top.",
        alt: "Over a stability ball, or Superman holds on the floor" },
      { name: "Chest-Supported DB Row", target: "3 x 10-12", muscles: "Rhomboids, mid traps, rear delts, lats",
        tip: "Chest supported removes momentum. Squeeze shoulder blades, hold 1 sec.",
        alt: "Lie face down on incline bench, row both dumbbells" },
      { name: "Farmer's Carries", target: "3 x 25-30 meters", muscles: "Upper traps, grip, core, calves",
        tip: "Walk tall, shoulders packed down and back.",
        alt: "Any two heavy dumbbells or kettlebells" },
      { name: "Seated Calf Raises", target: "4 x 15-20", muscles: "Soleus (deep calf — different from Wed)",
        tip: "Deep stretch at bottom, 1 sec pause at top. Need both calf heads for full development.",
        alt: "Sit on a bench, dumbbell on knee, raise onto ball of foot" },
    ],
    cardio: "10-15 min incline walk — Easy",
  },
};

const dayOrder = ["MON", "TUE", "WED", "THU", "FRI"];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function emptySets() {
  return [{ weight: "", reps: "", unit: "lb", done: false }];
}

function newSession(dayKey) {
  const tmpl = dayTemplates[dayKey];
  return {
    id: "session_" + Date.now(),
    date: todayISO(),
    day: dayKey,
    notes: "",
    exercises: tmpl.exercises.map(ex => ({
      name: ex.name,
      sets: emptySets(),
    })),
  };
}

function downloadJSON(data, filename) {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    return false;
  }
}

function buildPRMap(sessions) {
  const map = {};
  sessions.forEach(s => {
    s.exercises.forEach(ex => {
      ex.sets.forEach(set => {
        const w = parseFloat(set.weight);
        const r = parseFloat(set.reps);
        if (isNaN(w)) return;
        const cur = map[ex.name];
        if (!cur || w > cur.weight || (w === cur.weight && (r || 0) > cur.reps)) {
          map[ex.name] = { weight: w, reps: r || 0, date: s.date };
        }
      });
    });
  });
  return map;
}

function fmtRestTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ":" + String(s).padStart(2, "0");
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState("log");
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [statusMsg, setStatusMsg] = useState(null);

  // ── Profiles ──
  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfile] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [confirmDeleteProfile, setConfirmDeleteProfile] = useState(false);

  const [currentDay, setCurrentDay] = useState("MON");
  const [draft, setDraft] = useState(() => newSession("MON"));
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [progressExercise, setProgressExercise] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showCoach, setShowCoach] = useState(true);
  const [showWarmup, setShowWarmup] = useState(true);

  const [restSeconds, setRestSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [restTarget, setRestTarget] = useState(90);

  // ── Bootstrap: load profile list + active profile, then that profile's sessions ──
  useEffect(() => {
    try {
      let list = [];
      const rawList = storage.get(PROFILES_KEY);
      if (rawList) {
        const parsed = JSON.parse(rawList);
        if (Array.isArray(parsed)) list = parsed;
      }

      // Migrate any pre-profiles data ("workout-sessions") into a "default" profile
      const legacy = storage.get("workout-sessions");
      if (legacy && list.length === 0) {
        storage.set(sessionKey("default"), legacy);
        storage.remove("workout-sessions");
        list = ["default"];
      }

      if (list.length === 0) list = ["default"];

      let active = storage.get(ACTIVE_KEY);
      if (!active || !list.includes(active)) active = list[0];

      setProfiles(list);
      setActiveProfile(active);
      storage.set(PROFILES_KEY, JSON.stringify(list));
      storage.set(ACTIVE_KEY, active);

      const rawSessions = storage.get(sessionKey(active));
      if (rawSessions) {
        const parsed = JSON.parse(rawSessions);
        setSessions(Array.isArray(parsed) ? parsed : []);
      }
    } catch (err) {
      setProfiles(["default"]);
      setActiveProfile("default");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load a profile's sessions when the active profile changes (after bootstrap) ──
  function loadProfileSessions(user) {
    try {
      const raw = storage.get(sessionKey(user));
      const parsed = raw ? JSON.parse(raw) : [];
      setSessions(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSessions([]);
    }
  }

  function switchProfile(user) {
    if (user === activeProfile) { setShowProfileMenu(false); return; }
    setActiveProfile(user);
    storage.set(ACTIVE_KEY, user);
    loadProfileSessions(user);
    // Reset transient UI tied to the old profile
    setDraft(newSession(currentDay));
    setExpandedHistory(null);
    setProgressExercise(null);
    setConfirmDelete(null);
    setConfirmReset(false);
    setRestRunning(false);
    setRestSeconds(0);
    setShowProfileMenu(false);
  }

  function createProfile() {
    const name = cleanUsername(newProfileName);
    if (!name) return;
    if (profiles.includes(name)) {
      // Already exists → just switch to it
      switchProfile(name);
      setNewProfileName("");
      return;
    }
    const updated = [...profiles, name];
    setProfiles(updated);
    storage.set(PROFILES_KEY, JSON.stringify(updated));
    storage.set(sessionKey(name), JSON.stringify([]));
    setNewProfileName("");
    switchProfile(name);
  }

  function deleteProfile(user) {
    // Remove this profile's data and entry; never allow zero profiles
    const remaining = profiles.filter(p => p !== user);
    storage.remove(sessionKey(user));
    let list = remaining.length > 0 ? remaining : ["default"];
    if (remaining.length === 0) storage.set(sessionKey("default"), JSON.stringify([]));
    setProfiles(list);
    storage.set(PROFILES_KEY, JSON.stringify(list));
    const nextActive = list[0];
    setActiveProfile(nextActive);
    storage.set(ACTIVE_KEY, nextActive);
    loadProfileSessions(nextActive);
    setConfirmDeleteProfile(false);
    setShowProfileMenu(false);
  }

  useEffect(() => {
    if (!restRunning) return;
    const t = setInterval(() => {
      setRestSeconds(s => {
        if (s + 1 >= restTarget) {
          setRestRunning(false);
          return restTarget;
        }
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [restRunning, restTarget]);

  function persist(updated) {
    if (!activeProfile) return;
    setSaveStatus("saving");
    const ok = storage.set(sessionKey(activeProfile), JSON.stringify(updated));
    if (ok) {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
    } else {
      setSaveStatus("error");
      setStatusMsg("Could not save. Your device storage may be full or restricted.");
    }
  }

  function switchDay(dayKey) {
    setCurrentDay(dayKey);
    setDraft(newSession(dayKey));
  }

  function updateSet(exIdx, setIdx, field, value) {
    setDraft(prev => {
      const exercises = prev.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        const sets = ex.sets.map((s, j) => j === setIdx ? { ...s, [field]: value } : s);
        return { ...ex, sets };
      });
      return { ...prev, exercises };
    });
  }

  function toggleSetDone(exIdx, setIdx) {
    let nowDone = false;
    setDraft(prev => {
      const exercises = prev.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        const sets = ex.sets.map((s, j) => {
          if (j !== setIdx) return s;
          nowDone = !s.done;
          return { ...s, done: !s.done };
        });
        return { ...ex, sets };
      });
      return { ...prev, exercises };
    });
    if (nowDone) {
      setRestSeconds(0);
      setRestRunning(true);
    }
  }

  function addSet(exIdx) {
    setDraft(prev => {
      const exercises = prev.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        const last = ex.sets[ex.sets.length - 1];
        const newEntry = last ? { weight: last.weight, reps: "", unit: last.unit, done: false } : emptySets()[0];
        return { ...ex, sets: [...ex.sets, newEntry] };
      });
      return { ...prev, exercises };
    });
  }

  function removeSet(exIdx, setIdx) {
    setDraft(prev => {
      const exercises = prev.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        if (ex.sets.length <= 1) return ex;
        return { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) };
      });
      return { ...prev, exercises };
    });
  }

  function setDate(dateStr) {
    setDraft(prev => ({ ...prev, date: dateStr }));
  }

  function setNotes(notes) {
    setDraft(prev => ({ ...prev, notes }));
  }

  function hasAnyData(session) {
    return session.exercises.some(ex =>
      ex.sets.some(s => String(s.weight).trim() !== "" || String(s.reps).trim() !== "")
    );
  }

  function cleanSession(session) {
    return {
      ...session,
      exercises: session.exercises.map(ex => ({
        ...ex,
        sets: ex.sets
          .filter(s => String(s.weight).trim() !== "" || String(s.reps).trim() !== "")
          .map(({ done, ...rest }) => rest),
      })).filter(ex => ex.sets.length > 0),
    };
  }

  function saveSession() {
    if (!hasAnyData(draft)) {
      setSaveStatus("error");
      setStatusMsg("Add at least one weight or rep value before saving.");
      setTimeout(() => { setSaveStatus("idle"); setStatusMsg(null); }, 2500);
      return;
    }
    const cleaned = cleanSession(draft);
    const updated = [...sessions, cleaned].sort((a, b) => a.date.localeCompare(b.date));
    setSessions(updated);
    persist(updated);
    setDraft(newSession(currentDay));
    setRestRunning(false);
    setRestSeconds(0);
  }

  function deleteSession(id) {
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    persist(updated);
    setConfirmDelete(null);
  }

  function resetAll() {
    setSessions([]);
    persist([]);
    setConfirmReset(false);
  }

  function exportData() {
    const exportObj = {
      exportedAt: new Date().toISOString(),
      profile: activeProfile,
      programName: "Smart 5-Day Split — 12 Week Coach-Level Plan",
      plan: dayTemplates,
      loggedSessions: sessions,
      summary: {
        totalSessions: sessions.length,
        firstSessionDate: sessions.length > 0 ? sessions[0].date : null,
        lastSessionDate: sessions.length > 0 ? sessions[sessions.length - 1].date : null,
      },
    };
    const ok = downloadJSON(exportObj, "workout-log-" + (activeProfile || "default") + "-" + todayISO() + ".json");
    if (ok) {
      setSaveStatus("saved");
      setStatusMsg("Export downloaded ✓");
      setTimeout(() => { setSaveStatus("idle"); setStatusMsg(null); }, 2000);
    } else {
      setSaveStatus("error");
      setStatusMsg("Export failed — try again or use a different browser.");
      setTimeout(() => { setSaveStatus("idle"); setStatusMsg(null); }, 3000);
    }
  }

  const allExerciseNames = Array.from(new Set(
    Object.values(dayTemplates).flatMap(t => t.exercises.map(e => e.name))
  )).sort();

  const prMap = buildPRMap(sessions);

  function getProgressData(exerciseName) {
    const points = [];
    sessions.forEach(s => {
      const ex = s.exercises.find(e => e.name === exerciseName);
      if (!ex || ex.sets.length === 0) return;
      const weights = ex.sets.map(set => parseFloat(set.weight)).filter(w => !isNaN(w));
      if (weights.length === 0) return;
      const maxWeight = Math.max(...weights);
      const totalVolume = ex.sets.reduce((sum, set) => {
        const w = parseFloat(set.weight) || 0;
        const r = parseFloat(set.reps) || 0;
        return sum + w * r;
      }, 0);
      points.push({ date: s.date, maxWeight, volume: totalVolume, sets: ex.sets.length });
    });
    return points;
  }

  function getBest1RM(exerciseName) {
    let best = 0;
    sessions.forEach(s => {
      const ex = s.exercises.find(e => e.name === exerciseName);
      if (!ex) return;
      ex.sets.forEach(set => {
        const w = parseFloat(set.weight);
        const r = parseFloat(set.reps);
        if (isNaN(w) || isNaN(r) || r === 0) return;
        const est = w * (1 + r / 30);
        if (est > best) best = est;
      });
    });
    return best > 0 ? Math.round(best) : null;
  }

  function getStreak() {
    if (sessions.length === 0) return 0;
    const dates = Array.from(new Set(sessions.map(s => s.date))).sort((a, b) => b.localeCompare(a));
    let streak = 0;
    let cursor = new Date(todayISO());
    const yesterday = new Date(cursor); yesterday.setDate(cursor.getDate() - 1);
    if (dates[0] !== todayISO() && dates[0] !== yesterday.toISOString().slice(0, 10)) return 0;
    cursor = new Date(dates[0]);
    for (const d of dates) {
      if (d === cursor.toISOString().slice(0, 10)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  const sortedSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const dayMeta = dayTemplates[currentDay];

  const draftTotalSets = draft.exercises.reduce((n, ex) => n + ex.sets.length, 0);
  const draftFilledSets = draft.exercises.reduce((n, ex) =>
    n + ex.sets.filter(s => String(s.weight).trim() !== "" && String(s.reps).trim() !== "").length, 0);

  if (loading) {
    return (
      <div style={{ background: "#08090E", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#666", fontFamily: "'DM Sans', sans-serif" }}>
        Loading your training log...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "#08090E", minHeight: "100vh", color: "#ECEAF4", paddingBottom: 80 }}>

      <div style={{ padding: "32px 20px 24px", background: "linear-gradient(160deg, #0F101A 0%, #08090E 70%)", borderBottom: "1px solid #16172A" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 100, padding: "4px 14px", marginBottom: 12, fontSize: 11, fontWeight: 700, color: "#60A5FA", letterSpacing: "0.12em" }}>
              TRAINING LOG
            </div>
            <h1 style={{ fontSize: "clamp(22px, 5vw, 32px)", fontWeight: 900, margin: "0 0 4px", letterSpacing: "-0.02em" }}>
              12-Week Tracker
            </h1>
            <p style={{ color: "#666", fontSize: 13, margin: 0 }}>
              {sessions.length} session{sessions.length !== 1 ? "s" : ""} logged · auto-saved
              {getStreak() > 1 ? "  ·  🔥 " + getStreak() + "-day streak" : ""}
            </p>
          </div>
          <button onClick={exportData} style={{ background: "#13141F", border: "1px solid #2A2A3A", borderRadius: 10, padding: "10px 14px", color: "#9CA3AF", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            ⬇ Export
          </button>
        </div>

        {/* Profile bar */}
        <div style={{ marginTop: 18, position: "relative" }}>
          <button
            onClick={() => { setShowProfileMenu(v => !v); setConfirmDeleteProfile(false); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#13141F", border: "1px solid #2A2A3A", borderRadius: 100, padding: "6px 8px 6px 6px", cursor: "pointer", fontFamily: "inherit" }}
          >
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", color: "#fff", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", textTransform: "uppercase" }}>
              {(activeProfile || "?").slice(0, 1)}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#ECEAF4", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {activeProfile}
            </span>
            <span style={{ fontSize: 10, color: "#666", paddingRight: 4 }}>{showProfileMenu ? "▲" : "▼"}</span>
          </button>

          {showProfileMenu && (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 60, background: "#0F1018", border: "1px solid #2A2A3A", borderRadius: 14, padding: 10, width: 280, boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}>
              <div style={{ fontSize: 10, color: "#666", fontWeight: 700, letterSpacing: "0.1em", padding: "4px 8px 8px" }}>SWITCH PROFILE</div>
              {profiles.map(p => (
                <button
                  key={p}
                  onClick={() => switchProfile(p)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: p === activeProfile ? "#161723" : "none", border: "none", borderRadius: 8, padding: "8px", cursor: "pointer", fontFamily: "inherit", marginBottom: 2 }}
                >
                  <span style={{ width: 24, height: 24, borderRadius: "50%", background: p === activeProfile ? "linear-gradient(135deg, #3B82F6, #8B5CF6)" : "#1E2035", color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", textTransform: "uppercase", flexShrink: 0 }}>
                    {p.slice(0, 1)}
                  </span>
                  <span style={{ fontSize: 13, color: p === activeProfile ? "#ECEAF4" : "#9CA3AF", fontWeight: p === activeProfile ? 700 : 500, flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p}</span>
                  {p === activeProfile && <span style={{ fontSize: 10, color: "#4ADE80" }}>● active</span>}
                </button>
              ))}

              <div style={{ borderTop: "1px solid #1A1A28", margin: "8px 0", paddingTop: 10 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    value={newProfileName}
                    onChange={e => setNewProfileName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") createProfile(); }}
                    placeholder="New username..."
                    maxLength={24}
                    style={{ flex: 1, background: "#161723", border: "1px solid #1E2035", borderRadius: 8, padding: "8px 10px", color: "#ECEAF4", fontSize: 13, fontFamily: "inherit", minWidth: 0 }}
                  />
                  <button
                    onClick={createProfile}
                    disabled={!cleanUsername(newProfileName)}
                    style={{ background: cleanUsername(newProfileName) ? "#3B82F6" : "#1E2035", border: "none", borderRadius: 8, padding: "8px 14px", color: cleanUsername(newProfileName) ? "#fff" : "#555", fontSize: 13, fontWeight: 700, cursor: cleanUsername(newProfileName) ? "pointer" : "default", fontFamily: "inherit", flexShrink: 0 }}
                  >
                    Add
                  </button>
                </div>
              </div>

              {profiles.length > 1 && (
                <div style={{ borderTop: "1px solid #1A1A28", marginTop: 8, paddingTop: 8 }}>
                  {confirmDeleteProfile ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px" }}>
                      <span style={{ fontSize: 11, color: "#888", flex: 1 }}>Delete "{activeProfile}" and its data?</span>
                      <button onClick={() => deleteProfile(activeProfile)} style={{ background: "#EF4444", border: "none", borderRadius: 6, padding: "4px 10px", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Yes</button>
                      <button onClick={() => setConfirmDeleteProfile(false)} style={{ background: "#1E2035", border: "none", borderRadius: 6, padding: "4px 10px", color: "#888", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteProfile(true)} style={{ background: "none", border: "none", color: "#5A5A66", fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: "4px 8px", textDecoration: "underline" }}>
                      Delete current profile
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid #16172A", maxWidth: 720, margin: "0 auto", overflowX: "auto" }}>
        {[["log", "Log Workout"], ["history", "History"], ["progress", "Progress"]].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ background: "none", border: "none", color: activeTab === id ? "#ECEAF4" : "#444", fontWeight: 700, fontSize: 13, padding: "14px 18px", cursor: "pointer", borderBottom: activeTab === id ? "2px solid #3B82F6" : "2px solid transparent", transition: "all 0.15s", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 0" }}>

        {saveStatus === "saving" && (
          <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, padding: "8px 14px", marginBottom: 14, fontSize: 12, color: "#60A5FA" }}>
            Saving...
          </div>
        )}
        {saveStatus === "saved" && (
          <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "8px 14px", marginBottom: 14, fontSize: 12, color: "#4ADE80" }}>
            {statusMsg || "Saved ✓"}
          </div>
        )}
        {saveStatus === "error" && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "8px 14px", marginBottom: 14, fontSize: 12, color: "#F87171" }}>
            {statusMsg || "Something went wrong."}
          </div>
        )}

        {activeTab === "log" && (
          <div>
            <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
              {dayOrder.map(key => {
                const t = dayTemplates[key];
                const active = currentDay === key;
                return (
                  <button key={key} onClick={() => switchDay(key)} style={{ flex: "0 0 auto", background: active ? t.color : "#13141F", color: active ? "#fff" : "#666", border: "1px solid " + (active ? t.color : "#1E2035"), borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "inherit", transition: "all 0.2s" }}>
                    <div style={{ fontSize: 9, opacity: 0.8, marginBottom: 1 }}>{key}</div>
                    {t.emoji} {t.label}
                  </button>
                );
              })}
            </div>

            <div style={{ background: "#0F1018", border: "1px solid " + dayMeta.color + "25", borderRadius: 12, padding: "12px 16px", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: dayMeta.color }}>{dayMeta.emoji} {dayMeta.label}</div>
                  <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>{dayMeta.focus}</div>
                </div>
                <button onClick={() => setShowCoach(v => !v)} style={{ background: "none", border: "1px solid #2A2A3A", borderRadius: 6, padding: "4px 10px", color: "#777", fontSize: 11, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                  {showCoach ? "Hide" : "Coach"}
                </button>
              </div>
              {showCoach && (
                <div style={{ marginTop: 10, fontSize: 12, color: "#9CA3AF", lineHeight: 1.5, borderTop: "1px solid #1A1A28", paddingTop: 10 }}>
                  <div>📋 {dayMeta.coachNote}</div>
                  <div style={{ marginTop: 6, color: "#666" }}>🏃 Cardio: {dayMeta.cardio}</div>
                </div>
              )}
            </div>

            <div style={{ background: "#0F1018", border: "1px solid #16172A", borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <label style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>Date</label>
              <input
                type="date"
                value={draft.date}
                onChange={e => setDate(e.target.value)}
                style={{ background: "#161723", border: "1px solid #1E2035", borderRadius: 8, padding: "6px 10px", color: "#ECEAF4", fontSize: 13, fontFamily: "inherit" }}
              />
            </div>

            {dayMeta.warmup && (
              <div style={{ background: "#0F1018", border: "1px solid " + dayMeta.color + "20", borderRadius: 14, padding: "14px 16px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15 }}>🤸</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: dayMeta.color }}>Warm-Up</div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: 1 }}>~5-8 min · do this before set 1</div>
                    </div>
                  </div>
                  <button onClick={() => setShowWarmup(v => !v)} style={{ background: "none", border: "1px solid #2A2A3A", borderRadius: 6, padding: "4px 10px", color: "#777", fontSize: 11, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                    {showWarmup ? "Hide" : "Show"}
                  </button>
                </div>
                {showWarmup && (
                  <div style={{ marginTop: 12, borderTop: "1px solid #1A1A28", paddingTop: 12 }}>
                    <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ flexShrink: 0 }}>🔥</span>
                      <span><b style={{ color: "#CFCDE0" }}>General:</b> {dayMeta.warmup.general}</span>
                    </div>
                    {dayMeta.warmup.drills.map((d, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, marginBottom: 9, alignItems: "flex-start" }}>
                        <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, background: dayMeta.color + "22", color: dayMeta.color, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>{i + 1}</span>
                        <div style={{ fontSize: 12, lineHeight: 1.45 }}>
                          <span style={{ fontWeight: 700, color: "#CFCDE0" }}>{d.name}</span>
                          <span style={{ color: "#777" }}> — {d.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {draft.exercises.map((ex, exIdx) => {
              const planEx = dayMeta.exercises[exIdx];
              const pr = prMap[ex.name];
              return (
                <div key={exIdx} style={{ background: "#0F1018", border: "1px solid " + dayMeta.color + "20", borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4, gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: dayMeta.color }}>{ex.name}</div>
                    <div style={{ fontSize: 10, color: "#444", background: "#161723", borderRadius: 6, padding: "2px 8px", flexShrink: 0 }}>Target: {planEx.target}</div>
                  </div>

                  {pr && (
                    <div style={{ fontSize: 10, color: "#FBBF24", marginBottom: 10, fontWeight: 600 }}>
                      🏆 Best: {pr.weight}{draft.exercises[exIdx].sets[0]?.unit || "lb"} × {pr.reps} ({pr.date})
                    </div>
                  )}

                  {ex.sets.map((set, setIdx) => {
                    const isPR = pr && parseFloat(set.weight) > pr.weight;
                    return (
                      <div key={setIdx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                        <button
                          onClick={() => toggleSetDone(exIdx, setIdx)}
                          title="Mark set done (starts rest timer)"
                          style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 6, border: "1px solid " + (set.done ? dayMeta.color : "#2A2A3A"), background: set.done ? dayMeta.color : "transparent", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                        >
                          {set.done ? "✓" : (setIdx + 1)}
                        </button>
                        <input
                          type="number"
                          inputMode="decimal"
                          placeholder="Weight"
                          value={set.weight}
                          onChange={e => updateSet(exIdx, setIdx, "weight", e.target.value)}
                          style={{ flex: 1, background: "#161723", border: "1px solid " + (isPR ? "#FBBF24" : "#1E2035"), borderRadius: 8, padding: "8px 10px", color: "#ECEAF4", fontSize: 13, fontFamily: "inherit", minWidth: 0 }}
                        />
                        <select
                          value={set.unit}
                          onChange={e => updateSet(exIdx, setIdx, "unit", e.target.value)}
                          style={{ background: "#161723", border: "1px solid #1E2035", borderRadius: 8, padding: "8px 6px", color: "#888", fontSize: 12, fontFamily: "inherit", flexShrink: 0 }}
                        >
                          <option value="lb">lb</option>
                          <option value="kg">kg</option>
                        </select>
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder="Reps"
                          value={set.reps}
                          onChange={e => updateSet(exIdx, setIdx, "reps", e.target.value)}
                          style={{ flex: 1, background: "#161723", border: "1px solid #1E2035", borderRadius: 8, padding: "8px 10px", color: "#ECEAF4", fontSize: 13, fontFamily: "inherit", minWidth: 0 }}
                        />
                        <button
                          onClick={() => removeSet(exIdx, setIdx)}
                          disabled={ex.sets.length <= 1}
                          style={{ background: "none", border: "none", color: ex.sets.length <= 1 ? "#2A2A35" : "#F87171", fontSize: 16, cursor: ex.sets.length <= 1 ? "default" : "pointer", flexShrink: 0, padding: "0 4px", fontFamily: "inherit" }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}

                  <button onClick={() => addSet(exIdx)} style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed #2A2A3A", borderRadius: 8, padding: "6px 12px", color: "#666", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", width: "100%", marginTop: 2 }}>
                    + Add Set
                  </button>

                  <div style={{ marginTop: 8, fontSize: 11, color: "#555", lineHeight: 1.5 }}>
                    💡 {planEx.tip}
                  </div>
                </div>
              );
            })}

            <div style={{ background: "#0F1018", border: "1px solid #16172A", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#666", fontWeight: 600, marginBottom: 8 }}>Session Notes (optional)</div>
              <textarea
                value={draft.notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="How did it feel? Energy levels, soreness, anything to remember..."
                rows={2}
                style={{ width: "100%", background: "#161723", border: "1px solid #1E2035", borderRadius: 8, padding: "8px 10px", color: "#ECEAF4", fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
              />
            </div>

            <button onClick={saveSession} style={{ width: "100%", background: dayMeta.color, border: "none", borderRadius: 12, padding: "14px", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 20px " + dayMeta.color + "30" }}>
              Save Session{draftFilledSets > 0 ? "  ·  " + draftFilledSets + " set" + (draftFilledSets !== 1 ? "s" : "") : ""}
            </button>
          </div>
        )}

        {activeTab === "history" && (
          <div>
            {sortedSessions.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#444", fontSize: 13 }}>
                No sessions logged yet. Go to "Log Workout" to add your first one.
              </div>
            )}

            {sortedSessions.map(session => {
              const meta = dayTemplates[session.day];
              const isExpanded = expandedHistory === session.id;
              const vol = session.exercises.reduce((sum, ex) =>
                sum + ex.sets.reduce((s, set) => s + (parseFloat(set.weight) || 0) * (parseFloat(set.reps) || 0), 0), 0);
              return (
                <div key={session.id} style={{ marginBottom: 10 }}>
                  <div onClick={() => setExpandedHistory(isExpanded ? null : session.id)} style={{ background: isExpanded ? "#161723" : "#0F1018", border: "1px solid " + (isExpanded ? meta.color + "30" : "#16172A"), borderRadius: isExpanded ? "12px 12px 0 0" : "12px", padding: "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 18 }}>{meta.emoji}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{meta.label}</div>
                        <div style={{ fontSize: 11, color: "#555" }}>{session.date}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {vol > 0 && <span style={{ fontSize: 10, color: "#555" }}>{Math.round(vol).toLocaleString()} vol</span>}
                      <span style={{ fontSize: 12, color: "#444" }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ background: "#0C0D16", border: "1px solid " + meta.color + "20", borderTop: "none", borderRadius: "0 0 12px 12px", padding: "12px 16px" }}>
                      {session.exercises.map((ex, i) => (
                        <div key={i} style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: meta.color, marginBottom: 4 }}>{ex.name}</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {ex.sets.map((s, j) => (
                              <span key={j} style={{ background: "#161723", borderRadius: 6, padding: "3px 10px", fontSize: 11, color: "#9CA3AF" }}>
                                {s.weight || "0"}{s.unit} × {s.reps || "0"}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                      {session.notes && (
                        <div style={{ marginTop: 8, fontSize: 12, color: "#666", fontStyle: "italic", borderTop: "1px solid #1A1A28", paddingTop: 8 }}>
                          "{session.notes}"
                        </div>
                      )}
                      <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                        {confirmDelete === session.id ? (
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: "#888" }}>Delete this session?</span>
                            <button onClick={() => deleteSession(session.id)} style={{ background: "#EF4444", border: "none", borderRadius: 6, padding: "4px 10px", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Yes</button>
                            <button onClick={() => setConfirmDelete(null)} style={{ background: "#1E2035", border: "none", borderRadius: 6, padding: "4px 10px", color: "#888", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(session.id)} style={{ background: "none", border: "1px solid #2A2A35", borderRadius: 6, padding: "4px 10px", color: "#666", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {sessions.length > 0 && (
              <div style={{ marginTop: 24, textAlign: "center", display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={exportData} style={{ background: "none", border: "1px solid #2A2A35", borderRadius: 8, padding: "6px 14px", color: "#666", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                  ⬇ Export all data as JSON
                </button>
                {confirmReset ? (
                  <div style={{ display: "inline-flex", gap: 8, alignItems: "center", background: "#0F1018", border: "1px solid #2A2A35", borderRadius: 10, padding: "6px 14px" }}>
                    <span style={{ fontSize: 12, color: "#888" }}>Delete ALL {sessions.length} sessions?</span>
                    <button onClick={resetAll} style={{ background: "#EF4444", border: "none", borderRadius: 6, padding: "4px 10px", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Yes, reset</button>
                    <button onClick={() => setConfirmReset(false)} style={{ background: "#1E2035", border: "none", borderRadius: 6, padding: "4px 10px", color: "#888", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmReset(true)} style={{ background: "none", border: "none", color: "#3A3A45", fontSize: 11, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                    Reset all data
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "progress" && (
          <div>
            {sessions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#444", fontSize: 13 }}>
                Log a few sessions first to see your progression charts here.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: "#666", fontWeight: 600, marginBottom: 8 }}>Select an exercise</div>
                  <select
                    value={progressExercise || ""}
                    onChange={e => setProgressExercise(e.target.value)}
                    style={{ width: "100%", background: "#0F1018", border: "1px solid #16172A", borderRadius: 10, padding: "10px 12px", color: "#ECEAF4", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
                  >
                    <option value="">Choose an exercise...</option>
                    {allExerciseNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                {progressExercise && (() => {
                  const data = getProgressData(progressExercise);
                  const est1RM = getBest1RM(progressExercise);
                  if (data.length === 0) {
                    return <div style={{ textAlign: "center", padding: "30px 20px", color: "#444", fontSize: 13 }}>No logged data for this exercise yet.</div>;
                  }
                  if (data.length === 1) {
                    return (
                      <div style={{ background: "#0F1018", border: "1px solid #16172A", borderRadius: 14, padding: "16px" }}>
                        <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>Only one session logged so far for this exercise:</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: "#3B82F6" }}>{data[0].maxWeight}</div>
                        <div style={{ fontSize: 11, color: "#555" }}>max weight on {data[0].date} — log more sessions to see a trend</div>
                        {est1RM && <div style={{ fontSize: 12, color: "#FBBF24", marginTop: 8 }}>Est. 1RM: {est1RM}</div>}
                      </div>
                    );
                  }
                  const first = data[0].maxWeight;
                  const last = data[data.length - 1].maxWeight;
                  const delta = last - first;
                  return (
                    <div style={{ background: "#0F1018", border: "1px solid #16172A", borderRadius: 14, padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{progressExercise}</div>
                        <div style={{ display: "flex", gap: 12 }}>
                          {est1RM && <div style={{ fontSize: 11, color: "#FBBF24" }}>Est. 1RM <b>{est1RM}</b></div>}
                          <div style={{ fontSize: 11, color: delta >= 0 ? "#4ADE80" : "#F87171" }}>
                            {delta >= 0 ? "▲ +" : "▼ "}{delta} since start
                          </div>
                        </div>
                      </div>
                      <div style={{ width: "100%", height: 220 }}>
                        <ResponsiveContainer>
                          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1E2035" />
                            <XAxis dataKey="date" stroke="#444" tick={{ fontSize: 10 }} />
                            <YAxis stroke="#444" tick={{ fontSize: 10 }} />
                            <Tooltip contentStyle={{ background: "#161723", border: "1px solid #2A2A3A", borderRadius: 8, fontSize: 12 }} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Line type="monotone" dataKey="maxWeight" name="Max Weight" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 11, color: "#666", marginBottom: 8, fontWeight: 700 }}>TOTAL VOLUME PER SESSION (weight × reps)</div>
                        <div style={{ width: "100%", height: 180 }}>
                          <ResponsiveContainer>
                            <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1E2035" />
                              <XAxis dataKey="date" stroke="#444" tick={{ fontSize: 10 }} />
                              <YAxis stroke="#444" tick={{ fontSize: 10 }} />
                              <Tooltip contentStyle={{ background: "#161723", border: "1px solid #2A2A3A", borderRadius: 8, fontSize: 12 }} />
                              <Line type="monotone" dataKey="volume" name="Volume" stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div style={{ marginTop: 20, background: "#0F1018", border: "1px solid #16172A", borderRadius: 14, padding: "16px" }}>
                  <div style={{ fontSize: 12, color: "#666", fontWeight: 700, marginBottom: 10 }}>OVERVIEW</div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "#3B82F6" }}>{sessions.length}</div>
                      <div style={{ fontSize: 11, color: "#555" }}>Total sessions</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "#F59E0B" }}>{getStreak()}</div>
                      <div style={{ fontSize: 11, color: "#555" }}>Day streak</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "#22C55E" }}>
                        {sessions.length > 0 ? sessions[sessions.length - 1].date : "-"}
                      </div>
                      <div style={{ fontSize: 11, color: "#555" }}>Last session</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </div>

      {restRunning && (
        <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "#13141F", border: "1px solid " + dayMeta.color + "40", borderRadius: 14, padding: "10px 16px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 6px 24px rgba(0,0,0,0.5)", zIndex: 50 }}>
          <div style={{ fontSize: 11, color: "#888", fontWeight: 700 }}>REST</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: dayMeta.color, fontVariantNumeric: "tabular-nums", minWidth: 56, textAlign: "center" }}>
            {fmtRestTime(restTarget - restSeconds)}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[60, 90, 120].map(t => (
              <button key={t} onClick={() => { setRestTarget(t); setRestSeconds(0); }} style={{ background: restTarget === t ? dayMeta.color : "#1E2035", border: "none", borderRadius: 6, padding: "4px 8px", color: restTarget === t ? "#fff" : "#888", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t}s</button>
            ))}
          </div>
          <button onClick={() => { setRestRunning(false); setRestSeconds(0); }} style={{ background: "none", border: "none", color: "#888", fontSize: 18, cursor: "pointer", fontFamily: "inherit", padding: "0 2px" }}>×</button>
        </div>
      )}
    </div>
  );
}