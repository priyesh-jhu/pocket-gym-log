import { useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card, SegmentedButtons, Sheet } from "../components/index.js";
import useThemeTokens from "../charts/useThemeTokens.js";
import { dominantUnit, exerciseE1RMSeries } from "../stats.js";
import { trainingInsights } from "../trainingInsights.js";
import { DASHBOARD_KEY, PROGRESS_GROUP_IDS, PROGRESS_GROUP_LABELS, normalizeDashboardSettings, updateDashboardSettings } from "../progressDashboardSettings.js";
import { BalanceGroup, BodyHeatmapGroup, DailyTrendGroup } from "../ProgressDashboard.jsx";
import "./ProgressScreen.css";

function ProgressToolbar({ settings, onChange, onCustomize }) {
  return <div className="progress-toolbar">
    <SegmentedButtons ariaLabel="Progress range" value={settings.rangeDays} onChange={rangeDays => onChange({ rangeDays })} options={[
      { value: 7, label: "7 days", ariaLabel: "Show last 7 days" },
      { value: 28, label: "28 days", ariaLabel: "Show last 28 days" },
      { value: 90, label: "90 days", ariaLabel: "Show last 90 days" },
    ]} />
    <Button variant="text" onClick={onCustomize}>Customize dashboard</Button>
  </div>;
}

