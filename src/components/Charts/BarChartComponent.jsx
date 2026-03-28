import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { useTheme } from "../../context/ThemeContext";
import EmptyState from "../EmptyState";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export default function BarChartComponent({
  data,
  xKey = "week",
  yKey = "commits",
  title,
  color = "#818cf8",
  colors,
}) {
  const { dark } = useTheme();

  if (!data?.length) return <EmptyState message="No chart data" />;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      {title && (
        <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={dark ? "#374151" : "#e5e7eb"}
            vertical={false}
          />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: dark ? "#9ca3af" : "#6b7280" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => {
              if (typeof v === "string" && v.includes("-W")) {
                return v.split("-")[1];
              }
              if (typeof v === "string" && v.includes("-")) {
                const d = new Date(v + "T00:00");
                if (!isNaN(d)) return `${d.getMonth() + 1}/${d.getDate()}`;
              }
              return v;
            }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: dark ? "#9ca3af" : "#6b7280" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey={yKey}
            name="Commits"
            radius={[4, 4, 0, 0]}
            fill={color}
          >
            {colors &&
              data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
