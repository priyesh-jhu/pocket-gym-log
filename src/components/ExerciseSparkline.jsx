import { LineChart, Line, ResponsiveContainer } from "recharts";
import useThemeTokens from "../charts/useThemeTokens.js";
import "./ExerciseSparkline.css";

export default function ExerciseSparkline({ series }) {
  const chartTheme = useThemeTokens();
  if (!Array.isArray(series) || series.length < 2) return null;

  return (
    <div className="m3-sparkline" role="img" aria-label="Estimated one-rep max trend">
      <ResponsiveContainer width={60} height={24}>
        <LineChart data={series} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line type="monotone" dataKey="value" stroke={chartTheme.primary} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
