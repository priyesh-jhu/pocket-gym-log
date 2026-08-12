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
      {variants:[
        {equipment:"free", name:"Barbell/DB Bench Press", target:"3 x 6-10", muscles:"Mid chest, front delts, triceps", tip:"Touch bar to lower chest. Drive feet into the floor.", alt:"Push-ups with feet elevated on a chair"},
        {equipment:"machine", name:"Chest Press Machine", target:"3 x 10-12", muscles:"Mid chest, front delts, triceps", tip:"Set the seat so the handles line up with mid-chest, not your neck.", alt:"Any plate-loaded or selectorized chest press"},
      ]},
      {variants:[
        {equipment:"free", name:"Incline DB Press", target:"3 x 10-12", muscles:"Upper chest, front delts", tip:"15-30 degree incline only. Full stretch at the bottom.", alt:"Pike push-ups or elevated push-ups on a box"},
        {equipment:"machine", name:"Incline Chest Press Machine", target:"3 x 10-12", muscles:"Upper chest, front delts", tip:"Handles should start just below the collarbone.", alt:"Incline setting on any chest press, or a Smith machine incline press"},
      ]},
      {variants:[
        {equipment:"free", name:"Overhead Press", target:"3 x 8-10", muscles:"Front + side delts, upper traps, triceps", tip:"Bar path straight up — don't press forward.", alt:"Seated DB press if balance is an issue"},
        {equipment:"machine", name:"Shoulder Press Machine", target:"3 x 10-12", muscles:"Front + side delts, triceps", tip:"Handles at ear height to start — no lower.", alt:"Smith machine press, or seated DB press"},
      ]},
      {variants:[
        {equipment:"free", name:"Lateral Raises", target:"3 x 15-20", muscles:"Side delts (isolated)", tip:"Light weight. Lead with elbows, slight forward lean.", alt:"Resistance bands work perfectly"},
        {equipment:"machine", name:"Lateral Raise Machine", target:"3 x 15-20", muscles:"Side delts (isolated)", tip:"Drive with the pads on your upper arms, not your hands.", alt:"Cable lateral raise, one arm at a time"},
      ]},
      {variants:[
        {equipment:"free", name:"Tricep Dips/Skull Crushers", target:"3 x 10-12", muscles:"All 3 tricep heads", tip:"Dips: stay upright for tricep focus.", alt:"Bench dips if no dip bars"},
        {equipment:"machine", name:"Cable Tricep Pushdown", target:"3 x 12-15", muscles:"All 3 tricep heads", tip:"Pin the elbows to your ribs — only the forearms move.", alt:"Assisted dip machine, or a band anchored overhead"},
      ]},
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
      {variants:[
        {equipment:"free", name:"Pull-ups/Lat Pulldown", target:"3 x 5-10", muscles:"Lats, teres major, biceps", tip:"Dead hang at bottom. Drive elbows to hips, not backward.", alt:"Band-assisted pull-ups, or inverted rows under a barbell"},
        {equipment:"machine", name:"Lat Pulldown Machine", target:"3 x 10-12", muscles:"Lats, teres major, biceps", tip:"Set the thigh pad tight so you can't drive with your legs.", alt:"Assisted pull-up machine"},
      ]},
      {variants:[
        {equipment:"free", name:"Bent-Over Barbell Row", target:"3 x 8-10", muscles:"Rhomboids, mid traps, rear delts, lats", tip:"Hinge to 45 degrees. Pull to belly button, not chest.", alt:"Both DBs bent-over, or chest-supported incline DB row"},
        {equipment:"machine", name:"Seated Cable Row", target:"3 x 10-12", muscles:"Rhomboids, mid traps, lats, rear delts", tip:"Keep the torso still — the arms do the travelling.", alt:"Chest-supported machine row"},
      ]},
      {variants:[
        {equipment:"free", name:"Single-Arm DB Row", target:"3 x 10-12 each", muscles:"Lats, mid back, rear delts", tip:"Drive elbow straight back toward hip. Full lat stretch at bottom.", alt:"Brace on your own thigh if no bench"},
        {equipment:"machine", name:"Single-Arm Hammer Strength Row", target:"3 x 10-12 each", muscles:"Lats, mid back, rear delts", tip:"One side at a time — chase an even squeeze, not weight.", alt:"Any iso-lateral plate-loaded row, or a single-arm cable row"},
      ]},
      {variants:[
        {equipment:"free", name:"Face Pulls/Band Pull-Aparts", target:"3 x 15-20", muscles:"Rear delts, external rotators, mid traps", tip:"Pull to forehead, elbows flared high. Never skip — keeps shoulders healthy.", alt:"Band pull-aparts anywhere"},
        {equipment:"machine", name:"Rear Delt Fly Machine", target:"3 x 15-20", muscles:"Rear delts, external rotators, mid traps", tip:"Lead with the elbows, thumbs pointing back.", alt:"Reverse pec deck, or a cable rear delt fly"},
      ]},
      {variants:[
        {equipment:"free", name:"Bicep Curls", target:"3 x 10-12", muscles:"Biceps, brachialis", tip:"Strict form, no swinging. Slow on the way down.", alt:"Resistance bands, EZ bar, hammer curls"},
        {equipment:"machine", name:"Preacher Curl Machine", target:"3 x 12-15", muscles:"Biceps, brachialis", tip:"Upper arms stay glued to the pad on every rep.", alt:"Cable curl at the low pulley, or a preacher bench with an EZ-bar"},
      ]},
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
      {variants:[
        {equipment:"free", name:"Back Squat/Goblet Squat", target:"4 x 6-10", muscles:"Quads, glutes, adductors, core", tip:"Depth matters. Knees track over toes. Brace core before every rep.", alt:"Goblet squat with one heavy dumbbell"},
        {equipment:"machine", name:"Leg Press Machine", target:"4 x 10-12", muscles:"Quads, glutes, adductors", tip:"Never slam into a hard knee lockout at the top.", alt:"Hack squat machine, or a Smith machine squat"},
      ]},
      {variants:[
        {equipment:"free", name:"Romanian Deadlift", target:"3 x 10-12", muscles:"Hamstrings, glutes, erectors", tip:"Hinge, not squat. Push hips back until deep hamstring stretch.", alt:"Two dumbbells if no barbell"},
        {equipment:"machine", name:"Seated Leg Curl Machine", target:"3 x 12-15", muscles:"Hamstrings", tip:"Pull the toes toward your shins to bias the hamstrings.", alt:"Lying leg curl machine"},
      ]},
      {variants:[
        {equipment:"free", name:"Bulgarian Split Squat", target:"3 x 8-10 each", muscles:"Quads, glutes, adductors — fixes imbalances", tip:"Rear foot elevated. Lower slowly, front knee tracks over toes.", alt:"Hold one or two dumbbells"},
        {equipment:"machine", name:"Single-Leg Leg Press", target:"3 x 10-12 each", muscles:"Quads, glutes — fixes imbalances", tip:"Foot centred on the platform, weight through the whole foot.", alt:"Leg press one leg at a time, or a Smith machine split squat"},
      ]},
      {variants:[
        {equipment:"free", name:"Glute Bridge/Hip Thrust", target:"3 x 12-15", muscles:"Glutes (primary), hamstrings", tip:"Drive through heels. Squeeze 1 sec at top, posterior pelvic tilt.", alt:"Floor glute bridge bodyweight, or DB on hips for load"},
        {equipment:"machine", name:"Hip Thrust Machine", target:"3 x 12-15", muscles:"Glutes (primary), hamstrings", tip:"Squeeze at the top and tuck the pelvis — don't arch the back.", alt:"Smith machine hip thrust, or a glute kickback machine"},
      ]},
      {variants:[
        {equipment:"free", name:"Standing Calf Raises", target:"4 x 15-20", muscles:"Gastrocnemius (outer calf)", tip:"Full stretch at bottom, pause 1 sec at top.", alt:"Use a step for full range, hold dumbbells for load"},
        {equipment:"machine", name:"Standing Calf Raise Machine", target:"4 x 15-20", muscles:"Gastrocnemius (outer calf)", tip:"Full stretch at the bottom, one-second hold at the top.", alt:"Calf raise on the leg press, or a Smith machine calf raise"},
      ]},
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
      {variants:[
        {equipment:"free", name:"Plank w/ Shoulder Taps", target:"3 x 30-45 sec", muscles:"Transverse abdominis, anti-rotation core", tip:"Keep hips perfectly still while tapping shoulders.", alt:"Standard plank if too hard initially"},
        {equipment:"machine", name:"Ab Crunch Machine", target:"3 x 15-20", muscles:"Rectus abdominis", tip:"Curl the spine — don't just hinge at the hips.", alt:"Kneeling cable crunch"},
      ]},
      {variants:[
        {equipment:"free", name:"Hanging Leg Raises", target:"3 x 10-12", muscles:"Lower rectus abdominis, hip flexors", tip:"No swinging. Tuck pelvis under at top — posterior tilt activates lower abs.", alt:"Lying straight leg raises on the floor"},
        {equipment:"machine", name:"Captain's Chair Leg Raise", target:"3 x 12-15", muscles:"Lower abs, hip flexors", tip:"Curl the pelvis at the top — that's what hits the lower abs.", alt:"Hanging leg raises from a bar, or lying leg raises"},
      ]},
      {variants:[
        {equipment:"free", name:"Ab Wheel/Dead Bug", target:"3 x 8-10", muscles:"Full anterior core", tip:"Ab wheel: only as far as you can control. Dead bug: lower opposite arm/leg, press lower back into floor.", alt:"Dead bug needs zero equipment"},
        {equipment:"machine", name:"Kneeling Cable Crunch", target:"3 x 12-15", muscles:"Full anterior core", tip:"Hips stay put — this is a spine curl, not a hip hinge.", alt:"Ab wheel rollout, or a dead bug on the floor"},
      ]},
      {variants:[
        {equipment:"free", name:"Cable/DB Woodchop", target:"3 x 12 each side", muscles:"Obliques, rotational core, serratus", tip:"Rotate through torso, not just arms.", alt:"Resistance band anchored to a door or post"},
        {equipment:"machine", name:"Torso Rotation Machine", target:"3 x 12-15 each side", muscles:"Obliques, rotational core", tip:"Go light and rotate from the ribs, not the arms.", alt:"Cable woodchop, or a band anchored to a post"},
      ]},
      {variants:[
        {equipment:"free", name:"Weighted Sit-ups/Bicycle Crunches", target:"3 x 15-20", muscles:"Upper rectus abdominis, obliques", tip:"Bicycle crunches: rotate fully, slow down — highest rectus activation of any ab move.", alt:"Bodyweight, hold a plate on chest for sit-ups"},
        {equipment:"machine", name:"Decline Ab Bench (Weighted)", target:"3 x 15-20", muscles:"Upper rectus abdominis, obliques", tip:"Curl up rounding the spine; hold a plate on the chest to load it.", alt:"Weighted sit-ups on the floor, or bicycle crunches"},
      ]},
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
      {variants:[
        {equipment:"free", name:"Conventional Deadlift", target:"3 x 5-6", muscles:"Erectors, glutes, hamstrings, traps, lats, core", tip:"Heavy day, lower reps. Hinge, brace, push the floor away. Bar drags against shins.", alt:"DB deadlift, or trap bar deadlift if available"},
      ]},
      {variants:[
        {equipment:"free", name:"Back Extensions/Good Mornings", target:"3 x 12-15", muscles:"Erectors (lower back), glutes, hamstrings", tip:"Fills the #1 gap of the week — isolated erector work. Don't hyperextend at top.", alt:"Over a stability ball, or Superman holds on the floor"},
      ]},
      {variants:[
        {equipment:"free", name:"Chest-Supported DB Row", target:"3 x 10-12", muscles:"Rhomboids, mid traps, rear delts, lats", tip:"Chest supported removes momentum. Squeeze shoulder blades, hold 1 sec.", alt:"Lie face down on incline bench, row both dumbbells"},
      ]},
      {variants:[
        {equipment:"free", name:"Farmer's Carries", target:"3 x 25-30 meters", muscles:"Upper traps, grip, core, calves", tip:"Walk tall, shoulders packed down and back.", alt:"Any two heavy dumbbells or kettlebells"},
      ]},
      {variants:[
        {equipment:"free", name:"Seated Calf Raises", target:"4 x 15-20", muscles:"Soleus (deep calf — different from Wed)", tip:"Deep stretch at bottom, 1 sec pause at top. Need both calf heads for full development.", alt:"Sit on a bench, dumbbell on knee, raise onto ball of foot"},
      ]},
    ],
    cardio:"10-15 min incline walk — Easy",
  },
};

/** The variant matching `equipment`, falling back to the free variant. */
export function variantFor(exercise, equipment) {
  return exercise.variants.find(v => v.equipment === equipment) || exercise.variants[0];
}

/** Every variant name across the whole plan, flattened. */
export function allVariantNames() {
  return dayOrder.flatMap(k => dayTemplates[k].exercises.flatMap(ex => ex.variants.map(v => v.name)));
}
