// ─── DAY / DATE HELPERS ───────────────────────────────────────────────────────
export const dayOrder = ["MON", "TUE", "WED", "THU", "FRI"];

// ─── PLAN TEMPLATE ────────────────────────────────────────────────────────────
export const dayTemplates = {
  MON: {
    label:"Push", color:"#3B82F6", emoji:"🔺",
    focus:"Chest · Shoulders · Triceps · Serratus",
    coachNote:"Warm up with 2x15 Band Pull-Aparts before you touch a single weight. Protects the rotator cuff for long-term pressing.",
    warmup:{
      general:"3-5 min easy cardio (incline walk / rower) to raise core temp",
      drills:[
        {name:"Band Pull-Aparts", detail:"2 x 15 — wakes up rear delts & rotator cuff before pressing"},
        {name:"Arm Circles + Shoulder Dislocates", detail:"10 each way with a band or broomstick — opens the shoulders"},
        {name:"Scapular Push-ups", detail:"1 x 12 — primes serratus & shoulder blade control"},
        {name:"Empty-bar / light-DB press", detail:"1-2 ramp sets at ~40% before your first working set"},
      ],
    },
    exercises:[
      {name:"Barbell/DB Bench Press", target:"3 x 6-10", muscles:"Mid chest, front delts, triceps", tip:"Touch bar to lower chest. Drive feet into the floor.", alt:"Push-ups with feet elevated on a chair"},
      {name:"Incline DB Press", target:"3 x 10-12", muscles:"Upper chest, front delts", tip:"15-30 degree incline only. Full stretch at the bottom.", alt:"Pike push-ups or elevated push-ups on a box"},
      {name:"Overhead Press", target:"3 x 8-10", muscles:"Front + side delts, upper traps, triceps", tip:"Bar path straight up — don't press forward.", alt:"Seated DB press if balance is an issue"},
      {name:"Lateral Raises", target:"3 x 15-20", muscles:"Side delts (isolated)", tip:"Light weight. Lead with elbows, slight forward lean.", alt:"Resistance bands work perfectly"},
      {name:"Tricep Dips/Skull Crushers", target:"3 x 10-12", muscles:"All 3 tricep heads", tip:"Dips: stay upright for tricep focus.", alt:"Bench dips if no dip bars"},
    ],
    cardio:"10 min incline walk — Easy",
  },
  TUE: {
    label:"Pull", color:"#8B5CF6", emoji:"🔻",
    focus:"Back · Biceps · Rear Delts · Traps",
    coachNote:"Initiate every pull by depressing your shoulder blades — feel it in your back first, not your biceps.",
    warmup:{
      general:"3-5 min easy cardio (rower is ideal — it primes the whole pulling chain)",
      drills:[
        {name:"Band Pull-Aparts", detail:"2 x 15 — rear delts & mid traps"},
        {name:"Cat-Cow + T-Spine Rotations", detail:"8 each — mobilizes the thoracic spine for rowing"},
        {name:"Scapular Pull-ups / Dead Hangs", detail:"2 x 8 (or 20s hang) — activates lats before pulling"},
        {name:"Light band rows", detail:"1 x 15 — grooves the 'lead with the back' pattern"},
      ],
    },
    exercises:[
      {name:"Pull-ups/Lat Pulldown", target:"3 x 5-10", muscles:"Lats, teres major, biceps", tip:"Dead hang at bottom. Drive elbows to hips, not backward.", alt:"Band-assisted pull-ups, or inverted rows under a barbell"},
      {name:"Bent-Over Barbell Row", target:"3 x 8-10", muscles:"Rhomboids, mid traps, rear delts, lats", tip:"Hinge to 45 degrees. Pull to belly button, not chest.", alt:"Both DBs bent-over, or chest-supported incline DB row"},
      {name:"Single-Arm DB Row", target:"3 x 10-12 each", muscles:"Lats, mid back, rear delts", tip:"Drive elbow straight back toward hip. Full lat stretch at bottom.", alt:"Brace on your own thigh if no bench"},
      {name:"Face Pulls/Band Pull-Aparts", target:"3 x 15-20", muscles:"Rear delts, external rotators, mid traps", tip:"Pull to forehead, elbows flared high. Never skip — keeps shoulders healthy.", alt:"Band pull-aparts anywhere"},
      {name:"Bicep Curls", target:"3 x 10-12", muscles:"Biceps, brachialis", tip:"Strict form, no swinging. Slow on the way down.", alt:"Resistance bands, EZ bar, hammer curls"},
    ],
    cardio:"10 min light cycling or brisk walk — Easy",
  },
  WED: {
    label:"Legs", color:"#EC4899", emoji:"🦵",
    focus:"Quads · Hamstrings · Glutes · Calves · Adductors",
    coachNote:"Leg day creates the biggest hormonal response and burns the most calories for 24-48 hrs after. Never skip it.",
    warmup:{
      general:"5 min easy bike or incline walk — legs need a longer ramp than upper body",
      drills:[
        {name:"Leg Swings (front-back & side-side)", detail:"10 each leg, each direction — opens hips & hamstrings"},
        {name:"Bodyweight Squats", detail:"2 x 15 — grooves depth and knee tracking"},
        {name:"Walking Lunges + Glute Bridges", detail:"10 lunges / 15 bridges — fires glutes before they load"},
        {name:"Empty-bar / goblet ramp sets", detail:"2 light sets before your first working squat"},
      ],
    },
    exercises:[
      {name:"Back Squat/Goblet Squat", target:"4 x 6-10", muscles:"Quads, glutes, adductors, core", tip:"Depth matters. Knees track over toes. Brace core before every rep.", alt:"Goblet squat with one heavy dumbbell"},
      {name:"Romanian Deadlift", target:"3 x 10-12", muscles:"Hamstrings, glutes, erectors", tip:"Hinge, not squat. Push hips back until deep hamstring stretch.", alt:"Two dumbbells if no barbell"},
      {name:"Bulgarian Split Squat", target:"3 x 8-10 each", muscles:"Quads, glutes, adductors — fixes imbalances", tip:"Rear foot elevated. Lower slowly, front knee tracks over toes.", alt:"Hold one or two dumbbells"},
      {name:"Glute Bridge/Hip Thrust", target:"3 x 12-15", muscles:"Glutes (primary), hamstrings", tip:"Drive through heels. Squeeze 1 sec at top, posterior pelvic tilt.", alt:"Floor glute bridge bodyweight, or DB on hips for load"},
      {name:"Standing Calf Raises", target:"4 x 15-20", muscles:"Gastrocnemius (outer calf)", tip:"Full stretch at bottom, pause 1 sec at top.", alt:"Use a step for full range, hold dumbbells for load"},
    ],
    cardio:"10 min slow walk — active recovery",
  },
  THU: {
    label:"Core+HIIT", color:"#F59E0B", emoji:"🔥",
    focus:"Full Core · Obliques · Fat Burn",
    coachNote:"Core is everything from hips to shoulders. The HIIT after this is your most direct fat-burning tool.",
    warmup:{
      general:"3-4 min easy cardio + dynamic movement to get the heart rate climbing for HIIT",
      drills:[
        {name:"Cat-Cow + Bird Dogs", detail:"8 cat-cows, 8 bird dogs each side — wakes up the deep core"},
        {name:"Dead Bug (slow)", detail:"1 x 10 — connects breathing to bracing before loaded core work"},
        {name:"Hip Circles + Leg Swings", detail:"10 each — loosens hips for leg raises and HIIT"},
        {name:"2-3 short HIIT primers", detail:"20s at 70% effort before going all-out, so round 1 isn't a cold sprint"},
      ],
    },
    exercises:[
      {name:"Plank w/ Shoulder Taps", target:"3 x 30-45 sec", muscles:"Transverse abdominis, anti-rotation core", tip:"Keep hips perfectly still while tapping shoulders.", alt:"Standard plank if too hard initially"},
      {name:"Hanging Leg Raises", target:"3 x 10-12", muscles:"Lower rectus abdominis, hip flexors", tip:"No swinging. Tuck pelvis under at top — posterior tilt activates lower abs.", alt:"Lying straight leg raises on the floor"},
      {name:"Ab Wheel/Dead Bug", target:"3 x 8-10", muscles:"Full anterior core", tip:"Ab wheel: only as far as you can control. Dead bug: lower opposite arm/leg, press lower back into floor.", alt:"Dead bug needs zero equipment"},
      {name:"Cable/DB Woodchop", target:"3 x 12 each side", muscles:"Obliques, rotational core, serratus", tip:"Rotate through torso, not just arms.", alt:"Resistance band anchored to a door or post"},
      {name:"Weighted Sit-ups/Bicycle Crunches", target:"3 x 15-20", muscles:"Upper rectus abdominis, obliques", tip:"Bicycle crunches: rotate fully, slow down — highest rectus activation of any ab move.", alt:"Bodyweight, hold a plate on chest for sit-ups"},
    ],
    cardio:"15 min HIIT: 30s max effort / 30s rest x 15 rounds",
  },
  FRI: {
    label:"Full Body", color:"#EF4444", emoji:"⚡",
    focus:"Posterior Chain · Upper Back · Erectors · Calves",
    coachNote:"Targets what the week left undertrained — the entire posterior chain, upper traps, erectors, and a second calf stimulus.",
    warmup:{
      general:"5 min easy cardio — deadlift day demands a thorough ramp to protect the low back",
      drills:[
        {name:"Cat-Cow + Hip Hinges (bodyweight)", detail:"8 cat-cows, 10 hinges — grooves the hinge before loading it"},
        {name:"Glute Bridges + Bird Dogs", detail:"15 bridges, 8 bird dogs each side — fires glutes & braces the core"},
        {name:"Band Pull-Aparts", detail:"2 x 15 — preps upper back for rows and carries"},
        {name:"Deadlift ramp sets", detail:"3-4 progressively heavier sets to your working weight — never jump straight to heavy"},
      ],
    },
    exercises:[
      {name:"Conventional Deadlift", target:"3 x 5-6", muscles:"Erectors, glutes, hamstrings, traps, lats, core", tip:"Heavy day, lower reps. Hinge, brace, push the floor away. Bar drags against shins.", alt:"DB deadlift, or trap bar deadlift if available"},
      {name:"Back Extensions/Good Mornings", target:"3 x 12-15", muscles:"Erectors (lower back), glutes, hamstrings", tip:"Fills the #1 gap of the week — isolated erector work. Don't hyperextend at top.", alt:"Over a stability ball, or Superman holds on the floor"},
      {name:"Chest-Supported DB Row", target:"3 x 10-12", muscles:"Rhomboids, mid traps, rear delts, lats", tip:"Chest supported removes momentum. Squeeze shoulder blades, hold 1 sec.", alt:"Lie face down on incline bench, row both dumbbells"},
      {name:"Farmer's Carries", target:"3 x 25-30 meters", muscles:"Upper traps, grip, core, calves", tip:"Walk tall, shoulders packed down and back.", alt:"Any two heavy dumbbells or kettlebells"},
      {name:"Seated Calf Raises", target:"4 x 15-20", muscles:"Soleus (deep calf — different from Wed)", tip:"Deep stretch at bottom, 1 sec pause at top. Need both calf heads for full development.", alt:"Sit on a bench, dumbbell on knee, raise onto ball of foot"},
    ],
    cardio:"10-15 min incline walk — Easy",
  },
};
