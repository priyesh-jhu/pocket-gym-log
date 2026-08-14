import { ArrowRight, Flame, Play, Trophy } from "lucide-react";
import { Button, Card, Chip, StatTile } from "../components/index.js";
import MuscleHeatmap from "../MuscleHeatmap.jsx";
import { currentStreak, dominantUnit, muscleFreshness, personalRecords, weekVolumeDelta } from "../stats.js";
import { trainingInsights } from "../trainingInsights.js";
import "./HomeScreen.css";

function displayVolume(value, unit) {
  const converted = unit === "kg" ? value / 2.20462 : value;
  return Math.round(converted).toLocaleString();
}

export default function HomeScreen({ sessions, dayMeta, displayName, hasDraft, draftSavedAt, onStart, onProgress }) {
  const week = weekVolumeDelta(sessions);
  const streak = currentStreak(sessions);
  const unit = dominantUnit(sessions);
  const freshness = muscleFreshness(sessions);
  const records = personalRecords(sessions, 3);
  const insight = trainingInsights(sessions, 1)[0];
  const firstName = displayName?.trim().split(/\s+/)[0];
  const delta = week.deltaPct === null ? "No prior-week baseline" : `${week.deltaPct >= 0 ? "+" : ""}${week.deltaPct}% vs last week`;

  return (
    <section className="home-screen" aria-labelledby="home-greeting">
      <div className="home-screen__intro">
        <div><p className="home-screen__eyebrow">Ready when you are</p><h2 id="home-greeting">{firstName ? `Hi, ${firstName}` : "Your training, today"}</h2></div>
        <Chip selected><Flame size={14} /> {streak.current} day streak</Chip>
      </div>

      <Card variant="raised" className="home-hero">
        <p>This week's volume</p>
        <strong>{displayVolume(week.volume, unit)}</strong><span>{unit}</span>
        <Chip>{delta}</Chip>
      </Card>

      <Card variant="raised" className="home-plan">
        <div className="home-plan__head"><div><p>Today's plan</p><h3>{dayMeta.emoji} {dayMeta.label}</h3><span>{dayMeta.focus}</span></div><span className="home-plan__dot" style={{ background: dayMeta.color }} /></div>
        <Button block onClick={onStart} icon={<Play size={19} fill="currentColor" />}>{hasDraft ? "Resume workout" : "Start workout"}</Button>
        {hasDraft && draftSavedAt && <small>Draft saved {new Date(draftSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small>}
      </Card>

      <button type="button" className="home-heatmap" onClick={onProgress}>
        <div className="home-section-title"><div><h3>Muscle freshness</h3><p>Volt areas are ready to train</p></div><ArrowRight size={19} /></div>
        <MuscleHeatmap scores={freshness} mode="freshness" height={172} />
      </button>

      {insight && <Card className="home-insight"><p>Training insight</p><strong>{insight.name}</strong><span>{insight.message}</span></Card>}

      <div className="home-section-title"><div><h3>Recent records</h3><p>Your newest all-time bests</p></div><Trophy size={19} /></div>
      {records.length ? <div className="home-records">{records.map(record => <StatTile key={`${record.date}-${record.name}`} value={`${record.weight} ${record.unit}`} label={record.name} supporting={`${record.reps} reps · ${record.date}`} accent />)}</div> : <Card variant="outlined" className="home-empty">Save workouts to begin tracking records.</Card>}
    </section>
  );
}
