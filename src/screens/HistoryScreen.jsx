import { useCallback, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button, Card, Sheet, TextField } from "../components/index.js";
import { HISTORY_DAY_OPTIONS, createDraftSet, createHistoryDraft, groupSessionsByMonth } from "../historyRecords.js";
import { TRACKING_TYPES, trackingLabels } from "../exerciseTracking.js";
import { RPE_OPTIONS } from "../draft.js";
import "./HistoryScreen.css";

// Presentation only. This screen never reads storage and never talks to
// Firebase: it receives records, keeps the transient sheet/expansion state, and
// reports intent through callbacks. App owns every confirmed change.

const LOAD_ERROR = "Workout history couldn’t be shown. Your workouts are still saved. Try again.";
const SAVE_ERROR = "Workout changes couldn’t be saved. Your original workout is unchanged. Try again.";
const VALIDATION_ERROR = "Review the highlighted workout details before saving.";
const DELETE_ERROR = "This workout couldn’t be deleted. It’s still saved on this device. Try again.";

function measureLabel(tracking) {
  return trackingLabels(tracking).measure;
}

function measurePlaceholder(tracking) {
  if (tracking === TRACKING_TYPES.TIMED) return "sec";
  if (tracking === TRACKING_TYPES.DISTANCE) return "m";
  return "reps";
}

