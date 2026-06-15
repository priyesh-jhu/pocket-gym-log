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
const WEIGHT_PREFIX = "workout-bodyweight:";   // + username
const PROFILES_KEY = "workout-profiles";       // JSON array of usernames
const ACTIVE_KEY = "workout-active-profile";   // current username

function sessionKey(user) {
  return SESSION_PREFIX + user;
}

function weightKey(user) {
  return WEIGHT_PREFIX + user;
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

// Map the real weekday to a training day. Sat/Sun default to Monday (Push).
function todaysDayKey() {
  const dow = new Date().getDay(); // 0 Sun … 6 Sat
  const map = { 1: "MON", 2: "TUE", 3: "WED", 4: "THU", 5: "FRI" };
  return map[dow] || "MON";
}

// ─── EXERCISE FORM GUIDE ──────────────────────────────────────────────────────
// Detailed technique + muscle targeting for each exercise, keyed by exercise
// name so the logger can open a guide panel on tap. Muscle ids map to regions
// in the BodyMap component. "view" picks front or back anatomical diagram.

const MUSCLES = {
  chest: "Chest", frontDelts: "Front Delts", sideDelts: "Side Delts", rearDelts: "Rear Delts",
  triceps: "Triceps", biceps: "Biceps", forearms: "Forearms", abs: "Core", obliques: "Obliques",
  lats: "Lats", traps: "Traps", midBack: "Mid Back", lowerBack: "Lower Back",
  glutes: "Glutes", quads: "Quads", hamstrings: "Hamstrings", calves: "Calves", adductors: "Adductors",
};

const formGuide = {
  // ── PUSH ──
  "Barbell/DB Bench Press": {
    view: "front", primary: ["chest"], secondary: ["frontDelts", "triceps"],
    setup: [
      "Lie flat with eyes under the bar. Plant both feet flat, wider than hips, for a stable base.",
      "Pull shoulder blades down and together and pin them to the bench — this creates a slight natural upper-back arch.",
      "Grip slightly wider than shoulder-width, thumbs wrapped around the bar. Stack wrists over elbows.",
    ],
    execution: [
      "Unrack out over your chest, not toward your face. Start with arms locked over mid-chest.",
      "Lower under control to the lower chest / nipple line, elbows tucked to ~45° from the torso, not flared to 90°.",
      "Touch lightly (no bounce), then press up and slightly back so you finish over the shoulders.",
    ],
    breathing: "Inhale and brace at the top, hold as you lower, exhale pressing past the sticking point.",
    mistakes: ["Flaring elbows straight out to the sides.", "Bouncing the bar or lifting the hips off the bench.", "Letting wrists bend backward instead of stacked."],
  },
  "Incline DB Press": {
    view: "front", primary: ["chest", "frontDelts"], secondary: ["triceps"],
    setup: [
      "Set a LOW incline of 15–30°. Steeper turns it into a shoulder press and removes upper-chest tension.",
      "Kick the dumbbells up from your thighs one at a time as you lie back.",
      "Retract shoulder blades and pin them; feet flat, glutes and upper back on the bench.",
    ],
    execution: [
      "Start at the sides of your upper chest, elbows ~45°, palms forward or slightly angled in.",
      "Press up and slightly inward toward each other, stopping just short of touching — keep tension, don't slam lockout.",
      "Lower slowly to a deep stretch at the sides of the upper chest.",
    ],
    breathing: "Inhale into the stretch, exhale as you press up.",
    mistakes: ["Incline set too high (becomes overhead press).", "Clashing dumbbells or letting them drift over the face.", "Cutting the stretch short at the bottom."],
  },
  "Overhead Press": {
    view: "front", primary: ["frontDelts", "sideDelts"], secondary: ["triceps"],
    setup: [
      "Feet shoulder-width. Bar at the front of the shoulders, elbows just in front of the bar.",
      "Grip slightly wider than shoulders. Brace the core hard and squeeze glutes to lock the ribcage down.",
      "Wrists stacked over elbows, bar on the heels of the palms.",
    ],
    execution: [
      "Press straight UP, not forward. Tuck the chin / move the head back slightly so the bar clears the face.",
      "As the bar passes the forehead, push the head 'through' to neutral under the bar.",
      "Lock out with the bar over the back of the head, mid-foot and shoulders, biceps near the ears.",
      "Lower under control to the front of the shoulders.",
    ],
    breathing: "Breath and brace before pressing, exhale at the top after lockout.",
    mistakes: ["Pressing forward instead of up.", "Leaning back into an incline press.", "Flaring the ribs / losing the brace — strains the low back."],
  },
  "Lateral Raises": {
    view: "front", primary: ["sideDelts"], secondary: [],
    setup: [
      "Stand tall, light dumbbell in each hand at your sides, palms facing in. Control over weight — this is the most ego-lifted move in the gym.",
      "Very slight forward lean from the hips, soft bend in the elbows throughout.",
    ],
    execution: [
      "Lead with the ELBOWS, not the hands — imagine pouring water from two jugs at the top.",
      "Raise out to the sides until the upper arms reach shoulder height (parallel to the floor). No higher, or the traps take over.",
      "Pause at the top, then lower slowly (2–3 sec) resisting gravity the whole way.",
    ],
    breathing: "Exhale as you raise, inhale as you lower.",
    mistakes: ["Swinging / using momentum.", "Hands leading and raising above shoulder height.", "Lowering too fast and losing tension."],
  },
  "Tricep Dips/Skull Crushers": {
    view: "front", primary: ["triceps"], secondary: ["chest", "frontDelts"],
    setup: [
      "DIPS: support yourself on parallel bars at arm's length. Stay UPRIGHT to bias triceps — leaning forward shifts load to the chest.",
      "SKULL CRUSHERS: lie flat holding an EZ-bar/dumbbells above the chest, arms vertical, elbows pointed at the ceiling.",
    ],
    execution: [
      "DIPS: lower until elbows reach ~90°, kept tucked close, then press to full lockout. Torso vertical.",
      "SKULL CRUSHERS: bend only at the elbows, lowering toward the forehead / just behind the head. Upper arms stay still.",
      "Extend to full lockout and squeeze the triceps hard at the top.",
    ],
    breathing: "Inhale as you lower, exhale as you press / extend.",
    mistakes: ["Dips: leaning too far forward or going too deep (shoulder stress).", "Skull crushers: elbows drifting/flaring so the upper arms swing.", "Too much weight, losing strict elbow position."],
  },

  // ── PULL ──
  "Pull-ups/Lat Pulldown": {
    view: "back", primary: ["lats"], secondary: ["biceps", "midBack"],
    setup: [
      "Grip slightly wider than shoulder-width, palms facing away. Start from a full dead hang, arms straight.",
      "Before pulling, depress the shoulder blades — pull them down and back so you feel your back engage first.",
    ],
    execution: [
      "Drive the elbows down toward your hips (not backward) and lead with the chest.",
      "Pull until your chin clears the bar (or the bar reaches your upper chest on a pulldown).",
      "Lower under control all the way back to a full stretch — no half reps.",
    ],
    breathing: "Exhale as you pull up, inhale as you lower.",
    mistakes: ["Kipping / swinging for momentum.", "Pulling with the arms before the back engages.", "Stopping short of a full stretch at the bottom."],
  },
  "Bent-Over Barbell Row": {
    view: "back", primary: ["midBack", "lats"], secondary: ["rearDelts", "biceps"],
    setup: [
      "Feet hip-width, hinge at the hips to ~45°, back flat, core braced. Bar hangs under the shoulders.",
      "Grip just outside the knees, slight bend in the knees, neutral neck.",
    ],
    execution: [
      "Pull the bar to your belly button / lower ribs, driving the elbows back and squeezing the shoulder blades.",
      "Keep the torso angle fixed — don't rise up as you row.",
      "Lower under control to a full stretch without rounding the back.",
    ],
    breathing: "Brace and hold, exhale at the top of the pull.",
    mistakes: ["Heaving the torso upright to move the weight.", "Rounding the lower back.", "Pulling to the chest instead of the belly."],
  },
  "Single-Arm DB Row": {
    view: "back", primary: ["lats"], secondary: ["midBack", "rearDelts", "biceps"],
    setup: [
      "Brace one knee and hand on a bench, back flat and roughly parallel to the floor. Dumbbell in the free hand, arm hanging straight.",
      "Square the hips and shoulders — don't let the working side rotate up.",
    ],
    execution: [
      "Drive the elbow straight back toward your hip, keeping it close to the body.",
      "Pull until the dumbbell reaches your lower ribs / hip and squeeze the lat.",
      "Lower slowly to a full lat stretch at the bottom of each rep.",
    ],
    breathing: "Exhale as you row up, inhale as you lower.",
    mistakes: ["Rotating the torso to yank the weight.", "Shrugging the shoulder toward the ear.", "Using too much weight and losing the squeeze."],
  },
  "Face Pulls/Band Pull-Aparts": {
    view: "back", primary: ["rearDelts"], secondary: ["traps", "midBack"],
    setup: [
      "Set a cable/band at upper-chest to face height. Grip with thumbs pointing back.",
      "Step back to tension, arms straight, shoulder blades relaxed but not rounded.",
    ],
    execution: [
      "Pull toward your forehead, flaring the elbows HIGH and wide so the hands finish beside your ears.",
      "Externally rotate at the end — knuckles point up/back — and squeeze the rear delts.",
      "Return slowly under control. Never skip these — they keep the shoulders healthy.",
    ],
    breathing: "Exhale as you pull, inhale on the return.",
    mistakes: ["Pulling to the chest with low elbows (becomes a row).", "Using too much weight and losing the external rotation.", "Rushing the return."],
  },
  "Bicep Curls": {
    view: "front", primary: ["biceps"], secondary: ["forearms"],
    setup: [
      "Stand tall, dumbbells/EZ-bar at your sides, elbows pinned to your ribs.",
      "Shoulders back and down, core braced to prevent swinging.",
    ],
    execution: [
      "Curl up by flexing only at the elbow — the upper arm stays still.",
      "Squeeze the biceps at the top without swinging the elbows forward.",
      "Lower slowly (2–3 sec) to a full stretch; resist on the way down.",
    ],
    breathing: "Exhale as you curl, inhale as you lower.",
    mistakes: ["Swinging the torso / using momentum.", "Elbows drifting forward at the top.", "Half reps — not lowering to full extension."],
  },

  // ── LEGS ──
  "Back Squat/Goblet Squat": {
    view: "front", primary: ["quads", "glutes"], secondary: ["adductors", "abs"],
    setup: [
      "Bar on the upper traps (or hold a dumbbell at the chest for goblet). Feet shoulder-width, toes slightly out.",
      "Brace the core hard and take a big breath before descending. Eyes forward, chest up.",
    ],
    execution: [
      "Sit down and back, breaking at the hips and knees together. Knees track over (in line with) the toes.",
      "Descend at least to parallel — hip crease level with the knee — keeping the heels planted.",
      "Drive up through the whole foot, hips and chest rising together, to full standing lockout.",
    ],
    breathing: "Big breath and brace at the top, hold through the rep, exhale at lockout.",
    mistakes: ["Knees caving inward.", "Heels lifting / weight shifting to the toes.", "Rounding the lower back ('butt wink') from going too deep without mobility."],
  },
  "Romanian Deadlift": {
    view: "back", primary: ["hamstrings", "glutes"], secondary: ["lowerBack"],
    setup: [
      "Stand tall holding the bar/dumbbells at the thighs, feet hip-width, soft bend in the knees.",
      "Brace the core and set the shoulder blades back. This is a HINGE, not a squat.",
    ],
    execution: [
      "Push the hips straight back, sliding the bar down the thighs and shins, until you feel a deep hamstring stretch.",
      "Keep the back flat and the bar close to the body the entire time — knees stay softly bent, not bending further.",
      "Drive the hips forward to stand, squeezing the glutes at the top.",
    ],
    breathing: "Inhale and brace at the top, exhale as you stand up.",
    mistakes: ["Turning it into a squat by bending the knees.", "Rounding the back as you lower.", "Letting the bar drift away from the legs."],
  },
  "Bulgarian Split Squat": {
    view: "front", primary: ["quads", "glutes"], secondary: ["adductors"],
    setup: [
      "Rear foot elevated on a bench behind you, front foot far enough forward that the front knee can track over the toe.",
      "Torso tall, optionally holding dumbbells. Brace the core.",
    ],
    execution: [
      "Lower straight down by bending the front knee, letting the rear knee drop toward the floor.",
      "Keep most of the weight through the front heel; the front knee tracks over the toes.",
      "Drive up through the front foot to the start. Fixes left/right imbalances, so go slow and controlled.",
    ],
    breathing: "Inhale as you descend, exhale as you drive up.",
    mistakes: ["Front knee caving in or shooting past the toes excessively.", "Leaning too far forward (unless intentionally targeting glutes).", "Rushing and losing balance."],
  },
  "Glute Bridge/Hip Thrust": {
    view: "back", primary: ["glutes"], secondary: ["hamstrings"],
    setup: [
      "Hip thrust: upper back on a bench, feet flat, shins vertical at the top. Glute bridge: lie on the floor, knees bent.",
      "Tuck the chin, brace the core, load (barbell/DB) across the hips if adding weight.",
    ],
    execution: [
      "Drive through the heels to lift the hips until the torso is parallel to the floor.",
      "Squeeze the glutes hard at the top for 1 second with a posterior pelvic tilt (don't hyperextend the lower back).",
      "Lower under control without resting at the bottom.",
    ],
    breathing: "Exhale as you drive up, inhale as you lower.",
    mistakes: ["Overextending the lower back instead of squeezing glutes.", "Pushing through the toes instead of the heels.", "Shallow range — not reaching full hip extension."],
  },
  "Standing Calf Raises": {
    view: "back", primary: ["calves"], secondary: [],
    setup: [
      "Balls of the feet on a step or platform, heels hanging off for full range. Stand tall, optionally holding weight.",
    ],
    execution: [
      "Drop the heels below the step for a full stretch at the bottom.",
      "Rise onto the balls of the feet as high as possible, pausing 1 second at the top.",
      "Lower slowly back into the stretch. Targets the gastrocnemius (outer calf).",
    ],
    breathing: "Exhale as you raise, inhale as you lower.",
    mistakes: ["Bouncing through partial reps.", "Not pausing or stretching fully.", "Bending the knees (shifts work off the gastroc)."],
  },

  // ── CORE + HIIT ──
  "Plank w/ Shoulder Taps": {
    view: "front", primary: ["abs"], secondary: ["obliques", "frontDelts"],
    setup: [
      "High plank position: hands under shoulders, body in a straight line from head to heels, feet about hip-width.",
      "Brace the core and squeeze the glutes. Widen the feet slightly for more stability.",
    ],
    execution: [
      "Tap one hand to the opposite shoulder while keeping the hips perfectly STILL — no rocking side to side.",
      "Alternate hands slowly and with control; the anti-rotation is the whole point.",
      "Keep the neck neutral and breathe steadily throughout.",
    ],
    breathing: "Steady, continuous breathing — don't hold your breath.",
    mistakes: ["Hips swaying with each tap.", "Sagging or piking the hips.", "Rushing the taps and losing the brace."],
  },
  "Hanging Leg Raises": {
    view: "front", primary: ["abs"], secondary: ["obliques", "forearms"],
    setup: [
      "Hang from a bar with a full grip, arms straight, shoulders active (slightly pulled down).",
    ],
    execution: [
      "Raise the legs (knees bent to start, straight to progress) by curling the pelvis UP — posterior tilt at the top is what hits the lower abs.",
      "Lift until the thighs are at least parallel to the floor, ideally higher.",
      "Lower slowly with NO swinging; control the descent fully.",
    ],
    breathing: "Exhale as you raise, inhale as you lower.",
    mistakes: ["Swinging and using momentum.", "Only lifting the legs without curling the pelvis (hip flexors take over).", "Dropping the legs uncontrolled."],
  },
  "Ab Wheel/Dead Bug": {
    view: "front", primary: ["abs"], secondary: ["obliques"],
    setup: [
      "AB WHEEL: kneel holding the wheel under the shoulders, core braced, back flat.",
      "DEAD BUG: lie on your back, arms up toward the ceiling, knees bent at 90° over the hips, lower back pressed into the floor.",
    ],
    execution: [
      "AB WHEEL: roll out only as far as you can control WITHOUT the lower back arching, then pull back using the abs.",
      "DEAD BUG: slowly lower one arm and the opposite leg toward the floor, keeping the lower back flat, then return and switch.",
      "Move slowly — control beats range here.",
    ],
    breathing: "Exhale during the effort (rolling out / extending), inhale on return.",
    mistakes: ["Letting the lower back arch / hips sag (ab wheel).", "Lifting the lower back off the floor (dead bug).", "Going faster than you can control."],
  },
  "Cable/DB Woodchop": {
    view: "front", primary: ["obliques"], secondary: ["abs"],
    setup: [
      "Set a cable high (or hold a dumbbell). Stand side-on, feet shoulder-width, core braced.",
    ],
    execution: [
      "Pull/chop diagonally across the body from high to low, ROTATING through the torso — not just the arms.",
      "Pivot the back foot and let the hips rotate with the movement, keeping the arms relatively straight.",
      "Control the return slowly against the resistance. Repeat both sides evenly.",
    ],
    breathing: "Exhale as you chop across, inhale on the return.",
    mistakes: ["Moving only the arms with no torso rotation.", "Rounding or collapsing through the trunk.", "Going too heavy and losing control."],
  },
  "Weighted Sit-ups/Bicycle Crunches": {
    view: "front", primary: ["abs"], secondary: ["obliques"],
    setup: [
      "SIT-UPS: lie with knees bent, holding a plate on the chest. BICYCLES: lie with hands lightly behind the head, legs raised.",
    ],
    execution: [
      "SIT-UPS: curl up by rounding the spine (not just hinging at the hips), squeeze the abs at the top, lower slowly.",
      "BICYCLES: bring opposite elbow toward opposite knee while extending the other leg, rotating fully through the torso.",
      "Bicycles: slow down — the controlled rotation gives the highest rectus activation of any ab move.",
    ],
    breathing: "Exhale on the crunch / rotation, inhale on the return.",
    mistakes: ["Yanking on the neck with the hands.", "Using momentum instead of the abs.", "Rushing bicycles and shortening the rotation."],
  },

  // ── FULL BODY ──
  "Conventional Deadlift": {
    view: "back", primary: ["lowerBack", "glutes", "hamstrings"], secondary: ["traps", "lats", "abs"],
    setup: [
      "Bar over mid-foot, about an inch from the shins. Feet hip-width, toes slightly out.",
      "Hinge down and grip just outside the knees. Shins to the bar, hips higher than the knees, chest up, flat back.",
      "Take the slack out of the bar (feel the tension) and brace the core hard before pulling.",
    ],
    execution: [
      "Push the floor away with the legs while keeping the bar dragging up the shins/thighs.",
      "Hips and shoulders rise together — don't let the hips shoot up first.",
      "Stand tall and lock out by squeezing the glutes; don't lean back or hyperextend.",
      "Lower by hinging the hips back first, then bending the knees, bar close to the body.",
    ],
    breathing: "Big breath and brace before the pull, hold through the lift, exhale at lockout.",
    mistakes: ["Rounding the lower back.", "Hips shooting up first, turning it into a stiff-leg pull.", "Bar drifting away from the body / jerking off the floor."],
  },
  "Back Extensions/Good Mornings": {
    view: "back", primary: ["lowerBack"], secondary: ["glutes", "hamstrings"],
    setup: [
      "BACK EXTENSION: hips on the pad, feet anchored, body straight. GOOD MORNING: bar on the upper back, feet hip-width, knees soft.",
      "Brace the core and set a neutral spine before moving.",
    ],
    execution: [
      "Hinge at the hips to lower the torso toward the floor, keeping the back flat throughout.",
      "Feel the hamstrings and glutes stretch, then drive the hips to return to straight.",
      "Stop at a straight line — do NOT hyperextend the lower back at the top.",
    ],
    breathing: "Inhale as you lower, exhale as you rise.",
    mistakes: ["Hyperextending / arching hard at the top.", "Rounding the back instead of hinging.", "Using momentum to swing up."],
  },
  "Chest-Supported DB Row": {
    view: "back", primary: ["midBack", "rearDelts"], secondary: ["lats", "biceps"],
    setup: [
      "Lie chest-down on an incline bench set to ~30–45°, a dumbbell in each hand hanging straight down.",
      "Chest stays on the pad the whole set — this removes momentum and isolates the back.",
    ],
    execution: [
      "Row both dumbbells up by driving the elbows back and squeezing the shoulder blades together.",
      "Pause and squeeze for 1 second at the top.",
      "Lower slowly to a full stretch without letting the chest come off the pad.",
    ],
    breathing: "Exhale as you row, inhale as you lower.",
    mistakes: ["Lifting the chest off the pad to cheat.", "Shrugging instead of squeezing the mid-back.", "Cutting the stretch short."],
  },
  "Farmer's Carries": {
    view: "back", primary: ["traps", "forearms"], secondary: ["abs", "calves"],
    setup: [
      "Heavy dumbbell/kettlebell in each hand at your sides. Stand tall, shoulders packed down and back.",
    ],
    execution: [
      "Walk with controlled steps, keeping the torso upright and braced — don't lean or waddle.",
      "Keep the shoulders pulled down (not shrugged up to the ears) and grip tight.",
      "Walk the target distance, set down under control, breathe.",
    ],
    breathing: "Steady, controlled breathing throughout the carry.",
    mistakes: ["Hunching forward or leaning to one side.", "Shrugging the shoulders up.", "Taking rushed, sloppy steps."],
  },
  "Seated Calf Raises": {
    view: "back", primary: ["calves"], secondary: [],
    setup: [
      "Seated with the pad across the lower thighs, balls of the feet on the platform, heels free.",
    ],
    execution: [
      "Drop the heels for a deep stretch at the bottom.",
      "Raise onto the balls of the feet as high as possible, pausing 1 second at the top.",
      "Lower slowly. The bent knee targets the soleus (deep calf) — different from the standing version.",
    ],
    breathing: "Exhale as you raise, inhale as you lower.",
    mistakes: ["Partial bouncy reps.", "Skipping the stretch at the bottom.", "No pause at the top."],
  },
};

// ─── BODY MAP (front + back views) ────────────────────────────────────────────

function BodyMap({ view = "front", primary = [], secondary = [], color = "#3B82F6" }) {
  const fillFor = (id) => {
    if (primary.includes(id)) return color;
    if (secondary.includes(id)) return color + "66";
    return "#1C1D2A";
  };
  const strokeFor = (id) => (primary.includes(id) || secondary.includes(id) ? color : "#23243A");

  if (view === "back") {
    return (
      <svg viewBox="0 0 120 220" style={{ width: "100%", height: "100%", maxHeight: 300 }}>
        <circle cx="60" cy="20" r="12" fill="#161826" stroke="#23243A" strokeWidth="1.5" />
        <rect x="54" y="31" width="12" height="8" fill="#161826" stroke="#23243A" strokeWidth="1" />
        {/* Traps */}
        <path d="M50 40 q10 -4 20 0 q-2 9 -10 11 q-8 -2 -10 -11 z" fill={fillFor("traps")} stroke={strokeFor("traps")} strokeWidth="1.2" />
        {/* Rear delts */}
        <path d="M40 44 q-10 2 -11 14 q9 -3 14 -5 z" fill={fillFor("rearDelts")} stroke={strokeFor("rearDelts")} strokeWidth="1" />
        <path d="M80 44 q10 2 11 14 q-9 -3 -14 -5 z" fill={fillFor("rearDelts")} stroke={strokeFor("rearDelts")} strokeWidth="1" />
        {/* Mid back */}
        <path d="M47 52 q13 -3 26 0 q1 9 -2 16 q-11 3 -22 0 q-3 -7 -2 -16 z" fill={fillFor("midBack")} stroke={strokeFor("midBack")} strokeWidth="1.1" />
        {/* Lats */}
        <path d="M44 56 q-4 14 1 24 q6 -2 9 -7 q-2 -10 -2 -19 q-5 0 -8 2 z" fill={fillFor("lats")} stroke={strokeFor("lats")} strokeWidth="1" />
        <path d="M76 56 q4 14 -1 24 q-6 -2 -9 -7 q2 -10 2 -19 q5 0 8 2 z" fill={fillFor("lats")} stroke={strokeFor("lats")} strokeWidth="1" />
        {/* Triceps */}
        <path d="M28 60 q-5 9 -4 21 q5 -1 8 -3 q1 -10 1 -19 z" fill={fillFor("triceps")} stroke={strokeFor("triceps")} strokeWidth="1" />
        <path d="M92 60 q5 9 4 21 q-5 -1 -8 -3 q-1 -10 -1 -19 z" fill={fillFor("triceps")} stroke={strokeFor("triceps")} strokeWidth="1" />
        {/* Forearms */}
        <path d="M22 83 q-2 14 1 25 q5 -1 7 -3 q-1 -12 -1 -24 q-4 0 -7 2 z" fill={fillFor("forearms")} stroke={strokeFor("forearms")} strokeWidth="1" />
        <path d="M98 83 q2 14 -1 25 q-5 -1 -7 -3 q1 -12 1 -24 q4 0 7 2 z" fill={fillFor("forearms")} stroke={strokeFor("forearms")} strokeWidth="1" />
        {/* Lower back */}
        <path d="M50 70 q10 -2 20 0 q1 10 -1 18 q-9 2 -18 0 q-2 -8 -1 -18 z" fill={fillFor("lowerBack")} stroke={strokeFor("lowerBack")} strokeWidth="1.1" />
        {/* Glutes */}
        <path d="M49 90 q11 -3 22 0 q2 9 -1 16 q-10 3 -20 0 q-3 -7 -1 -16 z" fill={fillFor("glutes")} stroke={strokeFor("glutes")} strokeWidth="1.2" />
        {/* Hamstrings */}
        <path d="M49 108 q-3 20 0 36 q6 2 9 0 q1 -18 1 -36 q-5 -2 -10 0 z" fill={fillFor("hamstrings")} stroke={strokeFor("hamstrings")} strokeWidth="1" />
        <path d="M71 108 q3 20 0 36 q-6 2 -9 0 q-1 -18 -1 -36 q5 -2 10 0 z" fill={fillFor("hamstrings")} stroke={strokeFor("hamstrings")} strokeWidth="1" />
        {/* Calves */}
        <path d="M50 146 q-3 26 0 50 q5 2 8 0 q2 -26 1 -50 q-5 -2 -9 0 z" fill={fillFor("calves")} stroke={strokeFor("calves")} strokeWidth="1" />
        <path d="M70 146 q3 26 0 50 q-5 2 -8 0 q-2 -26 -1 -50 q5 -2 9 0 z" fill={fillFor("calves")} stroke={strokeFor("calves")} strokeWidth="1" />
      </svg>
    );
  }

  // front view
  return (
    <svg viewBox="0 0 120 220" style={{ width: "100%", height: "100%", maxHeight: 300 }}>
      <circle cx="60" cy="20" r="12" fill="#161826" stroke="#23243A" strokeWidth="1.5" />
      <rect x="54" y="31" width="12" height="8" fill="#161826" stroke="#23243A" strokeWidth="1" />
      <path d="M40 44 q-10 2 -11 14 q8 -4 13 -4 z" fill={fillFor("sideDelts")} stroke={strokeFor("sideDelts")} strokeWidth="1" />
      <path d="M80 44 q10 2 11 14 q-8 -4 -13 -4 z" fill={fillFor("sideDelts")} stroke={strokeFor("sideDelts")} strokeWidth="1" />
      <path d="M41 43 q6 -3 12 0 l-1 11 q-7 -2 -12 1 z" fill={fillFor("frontDelts")} stroke={strokeFor("frontDelts")} strokeWidth="1" />
      <path d="M79 43 q-6 -3 -12 0 l1 11 q7 -2 12 1 z" fill={fillFor("frontDelts")} stroke={strokeFor("frontDelts")} strokeWidth="1" />
      <path d="M48 47 q-7 1 -8 12 q0 6 7 8 q6 1 12 -1 l0 -19 q-6 -1 -11 0 z" fill={fillFor("chest")} stroke={strokeFor("chest")} strokeWidth="1.2" />
      <path d="M72 47 q7 1 8 12 q0 6 -7 8 q-6 1 -12 -1 l0 -19 q6 -1 11 0 z" fill={fillFor("chest")} stroke={strokeFor("chest")} strokeWidth="1.2" />
      <path d="M30 60 q-5 8 -4 20 q5 -1 8 -3 q1 -10 1 -18 z" fill={fillFor("biceps")} stroke={strokeFor("biceps")} strokeWidth="1" />
      <path d="M90 60 q5 8 4 20 q-5 -1 -8 -3 q-1 -10 -1 -18 z" fill={fillFor("biceps")} stroke={strokeFor("biceps")} strokeWidth="1" />
      <path d="M27 61 q-5 9 -4 20 q-4 -2 -5 -6 q0 -9 4 -16 z" fill={fillFor("triceps")} stroke={strokeFor("triceps")} strokeWidth="1" />
      <path d="M93 61 q5 9 4 20 q4 -2 5 -6 q0 -9 -4 -16 z" fill={fillFor("triceps")} stroke={strokeFor("triceps")} strokeWidth="1" />
      <path d="M22 82 q-2 14 1 26 q5 -1 7 -3 q-1 -13 -1 -25 q-4 0 -7 2 z" fill={fillFor("forearms")} stroke={strokeFor("forearms")} strokeWidth="1" />
      <path d="M98 82 q2 14 -1 26 q-5 -1 -7 -3 q1 -13 1 -25 q4 0 7 2 z" fill={fillFor("forearms")} stroke={strokeFor("forearms")} strokeWidth="1" />
      <path d="M50 68 q10 -2 20 0 q1 16 -2 30 q-8 3 -16 0 q-3 -14 -2 -30 z" fill={fillFor("abs")} stroke={strokeFor("abs")} strokeWidth="1.2" />
      {/* Obliques */}
      <path d="M47 70 q-3 12 -1 24 q4 -1 6 -3 q-1 -11 -1 -21 z" fill={fillFor("obliques")} stroke={strokeFor("obliques")} strokeWidth="0.9" />
      <path d="M73 70 q3 12 1 24 q-4 -1 -6 -3 q1 -11 1 -21 z" fill={fillFor("obliques")} stroke={strokeFor("obliques")} strokeWidth="0.9" />
      <path d="M48 100 q-4 22 0 44 q6 2 10 0 q2 -22 1 -44 q-6 -2 -11 0 z" fill={fillFor("quads")} stroke={strokeFor("quads")} strokeWidth="1" />
      <path d="M72 100 q4 22 0 44 q-6 2 -10 0 q-2 -22 -1 -44 q6 -2 11 0 z" fill={fillFor("quads")} stroke={strokeFor("quads")} strokeWidth="1" />
      {/* Adductors */}
      <path d="M58 100 q4 18 0 38 q-3 1 -5 0 q-3 -20 0 -38 z" fill={fillFor("adductors")} stroke={strokeFor("adductors")} strokeWidth="0.9" />
      <path d="M62 100 q-4 18 0 38 q3 1 5 0 q3 -20 0 -38 z" fill={fillFor("adductors")} stroke={strokeFor("adductors")} strokeWidth="0.9" />
      <path d="M50 146 q-3 30 0 60 q5 2 8 0 q2 -30 1 -60 z" fill={fillFor("calves")} stroke={strokeFor("calves")} strokeWidth="1" />
      <path d="M70 146 q3 30 0 60 q-5 2 -8 0 q-2 -30 -1 -60 z" fill={fillFor("calves")} stroke={strokeFor("calves")} strokeWidth="1" />
    </svg>
  );
}

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

// ─── PLATE CALCULATOR ─────────────────────────────────────────────────────────
// Given a total target weight, the bar weight, and available plate sizes,
// return the plates to load PER SIDE. Greedy from heaviest plate down.

const PLATE_SETS = {
  lb: { bar: 45, plates: [45, 35, 25, 10, 5, 2.5] },
  kg: { bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] },
};

