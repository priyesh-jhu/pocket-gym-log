import "./StatTile.css";

export default function StatTile({ value, label, supporting, accent = false }) {
  return <div className={`m3-stat${accent ? " m3-stat--accent" : ""}`}><strong>{value}</strong><span>{label}</span>{supporting && <small>{supporting}</small>}</div>;
}