function E1RMGroup({ sessions }) {
  const chartTheme = useThemeTokens();
  const exercises = useMemo(() => [...new Set(sessions.flatMap(session =>
    (session.exercises || []).map(item => item.name)).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [sessions]);
  const [exercise, setExercise] = useState(() => exercises[0] || "");
  const selected = exercises.includes(exercise) ? exercise : exercises[0] || "";
  const unit = dominantUnit(sessions);
  const series = useMemo(() => exerciseE1RMSeries(sessions, selected).map(point => ({
    ...point,
    value: unit === "kg" ? Math.round((point.value / 2.20462) * 10) / 10 : point.value,
  })), [selected, sessions, unit]);
  const insights = useMemo(() => trainingInsights(sessions), [sessions]);

  return <Card variant="raised" className="progress-group progress-e1rm">
    <div className="progress-section-heading">
      <div><p className="progress-eyebrow">Strength progression</p><h2>Estimated one-rep max</h2></div>
      <select aria-label="Exercise for strength progression" value={selected} onChange={event => setExercise(event.target.value)}>
        {exercises.map(name => <option key={name} value={name}>{name}</option>)}
      </select>
    </div>
    {series.length ? <div className="progress-chart" role="img" aria-label={`Estimated one-rep max history for ${selected}`}>
      <ResponsiveContainer minWidth={0} minHeight={0}><LineChart data={series} margin={{ top: 12, right: 10, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey="date" stroke={chartTheme.axis} tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis stroke={chartTheme.axis} tick={{ fontSize: 11 }} unit={` ${unit}`} />
        <Tooltip contentStyle={{ background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: 12 }} formatter={value => [`${value} ${unit}`, "Estimated 1RM"]} />
        <Line type="monotone" dataKey="value" stroke={chartTheme.primary} strokeWidth={3} dot={{ r: 3, fill: chartTheme.primary, strokeWidth: 0 }} activeDot={{ r: 5 }} />
      </LineChart></ResponsiveContainer>
    </div> : <p className="progress-chart-empty">Log a weighted set for this exercise to begin its strength trend.</p>}
    {insights.length > 0 && <div className="progress-insights"><h3>Training insight</h3>{insights.map(item => <div key={item.type + item.name}><strong>{item.type === "deload" ? "Recovery signal" : "Possible plateau"} · {item.name}</strong><p>{item.message}</p><p>Next step: {item.action}</p></div>)}<small>Trend-based guidance, not medical advice.</small></div>}
  </Card>;
}

export default function ProgressScreen({ sessions = [], preferences = {}, onSavePreferences, onAddExercise, loading = false }) {
  const normalized = useMemo(() => normalizeDashboardSettings(preferences), [preferences]);
  const confirmedRef = useRef(normalized);
  const [customizing, setCustomizing] = useState(false);
  const [saveError, setSaveError] = useState("");

  const settings = normalized;
  useEffect(() => { confirmedRef.current = normalized; }, [normalized]);

  const saveChanges = changes => {
    const next = updateDashboardSettings(confirmedRef.current, changes);
    if (next === confirmedRef.current) return true;
    const saved = onSavePreferences?.({ ...preferences, [DASHBOARD_KEY]: next });
    if (saved === false) { setSaveError("Dashboard changes couldn’t be saved. Try again."); return false; }
    confirmedRef.current = next; setSaveError(""); return true;
  };
  const toggleGroup = id => saveChanges({ hiddenCards: settings.hiddenCards.includes(id) ? settings.hiddenCards.filter(item => item !== id) : [...settings.hiddenCards, id] });
  const moveGroup = (id, direction) => {
    const order = [...confirmedRef.current.cardOrder];
    const from = order.indexOf(id), to = from + direction;
    if (to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    saveChanges({ cardOrder: order });
  };
  const groups = {
    e1rm: <E1RMGroup sessions={sessions} />,
    trend: <DailyTrendGroup sessions={sessions} settings={settings} onSaveSettings={saveChanges} />,
    heatmap: <BodyHeatmapGroup sessions={sessions} settings={settings} onSaveSettings={saveChanges} onAddExercise={onAddExercise} />,
    balance: <BalanceGroup sessions={sessions} settings={settings} />,
  };

  return <section className="progress-screen" aria-labelledby="progress-title">
    <h1 id="progress-title" className="sr-only">Training progress</h1>
    <ProgressToolbar settings={settings} onChange={saveChanges} onCustomize={() => setCustomizing(true)} />
    <div className="progress-live" aria-live="polite">{saveError}</div>
    <Sheet open={customizing} title="Customize dashboard" onClose={() => setCustomizing(false)}>
      <p className="progress-sheet-copy">Choose which analytics groups appear and adjust their order.</p>
      <div className="progress-customize-list">{settings.cardOrder.map((id, index) => <div key={id} className="progress-customize-row">
        <button type="button" role="switch" aria-label={`Show ${PROGRESS_GROUP_LABELS[id]}`} aria-checked={!settings.hiddenCards.includes(id)} className="progress-switch" onClick={() => toggleGroup(id)}><span /></button>
        <span>{PROGRESS_GROUP_LABELS[id]}</span>
        <button type="button" disabled={index === 0} aria-label={`Move ${PROGRESS_GROUP_LABELS[id]} up`} onClick={() => moveGroup(id, -1)}>↑</button>
        <button type="button" disabled={index === settings.cardOrder.length - 1} aria-label={`Move ${PROGRESS_GROUP_LABELS[id]} down`} onClick={() => moveGroup(id, 1)}>↓</button>
      </div>)}</div>
    </Sheet>
    {loading ? <div className="progress-loading" aria-live="polite"><span>Loading progress…</span>{PROGRESS_GROUP_IDS.map(id => <div className="progress-skeleton" key={id} />)}</div>
      : sessions.length === 0 ? <div className="progress-empty"><h2>No progress yet</h2><p>Log your first workout to see strength, trends, body coverage, and balance.</p></div>
      : settings.cardOrder.every(id => settings.hiddenCards.includes(id)) ? <Card className="progress-all-hidden"><h2>All analytics groups are hidden</h2><p>Open Customize to choose what appears here.</p><Button onClick={() => setCustomizing(true)}>Customize dashboard</Button></Card>
      : settings.cardOrder.filter(id => !settings.hiddenCards.includes(id)).map(id => <div className="progress-group-slot" key={id}>{groups[id]}</div>)}
  </section>;
}
