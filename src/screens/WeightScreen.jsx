import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card, SegmentedButtons, Sheet, TextField } from "../components/index.js";
import useThemeTokens from "../charts/useThemeTokens.js";
import { buildWeightView, createWeightDraft } from "../weightRecords.js";
import "./WeightScreen.css";

// Presentation only. This screen never reads storage and never talks to
// Firebase: it receives bodyweights, keeps transient sheet/confirmation state,
// and reports intent through callbacks. App owns every confirmed mutation.

const LOAD_ERROR = "Weigh-ins couldn’t be shown. Your entries are still saved. Try again.";
const SAVE_ERROR = "This weigh-in couldn’t be saved. Your previous entry is unchanged. Try again.";
const DELETE_ERROR = "This weigh-in couldn’t be deleted. It’s still saved on this device. Try again.";

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

export default function WeightScreen({
  bodyweights = [],
  displayUnit = "lb",
  onChangeDisplayUnit,
  loading = false,
  loadError = null,
  onRetryLoad,
  onSaveWeighIn,
  onDeleteWeighIn,
}) {
  const titleId = useId();
  const errorId = useId();
  const chartTheme = useThemeTokens();
  const reducedMotion = useReducedMotion();

  const [sheetMode, setSheetMode] = useState(null); // "add" | "edit" | null
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const sheetReturnRef = useRef(null);
  const deleteReturnRef = useRef(null);
  const keepReturnRef = useRef(null);
  const formRef = useRef(null);

  const view = useMemo(
    () => (loading || loadError ? null : buildWeightView(bodyweights, displayUnit)),
    [bodyweights, displayUnit, loading, loadError],
  );

  function openAdd(invoker) {
    sheetReturnRef.current = invoker || null;
    setSaveError(null);
    setDraft(createWeightDraft(null, { date: undefined, unit: displayUnit }));
    setSheetMode("add");
  }

  function openEdit(row, invoker) {
    sheetReturnRef.current = invoker || null;
    setSaveError(null);
    setDraft(createWeightDraft(row));
    setSheetMode("edit");
  }

  function closeSheet() {
    setSheetMode(null);
    setDraft(null);
    setSaveError(null);
  }

  async function saveWeighIn() {
    if (!draft || !onSaveWeighIn || saving) return;
    setSaving(true);
    setSaveError(null);
    let result;
    try { result = await onSaveWeighIn(draft); }
    catch { result = { ok: false }; }
    setSaving(false);
    if (result?.ok) {
      setAnnouncement(sheetMode === "edit" ? "Weigh-in updated." : "Weigh-in saved.");
      closeSheet();
      return;
    }
    setSaveError({ message: result?.error || SAVE_ERROR, field: result?.field || null });
    const field = result?.field;
    const target = field && formRef.current?.querySelector(`[data-field="${field}"]`);
    if (target?.focus) target.focus();
  }

  function requestDelete(row, invoker) {
    deleteReturnRef.current = invoker || null;
    setDeleteError(null);
    setDeleteTarget(row);
  }

  async function confirmDelete() {
    if (!deleteTarget || !onDeleteWeighIn || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    let result;
    try { result = await onDeleteWeighIn(deleteTarget.id); }
    catch { result = { ok: false }; }
    setDeleting(false);
    if (result?.ok) {
      setAnnouncement("Weigh-in deleted.");
      setDeleteTarget(null);
      return;
    }
    setDeleteError(result?.error || DELETE_ERROR);
  }

  const count = view?.summary.count ?? 0;

  return (
    <section className="weight-screen" aria-labelledby={titleId}>
      <header className="weight-header">
        <h1 id={titleId}>Weight</h1>
        <SegmentedButtons
          ariaLabel="Display unit"
          value={displayUnit}
          onChange={onChangeDisplayUnit}
          options={[{ value: "lb", label: "lb" }, { value: "kg", label: "kg" }]}
        />
      </header>

      <div className="weight-live" role="status" aria-live="polite">{announcement}</div>

      {loading ? (
        <div className="weight-loading" aria-live="polite">
          <span>Loading weigh-ins…</span>
          <div className="weight-skeleton" />
          <div className="weight-skeleton" />
        </div>
      ) : loadError ? (
        <Card className="weight-error" role="alert">
          <h2>Weight</h2>
          <p>{LOAD_ERROR}</p>
          {onRetryLoad && <Button variant="tonal" onClick={onRetryLoad}>Try again</Button>}
        </Card>
      ) : count === 0 ? (
        <div className="weight-empty">
          <h2>No weigh-ins yet</h2>
          <p>Add your first weigh-in to start tracking bodyweight over time.</p>
          {onSaveWeighIn && <Button variant="filled" onClick={event => openAdd(event.currentTarget)}>Add weigh-in</Button>}
        </div>
      ) : (
        <>
          <Card variant="raised" className="weight-summary">
            <div className="weight-summary__hero">
              <strong>{view.summary.latest.value}<span> {view.summary.latest.unit}</span></strong>
              <span>Latest · {view.summary.latest.dateLabel}</span>
            </div>
            <div className="weight-summary__stats">
              <div>
                <strong>{view.summary.netChange.value >= 0 ? "+" : ""}{view.summary.netChange.value} {view.summary.netChange.unit}</strong>
                <span>Net change</span>
              </div>
              <div>
                <strong>{view.summary.count}</strong>
                <span>{view.summary.count === 1 ? "Weigh-in" : "Weigh-ins"}</span>
              </div>
            </div>
          </Card>

          <Card className="weight-trend">
            <h2>Bodyweight trend</h2>
            {view.chart.hasTrend ? (
              <>
                <div className="weight-chart" role="img" aria-label={`Bodyweight trend in ${view.unit}, ${view.chart.points.length} weigh-ins`}>
                  <ResponsiveContainer minWidth={0} minHeight={0}>
                    <LineChart data={view.chart.points} margin={{ top: 12, right: 10, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 4" vertical={false} />
                      <XAxis dataKey="dateLabel" stroke={chartTheme.axis} tick={{ fontSize: 11 }} minTickGap={24} />
                      <YAxis stroke={chartTheme.axis} tick={{ fontSize: 11 }} unit={` ${view.unit}`} domain={["dataMin - 2", "dataMax + 2"]} />
                      <Tooltip contentStyle={{ background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="weight" name="Weigh-in" stroke={chartTheme.primary} strokeWidth={3} dot={{ r: 3, fill: chartTheme.primary, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={!reducedMotion} />
                      <Line type="monotone" dataKey="trend" name="7-day average" stroke={chartTheme.secondary} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={!reducedMotion} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <details className="weight-data-details">
                  <summary>View weight data</summary>
                  <div className="weight-data-table-wrap">
                    <table>
                      <caption>Bodyweight trend in {view.unit}</caption>
                      <thead><tr><th scope="col">Date</th><th scope="col">Weigh-in</th><th scope="col">7-day average</th></tr></thead>
                      <tbody>
                        {view.chart.points.map(point => (
                          <tr key={point.date}><td>{point.date}</td><td>{point.weight} {view.unit}</td><td>{point.trend} {view.unit}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            ) : (
              <p className="weight-chart-empty">Add at least 2 weigh-ins to see your bodyweight trend.</p>
            )}
          </Card>

          {onSaveWeighIn && (
            <Button variant="filled" className="weight-add" onClick={event => openAdd(event.currentTarget)}>Add weigh-in</Button>
          )}

          <div className="weight-history">
            <h2 className="weight-history__title">History</h2>
            <ul className="weight-list">
              {view.history.map(row => (
                <li key={row.id} className="weight-row">
                  <div className="weight-row__info">
                    <span className="weight-row__value">{row.weight}<span> {row.unit}</span></span>
                    <span className="weight-row__date">{row.dateLabel}</span>
                  </div>
                  <div className="weight-row__actions">
                    {onSaveWeighIn && (
                      <Button variant="text" aria-label={`Edit weigh-in for ${row.dateLabel}`} onClick={event => openEdit(row, event.currentTarget)}>Edit</Button>
                    )}
                    {onDeleteWeighIn && (
                      <Button variant="text" className="weight-delete" aria-label={`Delete weigh-in for ${row.dateLabel}`} onClick={event => requestDelete(row, event.currentTarget)}>Delete</Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <Sheet
        open={sheetMode !== null && Boolean(draft)}
        title={sheetMode === "edit" ? "Edit weigh-in" : "Add weigh-in"}
        closeLabel={sheetMode === "edit" ? "Close Edit weigh-in" : "Close Add weigh-in"}
        returnFocusRef={sheetReturnRef}
        dismissOnHistory
        onClose={closeSheet}
      >
        {draft && (
          <div className="weight-form" ref={formRef}>
            {saveError && (
              <p className="weight-form__error" id={errorId} role="alert">{saveError.message}</p>
            )}
            <TextField
              label="Weight"
              type="number"
              inputMode="decimal"
              step="any"
              value={draft.weight}
              data-field="weight"
              aria-describedby={saveError?.field === "weight" ? errorId : undefined}
              onChange={event => setDraft(current => ({ ...current, weight: event.target.value }))}
            />
            <label className="weight-field">
              <span className="weight-field__label">Unit</span>
              <select
                className="weight-select"
                value={draft.unit}
                onChange={event => setDraft(current => ({ ...current, unit: event.target.value }))}
              >
                <option value="lb">lb</option>
                <option value="kg">kg</option>
              </select>
            </label>
            <TextField
              label="Date"
              type="date"
              value={draft.date}
              data-field="date"
              aria-describedby={saveError?.field === "date" ? errorId : undefined}
              onChange={event => setDraft(current => ({ ...current, date: event.target.value }))}
            />
            {sheetMode === "add" && (
              <p className="weight-form__hint">One entry per day. Saving the same date updates that day’s weigh-in.</p>
            )}
            <div className="weight-form__actions">
              <Button variant="filled" disabled={saving} onClick={saveWeighIn}>{saving ? "Saving…" : "Save weigh-in"}</Button>
              <Button variant="text" onClick={closeSheet}>{sheetMode === "edit" ? "Discard weigh-in changes" : "Close add weigh-in"}</Button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet
        open={Boolean(deleteTarget)}
        title="Delete weigh-in?"
        closeLabel="Close Delete weigh-in"
        initialFocusRef={keepReturnRef}
        returnFocusRef={deleteReturnRef}
        dismissOnHistory
        onClose={() => { setDeleteTarget(null); setDeleteError(null); }}
      >
        {deleteTarget && (
          <div className="weight-confirm">
            <p className="weight-confirm__body">
              This removes the {deleteTarget.weight} {deleteTarget.unit} entry from {deleteTarget.dateLabel} from this device and your synced account. This can’t be undone.
            </p>
            {deleteError && <p className="weight-form__error" role="alert">{deleteError}</p>}
            <div className="weight-form__actions">
              <Button variant="filled" className="weight-destructive" disabled={deleting} onClick={confirmDelete}>
                {deleting ? "Deleting…" : "Delete weigh-in"}
              </Button>
              <Button variant="text" ref={keepReturnRef} onClick={() => { setDeleteTarget(null); setDeleteError(null); }}>Keep weigh-in</Button>
            </div>
          </div>
        )}
      </Sheet>
    </section>
  );
}
