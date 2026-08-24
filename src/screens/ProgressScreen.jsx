import { Component, useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card, Chip, SegmentedButtons, Sheet } from "../components/index.js";
import useThemeTokens from "../charts/useThemeTokens.js";
import { dominantUnit, exerciseE1RMSeries, toLb } from "../stats.js";
import { trainingInsights } from "../trainingInsights.js";
import { bigLiftSummary, getStandardsSex } from "../strengthStandards.js";
import { normalizeBodyweights } from "../weightRecords.js";
import { DASHBOARD_KEY, PROGRESS_GROUP_IDS, PROGRESS_GROUP_LABELS, normalizeDashboardSettings, updateDashboardSettings } from "../progressDashboardSettings.js";
import { BalanceGroup, BodyHeatmapGroup, DailyTrendGroup } from "../ProgressDashboard.jsx";
import "./ProgressScreen.css";

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return undefined;
    const update = () => setReduced(query.matches);
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

class ProgressGroupBoundary extends Component {
  state = { failed: false, retryKey: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  retry = () => this.setState(({ retryKey }) => ({ failed: false, retryKey: retryKey + 1 }));

  render() {
    if (this.state.failed) {
      return <Card className="progress-group progress-group-error" role="alert">
        <h2>Progress couldn’t be calculated</h2>
        <p>Your workouts are still saved. Try again, or review the affected workout data.</p>
        <Button variant="tonal" onClick={this.retry}>Try again</Button>
      </Card>;
    }
    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}

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

function E1RMGroup({ sessions, reducedMotion }) {
  const chartTheme = useThemeTokens();
  const exercises = useMemo(() => [...new Set(sessions.flatMap(session =>
    (session.exercises || []).map(item => item.name)).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [sessions]);
  const [exercise, setExercise] = useState(() => exercises[0] || "");
  const selected = exercises.includes(exercise) ? exercise : exercises[0] || "";
  const unit = dominantUnit(sessions);
  const analytics = useMemo(() => {
    try {
      return {
        error: false,
        series: exerciseE1RMSeries(sessions, selected).map(point => ({
          ...point,
          value: unit === "kg" ? Math.round((point.value / 2.20462) * 10) / 10 : point.value,
        })),
        insights: trainingInsights(sessions),
      };
    } catch {
      return { error: true, series: [], insights: [] };
    }
  }, [selected, sessions, unit]);
  const { error, series, insights } = analytics;
  const first = series[0];
  const latest = series.at(-1);
  const change = first && latest ? Math.round((latest.value - first.value) * 10) / 10 : 0;

  return <Card variant="raised" className="progress-group progress-e1rm">
    <div className="progress-section-heading">
      <div><p className="progress-eyebrow">Strength progression</p><h2>Estimated one-rep max</h2></div>
      <select aria-label="Exercise for strength progression" value={selected} onChange={event => setExercise(event.target.value)}>
        {exercises.map(name => <option key={name} value={name}>{name}</option>)}
      </select>
    </div>
    {error ? <div className="progress-group-error" role="alert"><strong>Strength trend couldn’t be calculated.</strong><p>Review this group again after reloading the app.</p><Button variant="tonal" onClick={() => window.location.reload()}>Retry</Button></div>
      : series.length ? <>
      <div className="progress-e1rm-headline"><strong>{latest.value} {unit}</strong><span>Latest estimated 1RM</span></div>
      <p className="progress-e1rm-summary">From {first.value} {unit} on {first.date} to {latest.value} {unit} on {latest.date} · {change >= 0 ? "+" : ""}{change} {unit}</p>
      <div className="progress-chart" role="img" aria-label={`Estimated one-rep max history for ${selected}`}>
      <ResponsiveContainer minWidth={0} minHeight={0}><LineChart data={series} margin={{ top: 12, right: 10, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey="date" stroke={chartTheme.axis} tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis stroke={chartTheme.axis} tick={{ fontSize: 11 }} unit={` ${unit}`} domain={[0, "auto"]} />
        <Tooltip contentStyle={{ background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: 12 }} formatter={value => [`${value} ${unit}`, "Estimated 1RM"]} />
        <Line type="monotone" dataKey="value" stroke={chartTheme.primary} strokeWidth={3} dot={{ r: 3, fill: chartTheme.primary, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={!reducedMotion} />
      </LineChart></ResponsiveContainer>
      </div>
      <details className="progress-data-details"><summary>View e1RM data</summary><div className="progress-data-table-wrap"><table><caption>Estimated one-rep max history for {selected}</caption><thead><tr><th scope="col">Date</th><th scope="col">Estimated 1RM</th></tr></thead><tbody>{series.map(point => <tr key={point.date}><td>{point.date}</td><td>{point.value} {unit}</td></tr>)}</tbody></table></div></details>
    </> : <div className="progress-chart-empty"><strong>No weighted sets for {selected || "this exercise"} yet.</strong><p>Log weight and reps to start this strength trend.</p></div>}
    {!error && insights.length > 0 && <div className="progress-insights"><h3>Training {insights.length === 1 ? "insight" : "insights"}</h3>{insights.map(item => <div key={item.type + item.name}><strong>{item.type === "deload" ? "Recovery signal" : "Possible plateau"} · {item.name}</strong><p>{item.message}</p><div className="progress-insight-evidence">{item.evidence?.map(point => <span key={point.date}>{point.date} · {point.estimated1RMlb} lb e1RM</span>)}</div><p>Next step: {item.action}</p></div>)}<small>Trend-based guidance, not medical advice.</small></div>}
  </Card>;
}

const LIFT_LABELS = { bench: "Bench", squat: "Squat", deadlift: "Deadlift" };

function StrengthGroup({ sessions, bodyweights, sex }) {
  const unit = dominantUnit(sessions);
  const displayValue = value => (unit === "kg" ? Math.round((value / 2.20462) * 10) / 10 : Math.round(value));
  const { bodyweightLb, lifts } = useMemo(() => {
    const entries = normalizeBodyweights(bodyweights);
    const latestWeighIn = [...entries].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    const bwLb = latestWeighIn ? toLb(latestWeighIn.weight, latestWeighIn.unit) : null;
    return { bodyweightLb: bwLb, lifts: bwLb ? bigLiftSummary(sessions, bwLb, sex) : [] };
  }, [sessions, bodyweights, sex]);

  return (
    <Card variant="raised" className="progress-group">
      <div className="progress-section-heading">
        <div><p className="progress-eyebrow">Strength standards</p><h2>Strength levels</h2></div>
      </div>
      {!bodyweightLb ? (
        <div className="progress-chart-empty"><strong>Log your weight to see strength levels.</strong></div>
      ) : lifts.length === 0 ? (
        <div className="progress-chart-empty"><strong>Log a bench, squat, or deadlift set to see your strength levels.</strong></div>
      ) : (
        <>
          {lifts.map(item => (
            <div key={item.lift} className="progress-strength-row">
              <div className="progress-strength-row__head">
                <strong>{LIFT_LABELS[item.lift]}</strong>
                {item.tier && <Chip>{item.tier.charAt(0).toUpperCase() + item.tier.slice(1)}</Chip>}
              </div>
              <div className="progress-strength-row__body">
                <span>{displayValue(item.e1rmLb)} {unit} e1RM</span>
                <span>{item.ratio}× bodyweight</span>
              </div>
              {item.isFallback && <small className="progress-strength-row__fallback">(from {item.exerciseName} — no {LIFT_LABELS[item.lift]} logged yet)</small>}
            </div>
          ))}
          {!sex && lifts.length > 0 && <p className="progress-strength-row__notier">Set your sex in Settings to see your tier.</p>}
          <small className="progress-strength-disclaimer">Rough public averages, not a medical or competition standard.</small>
        </>
      )}
    </Card>
  );
}

export default function ProgressScreen({ sessions = [], preferences = {}, bodyweights = [], onSavePreferences, onAddExercise, onGoHome, loading = false }) {
  const normalized = useMemo(() => normalizeDashboardSettings(preferences), [preferences]);
  const confirmedRef = useRef(normalized);
  const customizeInitialRef = useRef(null);
  const customizeReturnRef = useRef(null);
  const saveErrorRef = useRef(null);
  const [customizing, setCustomizing] = useState(false);
  const [saveError, setSaveError] = useState("");
  const reducedMotion = useReducedMotion();

  const settings = normalized;
  const sex = getStandardsSex(preferences);
  useEffect(() => { confirmedRef.current = normalized; }, [normalized]);
  useEffect(() => { if (saveError) saveErrorRef.current?.focus(); }, [saveError]);

  const saveChanges = changes => {
    const latest = confirmedRef.current;
    const resolved = typeof changes === "function" ? changes(latest) : changes;
    const next = updateDashboardSettings(latest, resolved);
    if (next === confirmedRef.current) return true;
    let saved;
    try { saved = onSavePreferences?.({ ...preferences, [DASHBOARD_KEY]: next }); }
    catch { saved = false; }
    if (saved === false) { setSaveError("Dashboard changes couldn’t be saved. Try again."); return false; }
    confirmedRef.current = next; setSaveError(""); return true;
  };
  const toggleGroup = id => saveChanges(current => ({ hiddenCards: current.hiddenCards.includes(id) ? current.hiddenCards.filter(item => item !== id) : [...current.hiddenCards, id] }));
  const moveGroup = (id, direction) => {
    const order = [...confirmedRef.current.cardOrder];
    const from = order.indexOf(id), to = from + direction;
    if (to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    saveChanges({ cardOrder: order });
  };
  const groups = {
    e1rm: <E1RMGroup sessions={sessions} reducedMotion={reducedMotion} />,
    trend: <DailyTrendGroup sessions={sessions} settings={settings} onSaveSettings={saveChanges} reducedMotion={reducedMotion} />,
    heatmap: <BodyHeatmapGroup sessions={sessions} settings={settings} onSaveSettings={saveChanges} onAddExercise={onAddExercise} reducedMotion={reducedMotion} />,
    balance: <BalanceGroup sessions={sessions} settings={settings} reducedMotion={reducedMotion} />,
    strength: <StrengthGroup sessions={sessions} bodyweights={bodyweights} sex={sex} />,
  };

  return <section className="progress-screen" aria-labelledby="progress-title">
    <h1 id="progress-title" className="sr-only">Training progress</h1>
    <ProgressToolbar settings={settings} onChange={saveChanges} onCustomize={event => { customizeReturnRef.current=event.currentTarget; setCustomizing(true); }} />
    <div ref={saveErrorRef} tabIndex={-1} className="progress-live" role="status" aria-live="polite">{saveError}</div>
    <Sheet open={customizing} title="Customize dashboard" closeLabel="Close Customize dashboard" initialFocusRef={customizeInitialRef} returnFocusRef={customizeReturnRef} dismissOnHistory onClose={() => setCustomizing(false)}>
      <p className="progress-sheet-copy">Choose which analytics groups appear and adjust their order.</p>
      <div className="progress-customize-list">{settings.cardOrder.map((id, index) => <div key={id} className="progress-customize-row">
        <button ref={index===0?customizeInitialRef:null} type="button" role="switch" aria-label={`Show ${PROGRESS_GROUP_LABELS[id]}`} aria-checked={!settings.hiddenCards.includes(id)} className="progress-switch" onClick={() => toggleGroup(id)}><span /></button>
        <span>{PROGRESS_GROUP_LABELS[id]}</span>
        <button type="button" disabled={index === 0} aria-label={`Move ${PROGRESS_GROUP_LABELS[id]} up`} onClick={() => moveGroup(id, -1)}>↑</button>
        <button type="button" disabled={index === settings.cardOrder.length - 1} aria-label={`Move ${PROGRESS_GROUP_LABELS[id]} down`} onClick={() => moveGroup(id, 1)}>↓</button>
      </div>)}</div>
    </Sheet>
    {loading ? <div className="progress-loading" aria-live="polite"><span>Loading progress…</span>{PROGRESS_GROUP_IDS.map(id => <div className="progress-skeleton" key={id} />)}</div>
      : sessions.length === 0 ? <div className="progress-empty"><h2>No progress yet</h2><p>Log your first workout to see strength, trends, body coverage, and balance.</p>{onGoHome && <Button variant="tonal" onClick={onGoHome}>Go to Home</Button>}</div>
      : settings.cardOrder.every(id => settings.hiddenCards.includes(id)) ? <Card className="progress-all-hidden"><h2>All analytics groups are hidden</h2><p>Open Customize to choose what appears here.</p><Button onClick={() => setCustomizing(true)}>Customize dashboard</Button></Card>
      : settings.cardOrder.filter(id => !settings.hiddenCards.includes(id)).map(id => <div className="progress-group-slot" key={id}><ProgressGroupBoundary>{groups[id]}</ProgressGroupBoundary></div>)}
  </section>;
}
