'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { getChartTheme } from '@/lib/chart-theme';
import ChartContainer from './ChartContainer';

export default function CustomBarChart({ data }: { data: any[] }) {
  const theme = getChartTheme();

  return (
    <ChartContainer title="Bar Chart">
      <div className="w-full h-[300px]">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid stroke={theme.gridColor} strokeDasharray="3 3" />

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
                border: 'none',
                borderRadius: '8px',
                color: theme.tooltipText,
              }}
            />

            <Bar dataKey="value" fill={theme.lineColor} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}