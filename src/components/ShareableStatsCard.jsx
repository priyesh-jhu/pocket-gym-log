import { forwardRef, useMemo } from "react";
import { currentStreak, dashboardRangeSummary, dominantUnit, personalRecords } from "../stats.js";
import "./ShareableStatsCard.css";

function displayVolume(valueLb, unit) {
  const converted = unit === "kg" ? valueLb / 2.20462 : valueLb;
  return Math.round(converted).toLocaleString();
}

function formatShareDate(dateString) {
  return new Date(dateString + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const ShareableStatsCard = forwardRef(function ShareableStatsCard({ sessions, rangeDays }, ref) {
  const { unit, range, streak, topPR } = useMemo(() => {
    const unit = dominantUnit(sessions);
    const range = dashboardRangeSummary(sessions, rangeDays);
    const streak = currentStreak(sessions);
    const topPR = personalRecords(sessions, 20).find(record => record.date >= range.start && record.date <= range.end) || null;
    return { unit, range, streak, topPR };
  }, [sessions, rangeDays]);

  return (
    <div ref={ref} className="shareable-stats-card">
      <p className="shareable-stats-card__brand">Pocket Gym Log</p>
      <p className="shareable-stats-card__range">{formatShareDate(range.start)} – {formatShareDate(range.end)}</p>
      <div className="shareable-stats-card__stat">
        <strong>{displayVolume(range.volume, unit)}</strong>
        <span>{unit} total volume</span>
      </div>
      <div className="shareable-stats-card__stat">
        <strong>{range.sessions}</strong>
        <span>{range.sessions === 1 ? "session" : "sessions"}</span>
      </div>
      <div className="shareable-stats-card__stat">
        <strong>{streak.current}</strong>
        <span>day streak</span>
      </div>
      {topPR && (
        <div className="shareable-stats-card__stat">
          <strong>{topPR.weight} {topPR.unit}</strong>
          <span>{topPR.name} · new best</span>
        </div>
      )}
    </div>
  );
});

export default ShareableStatsCard;
