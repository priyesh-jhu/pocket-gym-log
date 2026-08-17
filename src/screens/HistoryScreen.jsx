import { useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button, Card } from "../components/index.js";
import { groupSessionsByMonth } from "../historyRecords.js";
import "./HistoryScreen.css";

// Presentation only. This screen never reads storage and never talks to
// Firebase: it receives records and reports intent through callbacks, and App
// owns every confirmed change.

const LOAD_ERROR = "Workout history couldn’t be shown. Your workouts are still saved. Try again.";

function SessionCard({ record, expanded, onToggle }) {
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
}) {
  const titleId = useId();
  const [expandedId, setExpandedId] = useState(null);
  const groups = useMemo(() => (loading || loadError ? [] : groupSessionsByMonth(sessions)), [sessions, loading, loadError]);
  const total = groups.reduce((count, group) => count + group.count, 0);

  return (
    <section className="history-screen" aria-labelledby={titleId}>
      <header className="history-header">
        <h1 id={titleId}>History</h1>
        {!loading && !loadError && total > 0 && (
          <p className="history-count">{total} {total === 1 ? "workout" : "workouts"}</p>
        )}
      </header>

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
            <ul className="history-list">
              {group.sessions.map(record => (
                <li key={record.id}>
                  <SessionCard
                    record={record}
                    expanded={expandedId === record.id}
                    onToggle={() => setExpandedId(current => (current === record.id ? null : record.id))}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}
