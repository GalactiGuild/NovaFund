'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { getChartTheme } from '@/lib/chart-theme';
import ChartContainer from './ChartContainer';

export default function CustomAreaChart({ data }: { data: any[] }) {
  const theme = getChartTheme();

  return (
    <ChartContainer title="Area Chart">
      <div className="w-full h-[300px]">
        <ResponsiveContainer>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.lineColor} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={theme.lineColor} stopOpacity={0}/>
              </linearGradient>
            </defs>

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
                borderRadius: '8px',
                color: theme.tooltipText,
              }}
            />

            <Area
              type="monotone"
              dataKey="value"
              stroke={theme.lineColor}
              fillOpacity={1}
              fill="url(#colorArea)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}