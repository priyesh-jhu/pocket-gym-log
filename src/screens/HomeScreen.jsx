import { ArrowRight, Flame, Play, Trophy } from "lucide-react";
import { Button, Card, Chip, SegmentedButtons, StatTile } from "../components/index.js";
import MuscleHeatmap from "../MuscleHeatmap.jsx";
import { currentStreak, dominantUnit, lastSameDaySummary, monthSummary, muscleFreshness, muscleSetVolume, musclePriorities, personalRecords, weekVolumeDelta } from "../stats.js";
import { MUSCLES } from "../data/formGuide.js";
import { deloadReminder } from "../deloadInsight.js";
import { todayISO } from "../dateUtils.js";
import { trainingInsights } from "../trainingInsights.js";
import { grindingInsights } from "../rpeInsights.js";
import { useState } from "react";
import "./HomeScreen.css";

function displayVolume(value, unit) {
  const converted = unit === "kg" ? value / 2.20462 : value;
  return Math.round(converted).toLocaleString();
}

export default function HomeScreen({ sessions, dayMeta, currentDay, displayName, hasDraft, draftSavedAt, onStart, onProgress }) {
  const week = weekVolumeDelta(sessions);
  const streak = currentStreak(sessions);
  const unit = dominantUnit(sessions);
  const freshness = muscleFreshness(sessions);
  const overdue = musclePriorities(muscleSetVolume(sessions, 7))
    .filter(item => item.daysSince !== null && item.daysSince >= 4)
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 2);
  const deload = deloadReminder(sessions);
  const records = personalRecords(sessions, 3);
  const insight = trainingInsights(sessions, 1)[0];
  const grinding = grindingInsights(sessions, 1)[0];
  const firstName = displayName?.trim().split(/\s+/)[0];
  const [range, setRange] = useState("week");
  const month = monthSummary(sessions);
  const activeSummary = range === "week" ? week : month;
  const activeLabel = range === "week" ? "week" : "month";
  const activeDelta = activeSummary.deltaPct === null
    ? "No prior-period baseline"
    : `${activeSummary.deltaPct >= 0 ? "+" : ""}${activeSummary.deltaPct}% volume vs last ${activeLabel}`;
  const sameDay = lastSameDaySummary(sessions, currentDay, todayISO());

  return (
    <section className="home-screen" aria-labelledby="home-greeting">
      <div className="home-screen__intro">
        <div><p className="home-screen__eyebrow">Ready when you are</p><h2 id="home-greeting">{firstName ? `Hi, ${firstName}` : "Your training, today"}</h2></div>
        <Chip selected><Flame size={14} /> {streak.current} day streak</Chip>
      </div>

      <Card variant="raised" className="home-hero">
        <div className="home-hero__head">
          <p>You trained {activeSummary.sessions}× this {activeLabel}</p>
          <SegmentedButtons
            ariaLabel="Summary range"
            options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }]}
            value={range}
            onChange={setRange}
          />
        </div>
        <strong>{displayVolume(activeSummary.volume, unit)}</strong><span>{unit}</span>
        <Chip>{activeDelta}</Chip>
      </Card>

      <Card variant="raised" className="home-plan">
        <div className="home-plan__head"><div><p>Today's plan</p><h3>{dayMeta.emoji} {dayMeta.label}</h3><span>{dayMeta.focus}</span></div><span className="home-plan__dot" style={{ background: dayMeta.color }} /></div>
        <Button block onClick={onStart} icon={<Play size={19} fill="currentColor" />}>{hasDraft ? "Resume workout" : "Start workout"}</Button>
        {hasDraft && draftSavedAt && <small>Draft saved {new Date(draftSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small>}
        {sameDay && <small className="home-plan__lastday">Last {dayMeta.label} day ({sameDay.date}): {displayVolume(sameDay.volume, unit)} {unit} total</small>}
      </Card>

      <button type="button" className="home-heatmap" onClick={onProgress}>
        <div className="home-section-title"><div><h3>Muscle freshness</h3><p>Volt areas are ready to train</p></div><ArrowRight size={19} /></div>
        <MuscleHeatmap scores={freshness} mode="freshness" height={172} />
        {overdue.length === 2 && (
          <div className="home-heatmap__overdue">
            <span>Overdue:</span>
            {overdue.map(item => <Chip key={item.muscle}>{MUSCLES[item.muscle] || item.muscle} ({item.daysSince}d)</Chip>)}
          </div>
        )}
      </button>

      {insight && <Card className="home-insight"><p>Training insight</p><strong>{insight.name}</strong><span>{insight.message}</span></Card>}
      {grinding && <Card className="home-insight"><p>Effort check</p><strong>{grinding.name}</strong><span>{grinding.message}</span></Card>}
      {deload && <Card className="home-insight"><p>Recovery signal</p><span>{deload.message}</span></Card>}

      <div className="home-section-title"><div><h3>Recent records</h3><p>Your newest all-time bests</p></div><Trophy size={19} /></div>
      {records.length ? <div className="home-records">{records.map(record => <StatTile key={`${record.date}-${record.name}`} value={`${record.weight} ${record.unit}`} label={record.name} supporting={`${record.reps} reps · ${record.date}`} accent />)}</div> : <Card variant="outlined" className="home-empty">Save workouts to begin tracking records.</Card>}
    </section>
  );
}