function SessionCard({ record, expanded, onToggle, onEdit, onRequestDelete }) {
  const detailId = `history-detail-${record.id}`;
  const summary = [
    `${record.exerciseCount} ${record.exerciseCount === 1 ? "exercise" : "exercises"}`,
    `${record.setCount} ${record.setCount === 1 ? "set" : "sets"}`,
    record.volume ? `${record.volume.value.toLocaleString()} ${record.volume.unit} volume` : null,
  ].filter(Boolean).join(" · ");

  return (
    <Card className={`history-card${expanded ? " is-expanded" : ""}`}>
      <button
        type="button"
        className="history-disclosure"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={onToggle}
      >
        <span className="history-dot" aria-hidden="true" />
        <span className="history-disclosure__body">
          <span className="history-card__title">
            {record.dayEmoji && <span aria-hidden="true">{record.dayEmoji} </span>}
            {record.dayLabel}
          </span>
          <span className="history-card__meta">{record.dateLabel}</span>
          <span className="history-card__meta">{summary}</span>
        </span>
        <ChevronDown className="history-chevron" size={20} aria-hidden="true" />
      </button>

      <div id={detailId} className="history-detail" hidden={!expanded}>
        {record.exercises.length === 0
          ? <p className="history-detail__empty">No exercise details were saved with this workout.</p>
          : <ul className="history-exercises">
            {record.exercises.map((exercise, index) => (
              <li key={`${exercise.name}-${index}`}>
                <h4 className="history-exercise__name">{exercise.name}</h4>
                <ul className="history-sets">
                  {exercise.sets.map((set, setIndex) => (
                    <li key={setIndex} className="history-set">{set.display}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>}
        {record.readiness && (
          <p className="history-detail__line">
            Readiness {record.readinessScore}% · energy {record.readiness.energy}/5 · sleep {record.readiness.sleep}/5 · soreness {record.readiness.soreness}/5
            {record.readiness.pain ? " · pain reported" : ""}
          </p>
        )}
        {record.notes && <p className="history-notes">{record.notes}</p>}
        {(onEdit || onRequestDelete) && (
          <div className="history-actions">
            {onEdit && (
              <Button
                variant="tonal"
                onClick={event => { event.stopPropagation(); onEdit(record, event.currentTarget); }}
              >Edit workout</Button>
            )}
            {onRequestDelete && (
              <Button
                variant="text"
                className="history-delete"
                onClick={event => { event.stopPropagation(); onRequestDelete(record, event.currentTarget); }}
              >Delete workout</Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export default function HistoryScreen({
  sessions = [],
  loading = false,
  loadError = null,
  onRetryLoad,
  onStartWorkout,
  onSaveWorkout,
  onDeleteWorkout,
}) {
  const titleId = useId();
  const errorId = useId();
  const [expandedId, setExpandedId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  // Drafts survive an accidental dismissal for as long as this screen lives, so
  // an interrupted edit is never silently thrown away — and never written to the
  // confirmed record either.
  const retainedDrafts = useRef(new Map());
  const pristineRef = useRef("");
  const editReturnRef = useRef(null);
  const deleteReturnRef = useRef(null);
  const keepWorkoutRef = useRef(null);
  const formRef = useRef(null);
  const setKeyRef = useRef(0);

  const groups = useMemo(() => (loading || loadError ? [] : groupSessionsByMonth(sessions)), [sessions, loading, loadError]);
  const total = groups.reduce((count, group) => count + group.count, 0);

  const openEditor = useCallback((record, invoker) => {
    editReturnRef.current = invoker || null;
    const fresh = createHistoryDraft(record.session);
    pristineRef.current = JSON.stringify(fresh);
    setDraft(retainedDrafts.current.get(record.id) || fresh);
    setSaveError(null);
    setEditing(record);
  }, []);

  // An implicit dismissal (Escape, scrim, drag, browser or Android back) retains
  // an edited draft for the next open; `Discard workout changes` throws it away.
  // Neither ever touches the confirmed record.
  const closeEditor = useCallback(({ retain }) => {
    if (editing) {
      const isDirty = Boolean(draft) && JSON.stringify(draft) !== pristineRef.current;
      if (retain && isDirty) retainedDrafts.current.set(editing.id, draft);
      else retainedDrafts.current.delete(editing.id);
    }
    setEditing(null);
    setDraft(null);
    setSaveError(null);
  }, [draft, editing]);

  function updateDraft(change) {
    setDraft(current => (current ? { ...current, ...change } : current));
  }

  function updateExercise(exerciseKey, change) {
    setDraft(current => current && {
      ...current,
      exercises: current.exercises.map(exercise => (exercise.key === exerciseKey ? { ...exercise, ...change } : exercise)),
    });
  }

  function updateSet(exerciseKey, setKey, change) {
    setDraft(current => current && {
      ...current,
      exercises: current.exercises.map(exercise => (exercise.key !== exerciseKey ? exercise : {
        ...exercise,
        sets: exercise.sets.map(set => (set.key === setKey ? { ...set, ...change } : set)),
      })),
    });
  }

  function addSet(exerciseKey) {
    setKeyRef.current += 1;
    const key = `added-${setKeyRef.current}`;
    setDraft(current => current && {
      ...current,
      exercises: current.exercises.map(exercise => (exercise.key !== exerciseKey ? exercise : {
        ...exercise,
        sets: [...exercise.sets, createDraftSet(exercise, key)],
      })),
    });
  }

  function removeSet(exerciseKey, setKey) {
    setDraft(current => current && {
      ...current,
      exercises: current.exercises.map(exercise => (exercise.key !== exerciseKey ? exercise : {
        ...exercise,
        sets: exercise.sets.filter(set => set.key !== setKey),
      })),
    });
  }

  async function saveWorkout() {
    if (!draft || !onSaveWorkout || saving) return;
    setSaving(true);
    setSaveError(null);
    let result;
    try { result = await onSaveWorkout(draft); }
    catch { result = { ok: false }; }
    setSaving(false);
    if (result?.ok) {
      retainedDrafts.current.delete(draft.id);
      setAnnouncement("Workout changes saved.");
      setEditing(null);
      setDraft(null);
      return;
    }
    // The sheet, the draft and the confirmed card all stay exactly as they were.
    setSaveError({ message: result?.error || SAVE_ERROR, field: result?.field || null });
    const field = result?.field;
    const target = field && formRef.current?.querySelector(`[data-field="${field}"]`);
    if (target?.focus) target.focus();
  }

  // Requesting a delete only opens a confirmation; nothing is removed until App
  // confirms a successful device write.
  function requestDelete(record, invoker) {
    deleteReturnRef.current = invoker || null;
    setDeleteError(null);
    setDeleteTarget(record);
  }

  async function confirmDelete() {
    if (!deleteTarget || !onDeleteWorkout || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    let result;
    try { result = await onDeleteWorkout(deleteTarget.id); }
    catch { result = { ok: false }; }
    setDeleting(false);
    if (result?.ok) {
      retainedDrafts.current.delete(deleteTarget.id);
      setExpandedId(current => (current === deleteTarget.id ? null : current));
      setAnnouncement("Workout deleted.");
      setDeleteTarget(null);
      return;
    }
    setDeleteError(result?.error || DELETE_ERROR);
  }

  const editTitleContext = editing ? `${editing.dayLabel} · ${editing.dateLabel}` : "";

  return (
    <section className="history-screen" aria-labelledby={titleId}>
      <header className="history-header">
        <h1 id={titleId}>History</h1>
        {!loading && !loadError && total > 0 && (
          <p className="history-count">{total} {total === 1 ? "workout" : "workouts"}</p>
        )}
      </header>

      <div className="history-live" role="status" aria-live="polite">{announcement}</div>

      {loading ? (
        <div className="history-loading" aria-live="polite">
          <span>Loading workout history…</span>
          <div className="history-skeleton" />
          <div className="history-skeleton" />
        </div>
      ) : loadError ? (
        <Card className="history-error" role="alert">
          <h2>Workout history</h2>
          <p>{LOAD_ERROR}</p>
          {onRetryLoad && <Button variant="tonal" onClick={onRetryLoad}>Try again</Button>}
        </Card>
      ) : total === 0 ? (
        <div className="history-empty">
          <h2>No workouts yet</h2>
          <p>Finish your first workout to build your training history.</p>
          {onStartWorkout && <Button variant="tonal" onClick={onStartWorkout}>Start workout</Button>}
        </div>
      ) : (
        groups.map(group => (
          <section key={group.key} className="history-month" aria-labelledby={`history-month-${group.key}`}>
            <h2 id={`history-month-${group.key}`} className="history-month__title">{group.label}</h2>
            <p className="history-month__count">{group.count} {group.count === 1 ? "workout" : "workouts"}</p>
            <ul className="history-list">
              {group.sessions.map(record => (
                <li key={record.id}>
                  <SessionCard
                    record={record}
                    expanded={expandedId === record.id}
                    onToggle={() => setExpandedId(current => (current === record.id ? null : record.id))}
                    onEdit={onSaveWorkout ? openEditor : null}
                    onRequestDelete={onDeleteWorkout ? requestDelete : null}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <Sheet
        open={Boolean(editing && draft)}
        title="Edit workout"
        closeLabel="Close Edit workout"
        returnFocusRef={editReturnRef}
        dismissOnHistory
        onClose={() => closeEditor({ retain: true })}
      >
        {draft && (
          <div className="history-editor" ref={formRef}>
            <p className="history-editor__context">{editTitleContext}</p>
            {saveError && (
              <p className="history-editor__error" id={errorId} role="alert">
                {saveError.field ? `${VALIDATION_ERROR} ${saveError.message}` : saveError.message}
              </p>
            )}

            <TextField
              label="Workout date"
              type="date"
              value={draft.date}
              data-field="date"
              aria-describedby={saveError?.field === "date" ? errorId : undefined}
              onChange={event => updateDraft({ date: event.target.value })}
            />

            <label className="history-field">
              <span className="history-field__label">Workout day</span>
              <select
                className="history-select"
                value={draft.day}
                data-field="day"
                aria-describedby={saveError?.field === "day" ? errorId : undefined}
                onChange={event => updateDraft({ day: event.target.value })}
              >
                {!HISTORY_DAY_OPTIONS.some(option => option.value === draft.day) && (
                  <option value={draft.day}>{draft.day || "Workout"}</option>
                )}
                {HISTORY_DAY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            {draft.exercises.map(exercise => (
              <div className="history-editor__exercise" key={exercise.key}>
                <TextField
                  label="Exercise"
                  value={exercise.name}
                  data-field={`exercise-${exercise.key}-name`}
                  aria-describedby={saveError?.field === `exercise-${exercise.key}-name` ? errorId : undefined}
                  onChange={event => updateExercise(exercise.key, { name: event.target.value })}
                />
                <ul className="history-editor__sets">
                  {exercise.sets.map((set, index) => (
                    <li className="history-editor__set" key={set.key}>
                      <TextField
                        label={`${trackingLabels(exercise.tracking).weight} · set ${index + 1}`}
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={set.weight}
                        onChange={event => updateSet(exercise.key, set.key, { weight: event.target.value })}
                      />
                      <label className="history-field">
                        <span className="history-field__label">Unit</span>
                        <select
                          className="history-select"
                          value={set.unit}
                          aria-label={`Unit for ${exercise.name || "exercise"} set ${index + 1}`}
                          onChange={event => updateSet(exercise.key, set.key, { unit: event.target.value })}
                        >
                          <option value="lb">lb</option>
                          <option value="kg">kg</option>
                        </select>
                      </label>
                      <TextField
                        label={`${measureLabel(exercise.tracking)} · set ${index + 1}`}
                        type="number"
                        inputMode="numeric"
                        step="any"
                        placeholder={measurePlaceholder(exercise.tracking)}
                        value={set.reps}
                        data-field={index === 0 ? "sets" : undefined}
                        aria-describedby={saveError?.field === "sets" && index === 0 ? errorId : undefined}
                        onChange={event => updateSet(exercise.key, set.key, { reps: event.target.value })}
                      />
                      <label className="history-field">
                        <span className="history-field__label">RPE</span>
                        <select
                          className="history-select"
                          value={set.rpe}
                          aria-label={`RPE for ${exercise.name || "exercise"} set ${index + 1}`}
                          onChange={event => updateSet(exercise.key, set.key, { rpe: event.target.value })}
                        >
                          <option value="">—</option>
                          {RPE_OPTIONS.map(value => <option key={value} value={value}>{value}</option>)}
                        </select>
                      </label>
                      <Button
                        variant="text"
                        aria-label={`Remove set ${index + 1} of ${exercise.name || "this exercise"}`}
                        onClick={() => removeSet(exercise.key, set.key)}
                      >Remove</Button>
                    </li>
                  ))}
                </ul>
                <Button variant="text" onClick={() => addSet(exercise.key)}>
                  Add set to {exercise.name || "this exercise"}
                </Button>
              </div>
            ))}

            <label className="history-field">
              <span className="history-field__label">Notes</span>
              <textarea
                className="history-textarea"
                rows={3}
                value={draft.notes}
                onChange={event => updateDraft({ notes: event.target.value })}
              />
            </label>

            <div className="history-editor__actions">
              <Button variant="filled" disabled={saving} onClick={saveWorkout}>{saving ? "Saving…" : "Save workout"}</Button>
              <Button variant="text" onClick={() => closeEditor({ retain: false })}>Discard workout changes</Button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet
        open={Boolean(deleteTarget)}
        title="Delete workout?"
        closeLabel="Close Delete workout"
        initialFocusRef={keepWorkoutRef}
        returnFocusRef={deleteReturnRef}
        dismissOnHistory
        onClose={() => { setDeleteTarget(null); setDeleteError(null); }}
      >
        {deleteTarget && (
          <div className="history-confirm">
            <p className="history-confirm__body">
              This removes the workout from {deleteTarget.dateLabel} from this device and your synced account. This can’t be undone.
            </p>
            {deleteError && <p className="history-editor__error" role="alert">{deleteError}</p>}
            <div className="history-editor__actions">
              <Button variant="filled" className="history-destructive" disabled={deleting} onClick={confirmDelete}>
                {deleting ? "Deleting…" : "Delete workout"}
              </Button>
              <Button variant="text" ref={keepWorkoutRef} onClick={() => { setDeleteTarget(null); setDeleteError(null); }}>Keep workout</Button>
            </div>
          </div>
        )}
      </Sheet>
    </section>
  );
}
