'use client';

import {
  PieChart,
  Pie,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import { getChartTheme } from '@/lib/chart-theme';
import ChartContainer from './ChartContainer';

export default function CustomPieChart({ data }: { data: any[] }) {
  const theme = getChartTheme();

  return (
    <ChartContainer title="Pie Chart">
      <div className="w-full h-[300px]">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              outerRadius={100}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={theme.lineColor} />
              ))}
            </Pie>

            <Tooltip
              contentStyle={{
                backgroundColor: theme.tooltipBg,
                color: theme.tooltipText,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}