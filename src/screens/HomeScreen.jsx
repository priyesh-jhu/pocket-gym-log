import { ArrowRight, Flame, Play, Trophy } from "lucide-react";
import { Button, Card, Chip, SegmentedButtons, StatTile } from "../components/index.js";
import MuscleHeatmap from "../MuscleHeatmap.jsx";
import { currentStreak, dominantUnit, monthSummary, muscleFreshness, muscleSetVolume, musclePriorities, personalRecords, recentDaysHeat, sameDayTrend, weekVolumeDelta } from "../stats.js";
import { MUSCLES } from "../data/formGuide.js";
import { deloadReminder } from "../deloadInsight.js";
import { trainingInsights } from "../trainingInsights.js";
import { grindingInsights } from "../rpeInsights.js";
import { useState } from "react";
import "./HomeScreen.css";

function displayVolume(value, unit) {
  const converted = unit === "kg" ? value / 2.20462 : value;
  return Math.round(converted).toLocaleString();
}

function weekdayLetter(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString([], { weekday: "narrow" });
}

function DayTrendSparkline({ points, unit }) {
  const max = Math.max(1, ...points.map(point => point.volume));
  return (
    <div className="home-day-trend__bars">
      {points.map(point => (
        <div key={point.date} className="home-day-trend__bar-wrap" title={`${point.date}: ${displayVolume(point.volume, unit)} ${unit}`}>
          <div className="home-day-trend__bar" style={{ height: `${Math.max(6, Math.round((point.volume / max) * 100))}%` }} />
        </div>
      ))}
    </div>
  );
}

export default function HomeScreen({ sessions, dayMeta, currentDay, displayName, hasDraft, draftSavedAt, onStart, onProgress }) {
  const week = weekVolumeDelta(sessions);
  const streak = currentStreak(sessions);
  const unit = dominantUnit(sessions);
  const freshness = muscleFreshness(sessions);
  const overdue = musclePriorities(muscleSetVolume(sessions, 28))
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
  const dayTrend = sameDayTrend(sessions, currentDay, 8);
  const lastTwo = dayTrend.slice(-2);
  const dayTrendDelta = lastTwo.length === 2 && lastTwo[0].volume > 0
    ? Math.round(((lastTwo[1].volume - lastTwo[0].volume) / lastTwo[0].volume) * 100)
    : null;
  const weekHeat = recentDaysHeat(sessions, 7);

  return (
    <section className="home-screen" aria-labelledby="home-greeting">
      <button type="button" className="home-week-heat" onClick={onProgress} aria-label={`Last 7 days of training volume: ${weekHeat.map(day => `${day.date}, ${displayVolume(day.volume, unit)} ${unit}`).join("; ")}. View full progress.`}>
        <div className="home-week-heat__row">
          {weekHeat.map(day => (
            <div key={day.date} className="home-week-heat__day">
              <span className="home-week-heat__cell" data-level={day.level} />
              <span className="home-week-heat__label">{weekdayLetter(day.date)}</span>
            </div>
          ))}
        </div>
      </button>

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
      </Card>

      {dayTrend.length >= 2 && (
        <button type="button" className="home-day-trend" onClick={onProgress} aria-label={`${dayMeta.label} day trend over your last ${dayTrend.length} ${dayMeta.label} days: ${dayTrend.map(point => `${point.date}, ${displayVolume(point.volume, unit)} ${unit}`).join("; ")}. View full progress.`}>
          <div className="home-section-title"><div><h3>{dayMeta.label} day trend</h3><p>Last {dayTrend.length} {dayMeta.label} days</p></div></div>
          <DayTrendSparkline points={dayTrend} unit={unit} />
          {dayTrendDelta !== null && <span className="home-day-trend__delta">{dayTrendDelta >= 0 ? "+" : ""}{dayTrendDelta}% vs previous {dayMeta.label} day</span>}
        </button>
      )}

      <button type="button" className="home-heatmap" onClick={onProgress}>
        <div className="home-section-title"><div><h3>Muscle freshness</h3><p>Volt areas are ready to train</p></div><ArrowRight size={19} /></div>
        <MuscleHeatmap scores={freshness} mode="freshness" height={172} />
        {overdue.length >= 2 && (
          <div className="home-heatmap__overdue">
            <span>Overdue:</span>
            {overdue.map(item => <Chip key={item.muscle}>{MUSCLES[item.muscle] || item.muscle} ({item.daysSince}d)</Chip>)}
          </div>
        )}
      </button>

      {insight && <Card className="home-insight"><p>Training insight</p><strong>{insight.name}</strong><span>{insight.message}</span></Card>}
      {grinding && <Card className="home-insight"><p>Effort check</p><strong>{grinding.name}</strong><span>{grinding.message}</span></Card>}
      {deload && insight?.type !== "deload" && <Card className="home-insight"><p>Deload signal</p><span>{deload.message}</span><span>Next step: {deload.action}</span></Card>}

      <div className="home-section-title"><div><h3>Recent records</h3><p>Your newest all-time bests</p></div><Trophy size={19} /></div>
      {records.length ? <div className="home-records">{records.map(record => <StatTile key={`${record.date}-${record.name}`} value={`${record.weight} ${record.unit}`} label={record.name} supporting={`${record.reps} reps · ${record.date}`} accent />)}</div> : <Card variant="outlined" className="home-empty">Save workouts to begin tracking records.</Card>}
    </section>
  );
}
