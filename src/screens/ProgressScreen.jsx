import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "../components/index.js";
import useThemeTokens from "../charts/useThemeTokens.js";
import { dominantUnit, exerciseE1RMSeries } from "../stats.js";
import ProgressDashboard from "../ProgressDashboard.jsx";
import "./ProgressScreen.css";

export default function ProgressScreen({ sessions, preferences, onSavePreferences, onAddExercise }) {
  const chartTheme = useThemeTokens();
  const exercises = useMemo(() => [...new Set(sessions.flatMap(session =>
    (session.exercises || []).map(exercise => exercise.name)).filter(Boolean))].sort(), [sessions]);
  const [exercise, setExercise] = useState(() => exercises[0] || "");
  const unit = dominantUnit(sessions);
  const series = useMemo(() => exerciseE1RMSeries(sessions, exercise).map(point => ({
    ...point,
    value: unit === "kg" ? Math.round((point.value / 2.20462) * 10) / 10 : point.value,
  })), [exercise, sessions, unit]);

  if (!sessions.length) return <div className="progress-empty">Log a few sessions first to see progress charts.</div>;

  return (
    <section className="progress-screen" aria-label="Training progress">
      <Card variant="raised" className="progress-e1rm">
        <div className="progress-section-heading">
          <div><p className="progress-eyebrow">STRENGTH PROGRESSION</p><h2>Estimated one-rep max</h2></div>
          <select aria-label="Exercise for strength progression" value={exercise} onChange={event => setExercise(event.target.value)}>
            {exercises.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        {series.length ? <div className="progress-chart" role="img" aria-label={`Estimated one-rep max history for ${exercise}`}>
          <ResponsiveContainer><LineChart data={series} margin={{ top: 12, right: 10, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="date" stroke={chartTheme.axis} tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis stroke={chartTheme.axis} tick={{ fontSize: 11 }} unit={` ${unit}`} />
            <Tooltip contentStyle={{ background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: 12 }} formatter={value => [`${value} ${unit}`, "Estimated 1RM"]} />
            <Line type="monotone" dataKey="value" stroke={chartTheme.primary} strokeWidth={3} dot={{ r: 3, fill: chartTheme.primary, strokeWidth: 0 }} activeDot={{ r: 5 }} />
          </LineChart></ResponsiveContainer>
        </div> : <p className="progress-chart-empty">Log a weighted set for this exercise to begin its strength trend.</p>}
      </Card>
      <ProgressDashboard sessions={sessions} preferences={preferences} onSavePreferences={onSavePreferences} onAddExercise={onAddExercise} />
    </section>
  );
}
