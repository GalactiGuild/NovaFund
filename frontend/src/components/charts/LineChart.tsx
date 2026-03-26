'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

import { getChartTheme } from '@/lib/chart-theme';

export default function CustomLineChart({ data }: { data: any[] }) {
  const theme = getChartTheme();

  return (
    <div className="w-full h-[300px] bg-[var(--chart-bg)] rounded-xl p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>

          <CartesianGrid
            stroke={theme.gridColor}
            strokeDasharray="3 3"
          />

          <XAxis
            dataKey="name"
            stroke={theme.textColor}
            tick={{ fill: theme.textColor }}
          />

          <YAxis
            stroke={theme.textColor}
            tick={{ fill: theme.textColor }}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: theme.tooltipBg,
              border: "none",
              borderRadius: "8px",
              color: theme.tooltipText,
            }}
            labelStyle={{ color: theme.tooltipText }}
          />

          <Line
            type="monotone"
            dataKey="value"
            stroke={theme.lineColor}
            strokeWidth={2}
            dot={false}
          />

        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}