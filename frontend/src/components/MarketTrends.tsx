import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function MarketTrends({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="sector" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="growthRate" fill="#82ca9d" />
      </BarChart>
    </ResponsiveContainer>
  );
}
