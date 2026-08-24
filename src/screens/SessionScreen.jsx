import { useEffect } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { Button, LibraryPickerSheet, Sheet } from "../components/index.js";
import { dayOrder, dayTemplates, variantFor, exerciseForVariantName } from "../data/exercises.js";
import { MUSCLES, formGuide } from "../data/formGuide.js";
import { guideFor } from "../data/exerciseGuide.js";
import { loadExerciseLibrary } from "../data/exerciseLibraryLoader.js";
import { countEnteredSets, RPE_OPTIONS } from "../draft.js";
import { trackingForExercise, trackingLabels, TRACKING_TYPES } from "../exerciseTracking.js";
import { REST_TIMER_OPTIONS } from "../restTimer.js";
import { readinessScore } from "../userFeatures.js";
import "./SessionScreen.css";

const PLATE_SETS = {
  lb: { bar: 45, plates: [45, 35, 25, 10, 5, 2.5] },
  kg: { bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] },
};

function calcPlates(total, unit) {
  const { bar, plates } = PLATE_SETS[unit] || PLATE_SETS.lb;
  if (isNaN(total) || total <= bar) return { perSide: [], leftover: 0, bar };
  let rem = (total - bar) / 2;
  const result = [];
  for (const p of plates) {
    let count = 0;
    while (rem + 1e-9 >= p) { rem -= p; count++; }
    if (count > 0) result.push({ plate: p, count });
  }
  return { perSide: result, leftover: Math.round(rem * 100) / 100, bar };
}