function calcPlates(total, unit) {
  const { bar, plates } = PLATE_SETS[unit] || PLATE_SETS.lb;
  if (isNaN(total) || total <= bar) return { perSide: [], leftover: 0, bar };
  let perSideWeight = (total - bar) / 2;
  const result = [];
  for (const p of plates) {
    let count = 0;
    while (perSideWeight + 1e-9 >= p) {
      perSideWeight -= p;
      count++;
    }
    if (count > 0) result.push({ plate: p, count });
  }
  return { perSide: result, leftover: Math.round(perSideWeight * 100) / 100, bar };
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

  const [currentDay, setCurrentDay] = useState(() => todaysDayKey());
  const [draft, setDraft] = useState(() => newSession(todaysDayKey()));
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [progressExercise, setProgressExercise] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showCoach, setShowCoach] = useState(true);
  const [showWarmup, setShowWarmup] = useState(true);

  const [restSeconds, setRestSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [restTarget, setRestTarget] = useState(90);

  // ── Bodyweight tracking ──
  const [bodyweights, setBodyweights] = useState([]);
  const [weightInput, setWeightInput] = useState("");
  const [weightUnit, setWeightUnit] = useState("lb");
  const [weightDate, setWeightDate] = useState(() => todayISO());
  const [confirmDeleteWeight, setConfirmDeleteWeight] = useState(null);

  // ── Exercise form guide panel ──
  const [guideExercise, setGuideExercise] = useState(null);

  // ── Plate calculator popover: which set row it's open for ──
  const [plateFor, setPlateFor] = useState(null); // "exIdx-setIdx" or null

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

      const rawWeights = storage.get(weightKey(active));
      if (rawWeights) {
        const parsedW = JSON.parse(rawWeights);
        setBodyweights(Array.isArray(parsedW) ? parsedW : []);
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
    try {
      const rawW = storage.get(weightKey(user));
      const parsedW = rawW ? JSON.parse(rawW) : [];
      setBodyweights(Array.isArray(parsedW) ? parsedW : []);
    } catch {
      setBodyweights([]);
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

  // ── Bodyweight ──
  function persistWeights(updated) {
    if (!activeProfile) return;
    storage.set(weightKey(activeProfile), JSON.stringify(updated));
  }

  function addWeight() {
    const w = parseFloat(weightInput);
    if (isNaN(w) || w <= 0) {
      setSaveStatus("error");
      setStatusMsg("Enter a valid weight.");
      setTimeout(() => { setSaveStatus("idle"); setStatusMsg(null); }, 2000);
      return;
    }
    // One entry per date — replace if the date already exists
    const entry = { id: "w_" + Date.now(), date: weightDate, weight: w, unit: weightUnit };
    const withoutDate = bodyweights.filter(e => e.date !== weightDate);
    const updated = [...withoutDate, entry].sort((a, b) => a.date.localeCompare(b.date));
    setBodyweights(updated);
    persistWeights(updated);
    setWeightInput("");
    setSaveStatus("saved");
    setStatusMsg("Weight logged ✓");
    setTimeout(() => { setSaveStatus("idle"); setStatusMsg(null); }, 1500);
  }

  function deleteWeight(id) {
    const updated = bodyweights.filter(e => e.id !== id);
    setBodyweights(updated);
    persistWeights(updated);
    setConfirmDeleteWeight(null);
  }

  // Normalize all weights to a common unit for plotting (kg → lb)
  function toLb(entry) {
    return entry.unit === "kg" ? entry.weight * 2.20462 : entry.weight;
  }

  // Build chart data: raw points + 7-day rolling average (in the display unit)
  function getWeightChart(displayUnit) {
    const conv = (lb) => (displayUnit === "kg" ? lb / 2.20462 : lb);
    const sorted = [...bodyweights].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.map((e, i) => {
      // 7-day window ending at this entry (by date proximity, using available points)
      const windowStart = new Date(e.date);
      windowStart.setDate(windowStart.getDate() - 6);
      const startISO = windowStart.toISOString().slice(0, 10);
      const windowPts = sorted.filter(p => p.date >= startISO && p.date <= e.date);
      const avgLb = windowPts.reduce((s, p) => s + toLb(p), 0) / windowPts.length;
      return {
        date: e.date.slice(5), // MM-DD for axis brevity
        weight: Math.round(conv(toLb(e)) * 10) / 10,
        trend: Math.round(conv(avgLb) * 10) / 10,
      };
    });
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

  // Most recent past session's sets for a given exercise (for the "last time" cue)
  function getLastTime(exerciseName) {
    const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
    for (const s of sorted) {
      const ex = s.exercises.find(e => e.name === exerciseName);
      if (ex && ex.sets.length > 0) {
        return { date: s.date, sets: ex.sets };
      }
    }
    return null;
  }

  // Pre-fill the draft's sets for one exercise from last time's numbers
  function copyLastTime(exIdx, exerciseName) {
    const last = getLastTime(exerciseName);
    if (!last) return;
    setDraft(prev => {
      const exercises = prev.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        return {
          ...ex,
          sets: last.sets.map(s => ({
            weight: String(s.weight ?? ""),
            reps: "",                      // reps left blank — you fill what you actually hit
            unit: s.unit || "lb",
            done: false,
          })),
        };
      });
      return { ...prev, exercises };
    });
  }

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
        {[["log", "Log Workout"], ["history", "History"], ["progress", "Progress"], ["weight", "Weight"]].map(([id, label]) => (
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
              const last = getLastTime(ex.name);
              return (
                <div key={exIdx} style={{ background: "#0F1018", border: "1px solid " + dayMeta.color + "20", borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4, gap: 8 }}>
                    <button
                      onClick={() => formGuide[ex.name] && setGuideExercise(ex.name)}
                      style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: formGuide[ex.name] ? "pointer" : "default", fontFamily: "inherit", textAlign: "left" }}
                    >
                      <span style={{ fontWeight: 700, fontSize: 14, color: dayMeta.color }}>{ex.name}</span>
                      {formGuide[ex.name] && (
                        <span style={{ fontSize: 9, color: dayMeta.color, border: "1px solid " + dayMeta.color + "55", borderRadius: 5, padding: "1px 5px", fontWeight: 700, flexShrink: 0 }}>ⓘ form</span>
                      )}
                    </button>
                    <div style={{ fontSize: 10, color: "#444", background: "#161723", borderRadius: 6, padding: "2px 8px", flexShrink: 0 }}>Target: {planEx.target}</div>
                  </div>

                  {pr && (
                    <div style={{ fontSize: 10, color: "#FBBF24", marginBottom: 6, fontWeight: 600 }}>
                      🏆 Best: {pr.weight}{draft.exercises[exIdx].sets[0]?.unit || "lb"} × {pr.reps} ({pr.date})
                    </div>
                  )}

                  {last && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, color: "#666", fontWeight: 600, flexShrink: 0 }}>↩ Last ({last.date.slice(5)}):</span>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
                        {last.sets.map((s, j) => (
                          <span key={j} style={{ fontSize: 10, color: "#9CA3AF", background: "#161723", borderRadius: 5, padding: "2px 7px" }}>
                            {s.weight || "0"}{s.unit} × {s.reps || "0"}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => copyLastTime(exIdx, ex.name)}
                        style={{ background: "rgba(59,130,246,0.1)", border: "1px solid " + dayMeta.color + "40", borderRadius: 6, padding: "3px 9px", color: dayMeta.color, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                      >
                        Copy weights
                      </button>
                    </div>
                  )}

                  {ex.sets.map((set, setIdx) => {
                    const isPR = pr && parseFloat(set.weight) > pr.weight;
                    const plateKey = exIdx + "-" + setIdx;
                    const plateOpen = plateFor === plateKey;
                    const plateData = plateOpen ? calcPlates(parseFloat(set.weight), set.unit) : null;
                    return (
                      <div key={setIdx} style={{ position: "relative", marginBottom: 8 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
                          <button
                            onClick={() => setPlateFor(plateOpen ? null : plateKey)}
                            title="Plate calculator"
                            disabled={!parseFloat(set.weight)}
                            style={{ background: plateOpen ? dayMeta.color : "#161723", border: "1px solid " + (plateOpen ? dayMeta.color : "#1E2035"), borderRadius: 8, padding: "8px 9px", color: plateOpen ? "#fff" : (parseFloat(set.weight) ? "#9CA3AF" : "#3A3A45"), fontSize: 13, cursor: parseFloat(set.weight) ? "pointer" : "default", fontFamily: "inherit", flexShrink: 0 }}
                          >
                            🏋
                          </button>
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

                        {plateOpen && plateData && (
                          <div style={{ background: "#0C0D16", border: "1px solid " + dayMeta.color + "30", borderRadius: 8, padding: "8px 12px", marginTop: 6, fontSize: 11 }}>
                            {plateData.perSide.length === 0 ? (
                              <span style={{ color: "#888" }}>
                                {parseFloat(set.weight) <= plateData.bar
                                  ? "At or below the bar weight (" + plateData.bar + set.unit + ") — no plates needed."
                                  : "No standard plates fit."}
                              </span>
                            ) : (
                              <div>
                                <span style={{ color: "#666", fontWeight: 700 }}>Per side ({plateData.bar}{set.unit} bar): </span>
                                {plateData.perSide.map((p, k) => (
                                  <span key={k} style={{ color: dayMeta.color, fontWeight: 700 }}>
                                    {p.count}×{p.plate}{k < plateData.perSide.length - 1 ? "  ·  " : ""}
                                  </span>
                                ))}
                                {plateData.leftover > 0 && (
                                  <span style={{ color: "#F87171", marginLeft: 6 }}>(+{plateData.leftover}{set.unit} can't be matched)</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
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
      {/* Exercise form guide modal */}
      {guideExercise && formGuide[guideExercise] && (() => {
        const g = formGuide[guideExercise];
        return (
          <div
            onClick={() => setGuideExercise(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(4,5,10,0.8)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ background: "#0B0C14", border: "1px solid #1E2035", borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 720, maxHeight: "92vh", overflowY: "auto", padding: "0 0 30px" }}
            >
              {/* Sticky header */}
              <div style={{ position: "sticky", top: 0, background: "#0B0C14", borderBottom: "1px solid #16172A", padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 2 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: dayMeta.color }}>{guideExercise}</div>
                <button onClick={() => setGuideExercise(null)} style={{ background: "#161723", border: "1px solid #2A2A3A", borderRadius: 8, width: 30, height: 30, color: "#9CA3AF", fontSize: 18, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
              </div>

              <div style={{ padding: "16px 18px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.5fr", gap: 16 }}>
                  {/* Muscle map */}
                  <div>
                    <div style={{ background: "#0C0D16", border: "1px solid #16172A", borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", alignItems: "center", position: "sticky", top: 70 }}>
                      <div style={{ fontSize: 9, color: "#666", fontWeight: 800, letterSpacing: "0.1em", marginBottom: 4, alignSelf: "flex-start" }}>
                        MUSCLES · {g.view === "back" ? "BACK" : "FRONT"}
                      </div>
                      <BodyMap view={g.view} primary={g.primary} secondary={g.secondary} color={dayMeta.color} />
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8, justifyContent: "center" }}>
                        {g.primary.map(m => (
                          <span key={m} style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: dayMeta.color, borderRadius: 100, padding: "2px 8px" }}>{MUSCLES[m]}</span>
                        ))}
                        {g.secondary.map(m => (
                          <span key={m} style={{ fontSize: 9, fontWeight: 600, color: dayMeta.color, background: dayMeta.color + "1A", border: "1px solid " + dayMeta.color + "40", borderRadius: 100, padding: "2px 8px" }}>{MUSCLES[m]}</span>
                        ))}
                      </div>
                      <div style={{ fontSize: 8.5, color: "#555", marginTop: 6, textAlign: "center" }}>● primary　○ secondary</div>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div>
                    <GuideSection icon="🧩" title="SETUP & POSITION" items={g.setup} color={dayMeta.color} />
                    <GuideSection icon="🎯" title="EXECUTION" items={g.execution} color={dayMeta.color} />
                    <div style={{ marginBottom: 14, background: "#0C0D16", border: "1px solid #16172A", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, color: "#60A5FA", fontWeight: 800, letterSpacing: "0.06em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>💨 BREATHING</div>
                      <div style={{ fontSize: 12.5, color: "#C4C2D4", lineHeight: 1.5 }}>{g.breathing}</div>
                    </div>
                    <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, color: "#F87171", fontWeight: 800, letterSpacing: "0.06em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>⚠️ COMMON MISTAKES</div>
                      {g.mistakes.map((c, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                          <span style={{ flexShrink: 0, color: "#F87171", fontSize: 12, marginTop: 1 }}>✕</span>
                          <span style={{ fontSize: 12, color: "#B59CA0", lineHeight: 1.45 }}>{c}</span>
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

function GuideSection({ icon, title, items, color }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: color, fontWeight: 800, letterSpacing: "0.06em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <span>{icon}</span>{title}
      </div>
      {items.map((c, i) => (
        <div key={i} style={{ display: "flex", gap: 9, marginBottom: 7, alignItems: "flex-start" }}>
          <span style={{ flexShrink: 0, width: 17, height: 17, borderRadius: "50%", background: color + "22", color: color, fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>{i + 1}</span>
          <span style={{ fontSize: 12.5, color: "#C4C2D4", lineHeight: 1.5 }}>{c}</span>
        </div>
      ))}
    </div>
  );
}