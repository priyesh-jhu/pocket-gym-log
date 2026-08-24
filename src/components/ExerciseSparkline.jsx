import { LineChart, Line } from "recharts";
import "./ExerciseSparkline.css";

export default function ExerciseSparkline({ series, color }) {
  if (!Array.isArray(series) || series.length < 2) return null;

  return (
    <div className="m3-sparkline" aria-hidden="true">
      <LineChart width={60} height={24} data={series} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </div>
  );
}