function BodyMap({ view = "front", primary = [], secondary = [], color = "#3B82F6" }) {
  const fill = id => primary.includes(id) ? color : secondary.includes(id) ? color + "66" : "#1C1D2A";
  const strk = id => (primary.includes(id) || secondary.includes(id)) ? color : "#23243A";

  if (view === "back") return (
    <svg viewBox="0 0 120 220" className="session-bodymap__svg">
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
    <svg viewBox="0 0 120 220" className="session-bodymap__svg">
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

function GuideSection({ icon, title, items }) {
  return (
    <div className="session-guide-section">
      <div className="session-guide-section__title"><span>{icon}</span>{title}</div>
      {items.map((c, i) => (
        <div key={i} className="session-guide-section__item">
          <span className="session-guide-section__num">{i + 1}</span>
          <span>{c}</span>
        </div>
      ))}
    </div>
  );
}

export default function SessionScreen({
  draft, setDraft, dayMeta, currentDay, switchDay,
  confirmExitSession, setConfirmExitSession, leaveSession, sessionHistoryRef,
  draftSavedAt, confirmDiscardDraft, setConfirmDiscardDraft, discardDraft,
  showCoach, setShowCoach, showWarmup, setShowWarmup,
  sessionSheet, setSessionSheet,
  restRunning, restSeconds, restTarget, setRestTarget, setRestSeconds, restComplete, setRestComplete, setRestRunning,
  startRestTimer, stopRestTimer, addRestTime, updateRestTimerDefault,
  activeExercise, setActiveExercise, draftFilled,
  prMap, getLastTime, copyLastTime, progressionIncrements, sessions,
  moveDraftExercise, removeDraftExercise,
  confirmSwitch, setConfirmSwitch, requestEquipmentSwitch, applyEquipmentSwitch,
  toggleSetDone, updateSet, removeSet, addSet,
  plateFor, setPlateFor,
  guideExercise, setGuideExercise, guideImageIndex, toggleGuideImage, openGuide,
  customExercises, customExerciseId, setCustomExerciseId, addSavedCustomExercise, addLibraryExercise,
  newExerciseName, setNewExerciseName, newExerciseTarget, setNewExerciseTarget, createAndAddExercise,
  templateName, setTemplateName, storeWorkoutTemplate, workoutTemplates, pendingTemplate, setPendingTemplate, applySavedWorkoutTemplate,
  workoutToolsMsg,
  readiness, setReadiness,
  saveSession, draftHasContent, getProgressionRecommendation,
}) {
  const draftFilledCount = draftFilled;
  const draftGuideExercise = guideExercise && draft.exercises.find(ex => ex.name === guideExercise);
  const guide = guideExercise && guideFor(guideExercise, draftGuideExercise);

  useEffect(() => {
    if (draft.exercises.some(ex => ex.libraryId)) loadExerciseLibrary().catch(() => {});
  }, [draft.exercises]);

  return (
    <div className="session-screen" style={{ "--day-accent": dayMeta.color }}>
      {confirmExitSession && (
        <div className="session-exit-confirm" role="alertdialog" aria-label="Exit workout">
          <div><strong>Leave this workout?</strong><span>Your draft stays saved on this device.</span></div>
          <Button variant="text" onClick={leaveSession}>Leave</Button>
          <Button variant="text" onClick={() => {
            window.history.pushState({ workoutSession: true }, "");
            sessionHistoryRef.current = true;
            setConfirmExitSession(false);
          }}>Keep training</Button>
        </div>
      )}

      <div className="session-toolbar">
        <Button variant="text" icon={<CalendarDays size={17} />} onClick={() => setSessionSheet("details")}>Workout details</Button>
        <Button variant="text" icon={<SlidersHorizontal size={17} />} onClick={() => setSessionSheet("options")}>Session options</Button>
      </div>

      <div className="day-switcher" role="group" aria-label="Choose workout day">
        {dayOrder.map(k => {
          const t = dayTemplates[k]; const active = currentDay === k;
          return (
            <button key={k} className={`day-switcher__btn${active ? " is-active" : ""}`} style={{ "--btn-accent": t.color }} onClick={() => switchDay(k)} aria-pressed={active} aria-label={`${k} · ${t.label}`}>
              <span className="day-switcher__emoji">{t.emoji}</span>{k}
            </button>
          );
        })}
      </div>

      {draftHasContent(draft) && (
        <div className="session-draft-banner">
          <span className="session-draft-banner__msg">
            {draftSavedAt ? "Draft saved on this device · " + new Date(draftSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Saving draft…"}
          </span>
          {confirmDiscardDraft ? (
            <span className="session-draft-banner__confirm">
              <span>Discard entered workout?</span>
              <Button variant="filled" className="session-draft-banner__destructive" onClick={discardDraft}>Discard</Button>
              <Button variant="text" onClick={() => setConfirmDiscardDraft(false)}>Cancel</Button>
            </span>
          ) : (
            <button className="session-draft-banner__link" onClick={() => setConfirmDiscardDraft(true)}>Discard draft</button>
          )}
        </div>
      )}

      <div className="session-legacy-details" aria-hidden="true">
        <div className="session-legacy-card">
          <div className="session-legacy-card__row">
            <div>
              <div className="session-legacy-card__title">{dayMeta.emoji} {dayMeta.label}</div>
              <div className="session-legacy-card__sub">{dayMeta.focus}</div>
            </div>
            <button className="session-legacy-card__toggle" onClick={() => setShowCoach(v => !v)}>{showCoach ? "Hide" : "Coach"}</button>
          </div>
          {showCoach && <div className="session-legacy-card__body">
            <div>📋 {dayMeta.coachNote}</div>
            <div>🏃 Cardio: {dayMeta.cardio}</div>
          </div>}
        </div>

        <div className="session-legacy-card">
          <label>Date</label>
          <input type="date" value={draft.date} onChange={e => setDraft(p => ({ ...p, date: e.target.value }))} />
        </div>

        <div className="session-legacy-card">
          <div>
            <div className="session-legacy-card__title">⏱ Rest timer</div>
            <div className="session-legacy-card__sub">{restRunning ? `${fmtRest(Math.max(0, restTarget - restSeconds))} remaining` : restComplete ? "Rest complete" : "Starts automatically when you check off a set"}</div>
          </div>
          <div>
            {REST_TIMER_OPTIONS.map(value => <button key={value} onClick={() => startRestTimer(value)}>{value}s</button>)}
            {(restRunning || restComplete) && <button onClick={stopRestTimer}>×</button>}
          </div>
        </div>

        {dayMeta.warmup && (
          <div className="session-legacy-card">
            <div className="session-legacy-card__row">
              <div><span>🤸</span><div><div className="session-legacy-card__title">Warm-Up</div><div className="session-legacy-card__sub">~5-8 min · do this before set 1</div></div></div>
              <button className="session-legacy-card__toggle" onClick={() => setShowWarmup(v => !v)}>{showWarmup ? "Hide" : "Show"}</button>
            </div>
            {showWarmup && <div className="session-legacy-card__body">
              <div>🔥 <b>General:</b> {dayMeta.warmup.general}</div>
              {dayMeta.warmup.drills.map((d, i) => (
                <div key={i}><span>{i + 1}</span><div><span>{d.name}</span><span> — {d.detail}</span></div></div>
              ))}
            </div>}
          </div>
        )}
      </div>

      <div className="session-exercise-nav" aria-label="Exercise navigation">
        <Button variant="text" aria-label="Previous exercise" disabled={activeExercise === 0} onClick={() => setActiveExercise(index => Math.max(0, index - 1))}><ChevronLeft size={20} /></Button>
        <div><strong>Exercise {activeExercise + 1} of {draft.exercises.length}</strong><span>{draftFilledCount} completed set{draftFilledCount === 1 ? "" : "s"}</span></div>
        <Button variant="text" aria-label="Next exercise" disabled={activeExercise === draft.exercises.length - 1} onClick={() => setActiveExercise(index => Math.min(draft.exercises.length - 1, index + 1))}><ChevronRight size={20} /></Button>
      </div>

      {draft.exercises.map((ex, ei) => {
        const family = exerciseForVariantName(ex.name);
        const planEx = family ? variantFor(family, ex.equipment) : { name: ex.name, equipment: "custom", target: ex.target || "3 x 8-12", tip: ex.tip || "Custom exercise" };
        const tracking = trackingForExercise({ ...ex, target: planEx.target });
        const trackingCopy = trackingLabels(tracking);
        const variants = family ? family.variants : [planEx];
        const pr = prMap[ex.name];
        const last = getLastTime(ex.name);
        const progression = last && getProgressionRecommendation(last.sets, planEx.target, progressionIncrements);
        return (
          <div className={`workout-card ${ei === activeExercise ? "is-active" : "is-collapsed"}`} key={ei}>
            <div className="exercise-head">
              <button className="session-exercise-name" onClick={() => (formGuide[ex.name] || ex.libraryId) && openGuide(ex.name)} disabled={!(formGuide[ex.name] || ex.libraryId)}>
                <span className="session-exercise-name__label">{ex.name}</span>
                {(formGuide[ex.name] || ex.libraryId) && <span className="session-exercise-name__badge">ⓘ form</span>}
              </button>
              <div className="exercise-actions">
                <button className="session-open-exercise" onClick={() => setActiveExercise(ei)}>{ex.sets.filter(set => set.done).length}/{ex.sets.length} sets{ei === activeExercise ? "" : " · Open"}</button>
                <div className="session-target-pill">Target: {planEx.target}</div>
                <span className="session-tracking-pill" title={trackingCopy.help} data-weighted={tracking === TRACKING_TYPES.WEIGHTED}>{tracking}</span>
                <button className="session-icon-btn" onClick={() => moveDraftExercise(ei, -1)} disabled={ei === 0} title="Move up">↑</button>
                <button className="session-icon-btn" onClick={() => moveDraftExercise(ei, 1)} disabled={ei === draft.exercises.length - 1} title="Move down">↓</button>
                <button className="session-icon-btn session-icon-btn--danger" onClick={() => removeDraftExercise(ei)} disabled={draft.exercises.length <= 1} title="Remove exercise">×</button>
              </div>
            </div>

            {variants.length > 1 && (
              <div className="session-variant-row">
                {variants.map(v => {
                  const on = ex.equipment === v.equipment;
                  return (
                    <button key={v.equipment} className={`session-variant-btn${on ? " is-on" : ""}`} onClick={() => requestEquipmentSwitch(ei, v.equipment)}>
                      {v.equipment === "free" ? "Free" : "Machine"}
                    </button>
                  );
                })}
              </div>
            )}

            {confirmSwitch && confirmSwitch.ei === ei && (
              <div className="session-switch-confirm">
                <div className="session-switch-confirm__body">
                  Switch to {confirmSwitch.equipment === "machine" ? "the machine" : "free weights"}? The {countEnteredSets(ex.sets)} set{countEnteredSets(ex.sets) !== 1 ? "s" : ""} you've entered will be cleared.
                </div>
                <div className="session-switch-confirm__actions">
                  <Button variant="filled" onClick={() => applyEquipmentSwitch(ei, confirmSwitch.equipment)}>Switch</Button>
                  <Button variant="text" onClick={() => setConfirmSwitch(null)}>Cancel</Button>
                </div>
              </div>
            )}

            {pr && <div className="session-pr-line">🏆 Best: {pr.weight}{ex.sets[0]?.unit || "lb"} × {pr.reps} ({pr.date})</div>}

            {last && (
              <div className="session-last-row">
                <span className="session-last-row__label">↩ Last ({last.date.slice(5)}):</span>
                <div className="session-last-row__chips">
                  {last.sets.map((s, j) => <span key={j}>{s.weight ? `${s.weight}${s.unit} × ` : ""}{s.reps || "0"}{tracking === TRACKING_TYPES.TIMED ? " sec" : tracking === TRACKING_TYPES.DISTANCE ? " m" : " reps"}</span>)}
                </div>
                <button className="session-copy-last" onClick={() => copyLastTime(ei, ex.name)}>Copy last</button>
              </div>
            )}

            {progression && (
              <div className={`session-progression session-progression--${progression.action}`}>
                <span className="session-progression__label">↗ {progression.label}: </span>{progression.message}
              </div>
            )}

            {ex.sets.map((set, si) => {
              const isPR = pr && parseFloat(set.weight) > pr.weight;
              const pKey = ei + "-" + si;
              const pOpen = plateFor === pKey;
              const pData = pOpen ? calcPlates(parseFloat(set.weight), set.unit) : null;
              return (
                <div key={si} className="session-set-wrap">
                  <div className="set-row">
                    <button className={`session-set-toggle${set.done ? " is-done" : ""}`} onClick={() => toggleSetDone(ei, si)} aria-label={`${set.done ? "Mark incomplete" : "Complete"} set ${si + 1}${set.done ? "" : " and start rest timer"}`} title={set.done ? "Mark this set incomplete" : "Mark this set done and start the rest timer"}>
                      {set.done ? "✓ Done" : `Set ${si + 1}`}
                    </button>
                    <input className={`session-set-input${isPR ? " is-pr" : ""}`} type="number" inputMode="decimal" placeholder={trackingCopy.weight + (tracking === TRACKING_TYPES.WEIGHTED ? "" : " (optional)")} value={set.weight} onChange={e => updateSet(ei, si, "weight", e.target.value)} />
                    <button className={`session-plate-btn${pOpen ? " is-open" : ""}`} onClick={() => setPlateFor(pOpen ? null : pKey)} disabled={!parseFloat(set.weight)} title="Plate calculator">🏋</button>
                    <select className="session-set-unit" value={set.unit} onChange={e => updateSet(ei, si, "unit", e.target.value)}>
                      <option value="lb">lb</option><option value="kg">kg</option>
                    </select>
                    <input className="session-set-input" type="number" inputMode="numeric" placeholder={trackingCopy.measure} value={set.reps} onChange={e => updateSet(ei, si, "reps", e.target.value)} />
                    <select className="session-set-rpe" aria-label={`RPE for set ${si + 1}`} value={set.rpe ?? ""} onChange={e => updateSet(ei, si, "rpe", e.target.value ? Number(e.target.value) : null)}>
                      <option value="">RPE</option>
                      {RPE_OPTIONS.map(value => <option key={value} value={value}>{value}</option>)}
                    </select>
                    <button className="session-set-remove" onClick={() => removeSet(ei, si)} disabled={ex.sets.length <= 1}>×</button>
                  </div>
                  {pOpen && pData && (
                    <div className="session-plates">
                      {pData.perSide.length === 0
                        ? <span>At or below bar weight ({pData.bar}{set.unit}) — no plates needed.</span>
                        : <div>
                            <span className="session-plates__label">Per side ({pData.bar}{set.unit} bar): </span>
                            {pData.perSide.map((p, k) => <span key={k} className="session-plates__item">{p.count}×{p.plate}{k < pData.perSide.length - 1 ? "  ·  " : ""}</span>)}
                            {pData.leftover > 0 && <span className="session-plates__leftover">(+{pData.leftover}{set.unit} unmatched)</span>}
                          </div>
                      }
                    </div>
                  )}
                </div>
              );
            })}

            <button className="session-add-set" onClick={() => addSet(ei)}>+ Add Set</button>
            <div className="session-tip">💡 {planEx.tip}</div>
          </div>
        );
      })}

      <div className="session-tools">
        <div className="session-tools__title">CUSTOMIZE WORKOUT</div>
        {customExercises.length > 0 && <div className="session-tools__row">
          <select className="session-tools__select" value={customExerciseId} onChange={e => setCustomExerciseId(e.target.value)}><option value="">Add a saved exercise…</option>{customExercises.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <Button variant="filled" onClick={addSavedCustomExercise} disabled={!customExerciseId}>Add</Button>
        </div>}
        <div className="session-tools__row">
          <Button variant="text" onClick={() => setSessionSheet("library")}>Search exercise library</Button>
        </div>
        <div className="session-tools__grid">
          <input className="session-tools__input" value={newExerciseName} onChange={e => setNewExerciseName(e.target.value)} placeholder="New exercise name" />
          <input className="session-tools__input" value={newExerciseTarget} onChange={e => setNewExerciseTarget(e.target.value)} placeholder="3 x 8-12" />
          <Button variant="text" onClick={createAndAddExercise}>Create + add</Button>
        </div>
        <div className="session-tools__templates">
          <div className="session-tools__row">
            <input className="session-tools__input" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name (e.g. Quick Push)" />
            <Button variant="text" onClick={storeWorkoutTemplate}>Save current template</Button>
          </div>
          {workoutTemplates.map(template => (
            <div key={template.id} className="session-template-row">
              <div><div className="session-template-row__name">{template.name}</div><div className="session-template-row__count">{template.exercises.length} exercise{template.exercises.length !== 1 ? "s" : ""}</div></div>
              {pendingTemplate?.id === template.id ? (
                <div className="session-template-row__confirm">
                  <span>Replace current draft?</span>
                  <Button variant="filled" onClick={() => applySavedWorkoutTemplate(template)}>Apply</Button>
                  <Button variant="text" onClick={() => setPendingTemplate(null)}>Cancel</Button>
                </div>
              ) : (
                <Button variant="text" onClick={() => draftHasContent(draft) ? setPendingTemplate(template) : applySavedWorkoutTemplate(template)}>Use template</Button>
              )}
            </div>
          ))}
        </div>
        {workoutToolsMsg && <div className={`session-tools__msg${workoutToolsMsg.includes("exists") || workoutToolsMsg.startsWith("Enter") ? " is-error" : ""}`}>{workoutToolsMsg}</div>}
      </div>

      <div className="session-readiness">
        <div className="session-readiness__head">
          <div><div className="session-readiness__title">READINESS CHECK-IN</div><div className="session-readiness__hint">Optional · saved with this workout</div></div>
          <div className={`session-readiness__score session-readiness__score--${readinessScore(readiness) >= 70 ? "good" : readinessScore(readiness) >= 50 ? "ok" : "low"}`}>{readinessScore(readiness)}%</div>
        </div>
        <div className="session-readiness__grid">
          {[["energy", "Energy"], ["sleep", "Sleep"], ["soreness", "Soreness"]].map(([key, label]) => (
            <label key={key} className="session-readiness__field">{label}
              <select value={readiness[key]} onChange={event => setReadiness(value => ({ ...value, [key]: Number(event.target.value) }))}>
                {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value}/5</option>)}
              </select>
            </label>
          ))}
        </div>
        <label className={`session-readiness__pain${readiness.pain ? " is-active" : ""}`}><input type="checkbox" checked={readiness.pain} onChange={event => setReadiness(value => ({ ...value, pain: event.target.checked }))} /> Pain or unusual discomfort today</label>
      </div>

      <div className="session-notes">
        <div className="session-notes__title">Session Notes (optional)</div>
        <textarea className="session-notes__input" value={draft.notes} onChange={e => setDraft(p => ({ ...p, notes: e.target.value }))} placeholder="How did it feel? Energy, soreness..." rows={2} />
      </div>

      <button className="session-save" onClick={saveSession}>
        Save Session{draftFilledCount > 0 ? "  ·  " + draftFilledCount + " set" + (draftFilledCount !== 1 ? "s" : "") : ""}
      </button>

      <Sheet open={sessionSheet === "details"} title="Workout details" onClose={() => setSessionSheet(null)}>
        <div className="session-sheet-section">
          <label className="session-sheet-date"><span>Training date</span><input type="date" value={draft.date} onChange={event => setDraft(previous => ({ ...previous, date: event.target.value }))} /></label>
        </div>
        <div className="session-sheet-section"><h3>{dayMeta.emoji} {dayMeta.label}</h3><p>{dayMeta.focus}</p><p>{dayMeta.coachNote}</p><small>Cardio: {dayMeta.cardio}</small></div>
        {dayMeta.warmup && <div className="session-sheet-section"><h3>Warm-up</h3><p>{dayMeta.warmup.general}</p><ol>{dayMeta.warmup.drills.map(drill => <li key={drill.name}><strong>{drill.name}</strong><span>{drill.detail}</span></li>)}</ol></div>}
      </Sheet>

      <Sheet open={sessionSheet === "options"} title="Session options" onClose={() => setSessionSheet(null)}>
        <div className="session-sheet-section"><h3>Rest timer</h3><p>Choose the default used after completing a set.</p><div className="session-sheet-actions">{REST_TIMER_OPTIONS.map(value => <Button key={value} variant={restTarget === value ? "filled" : "text"} onClick={() => { setRestTarget(value); updateRestTimerDefault(value); }}>{value}s</Button>)}</div></div>
        <div className="session-sheet-section"><h3>Draft</h3><p>Your workout is saved automatically on this device.</p><Button variant="text" onClick={() => { setSessionSheet(null); setConfirmDiscardDraft(true); }}>Discard workout</Button></div>
      </Sheet>

      <LibraryPickerSheet
        open={sessionSheet === "library"}
        onClose={() => setSessionSheet(null)}
        onSelect={entry => { addLibraryExercise(entry); setSessionSheet(null); }}
        sessions={sessions}
      />

      {(restRunning || restComplete) && (
        <div className="rest-dock" data-complete={restComplete}>
          <div className="rest-dock__label">{restComplete ? "REST COMPLETE" : "REST"}</div>
          <div className="rest-dock__time">{fmtRest(Math.max(0, restTarget - restSeconds))}</div>
          <div className="rest-dock__opts">
            {REST_TIMER_OPTIONS.map(t => <button key={t} className={`rest-dock__opt${restTarget === t && !restComplete ? " is-active" : ""}`} onClick={() => { setRestTarget(t); setRestSeconds(0); setRestComplete(false); setRestRunning(true); }}>{t}s</button>)}
            <button className="rest-dock__opt" onClick={() => addRestTime(30)}>+30s</button>
          </div>
          <button className="rest-dock__close" aria-label="Close rest timer" onClick={stopRestTimer}><X size={18} /></button>
        </div>
      )}

      {guide && (() => {
        const g = guide;
        return (
          <div className="session-guide" onClick={() => setGuideExercise(null)}>
            <div className="session-guide__sheet" onClick={e => e.stopPropagation()}>
              <div className="session-guide__head">
                <div className="session-guide__title">{guideExercise}</div>
                <button className="session-guide__close" onClick={() => setGuideExercise(null)}>×</button>
              </div>
              <div className="session-guide__body">
                <div className="session-guide__cols">
                  <div>
                    <div className="session-bodymap">
                      <div className="session-bodymap__label">MUSCLES · {g.view === "back" ? "BACK" : "FRONT"}</div>
                      <BodyMap view={g.view} primary={g.primary} secondary={g.secondary} color={dayMeta.color} />
                      <div className="session-bodymap__legend">
                        {g.primary.map(m => <span key={m} className="session-bodymap__chip session-bodymap__chip--primary">{MUSCLES[m]}</span>)}
                        {g.secondary.map(m => <span key={m} className="session-bodymap__chip session-bodymap__chip--secondary">{MUSCLES[m]}</span>)}
                      </div>
                      <div className="session-bodymap__caption">● primary ○ secondary</div>
                    </div>
                    {g.kind === "library" && (
                      <button type="button" className="session-guide-image" onClick={toggleGuideImage}>
                        <img className="session-guide-image__img" src={g.images[guideImageIndex]} alt={`${guideExercise} demonstration`} onError={e => { e.target.style.display = "none"; }} />
                        <div className="session-guide-image__hint">Tap to see {guideImageIndex === 0 ? "end" : "start"} position</div>
                      </button>
                    )}
                  </div>
                  <div>
                    {g.kind === "authored" ? (
                      <>
                        <GuideSection icon="🧩" title="SETUP & POSITION" items={g.setup} />
                        <GuideSection icon="🎯" title="EXECUTION" items={g.execution} />
                        <div className="session-guide-breathing">
                          <div className="session-guide-breathing__title">💨 BREATHING</div>
                          <div>{g.breathing}</div>
                        </div>
                        <div className="session-guide-mistakes">
                          <div className="session-guide-mistakes__title">⚠️ COMMON MISTAKES</div>
                          {g.mistakes.map((c, i) => (
                            <div key={i} className="session-guide-mistakes__item"><span>✕</span><span>{c}</span></div>
                          ))}
                        </div>
                      </>
                    ) : (
                      g.instructions.length > 0 && <GuideSection icon="📋" title="INSTRUCTIONS" items={g.instructions} />
                    )}
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

function fmtRest(sec) { return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); }
