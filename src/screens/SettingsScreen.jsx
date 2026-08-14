import { useState } from "react";
import { Button, Card, ListItem, SegmentedButtons, TextField } from "../components/index.js";
import { getThemePref, setThemePref } from "../design/theme.js";
import { REST_TIMER_OPTIONS } from "../restTimer.js";
import { goalProgress, removeGoal } from "../userFeatures.js";
import "./SettingsScreen.css";

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const INCREMENTS = [
  { unit: "lb", label: "Pounds", options: [2.5, 5, 10] },
  { unit: "kg", label: "Kilograms", options: [1, 2.5, 5] },
];

export default function SettingsScreen({
  firebaseUser, version,
  progressionIncrements, updateProgressionIncrement,
  restTimerDefault, updateRestTimerDefault,
  allExNames, goalExercise, setGoalExercise,
  goalTarget, setGoalTarget, goalUnit, setGoalUnit,
  goalMsg, createTrainingGoal, trainingGoals,
  sessions, equipmentPrefs, saveAccountPrefs,
}) {
  const [theme, setTheme] = useState(getThemePref);

  function chooseTheme(preference) {
    setThemePref(preference);
    setTheme(preference);
  }

  return (
    <section className="settings" aria-labelledby="settings-title">
      <h1 id="settings-title" className="settings__heading">Settings</h1>
      <p className="settings__intro">
        Preferences are saved for {firebaseUser ? "your Google account" : "guest mode on this device"}.
      </p>

      <Card className="settings__card">
        <h2 className="settings__title">Appearance</h2>
        <p className="settings__help">System follows your phone's light or dark setting.</p>
        <ListItem
          title="Theme"
          subtitle={theme === "system" ? "Following your phone" : theme === "dark" ? "Always dark" : "Always light"}
        />
        <SegmentedButtons ariaLabel="Theme" options={THEME_OPTIONS} value={theme} onChange={chooseTheme} />
      </Card>

      <Card className="settings__card">
        <h2 className="settings__title">Progression increments</h2>
        <p className="settings__help">When you complete the top of an exercise's rep range, recommendations use these steps. Reductions use the same amount.</p>
        {INCREMENTS.map(({ unit, label, options }) => (
          <ListItem
            key={unit}
            title={label}
            subtitle={`Current step: ${progressionIncrements[unit]} ${unit}`}
            trailing={<SegmentedButtons ariaLabel={`${label} increment`} options={options.map(value => ({ value, label: String(value) }))} value={progressionIncrements[unit]} onChange={value => updateProgressionIncrement(unit, value)} />}
          />
        ))}
      </Card>

      <Card className="settings__card">
        <h2 className="settings__title">Rest timer</h2>
        <p className="settings__help">The timer starts automatically whenever you check off a set. A supported phone will vibrate when rest is complete.</p>
        <ListItem
          title="Default duration"
          subtitle={`${restTimerDefault} seconds after each set`}
          trailing={<SegmentedButtons ariaLabel="Default rest duration" options={REST_TIMER_OPTIONS.map(value => ({ value, label: `${value}s` }))} value={restTimerDefault} onChange={updateRestTimerDefault} />}
        />
      </Card>

      <Card className="settings__card">
        <h2 className="settings__title">Strength goals</h2>
        <p className="settings__help">Set a target weight for any exercise. Progress updates from saved sessions.</p>
        <div className="settings__goal-form">
          <label className="settings__select-wrap">
            <span className="settings__select-label">Exercise</span>
            <select className="settings__select" value={goalExercise} onChange={event => setGoalExercise(event.target.value)}>
              <option value="">Exercise…</option>
              {allExNames.map(name => <option key={name}>{name}</option>)}
            </select>
          </label>
          <TextField label="Target" type="number" inputMode="decimal" value={goalTarget} onChange={event => setGoalTarget(event.target.value)} />
          <label className="settings__select-wrap">
            <span className="settings__select-label">Unit</span>
            <select className="settings__select" value={goalUnit} onChange={event => setGoalUnit(event.target.value)}>
              <option>lb</option><option>kg</option>
            </select>
          </label>
          <Button variant="filled" onClick={createTrainingGoal}>Add goal</Button>
        </div>
        {goalMsg && <p className={`settings__msg ${goalMsg === "Goal added." ? "is-ok" : "is-err"}`}>{goalMsg}</p>}
        {trainingGoals.map(goal => {
          const progress = goalProgress(goal, sessions);
          return (
            <div key={goal.id} className="settings__goal">
              <ListItem
                title={`${progress.complete ? "✓ " : ""}${goal.exercise}`}
                subtitle={`${progress.best}/${goal.target} ${goal.unit} · ${progress.pct}%`}
                trailing={<Button variant="text" aria-label={`Remove ${goal.exercise} goal`} onClick={() => saveAccountPrefs(removeGoal(equipmentPrefs, goal.id))}>Remove</Button>}
              />
              <div className="settings__bar"><div className={`settings__bar-fill${progress.complete ? " is-complete" : ""}`} style={{ width: `${progress.pct}%` }} /></div>
            </div>
          );
        })}
      </Card>

      <p className="settings__version">Pocket Gym Log · v{version}</p>
    </section>
  );
}
