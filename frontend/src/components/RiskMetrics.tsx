export function RiskMetrics({ metrics }: { metrics: { volatility: number; sharpeRatio: number } }) {
  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">Risk Assessment</h3>
      <p>Volatility: {metrics.volatility.toFixed(2)}%</p>
      <p>Sharpe Ratio: {metrics.sharpeRatio.toFixed(2)}</p>
    </div>
  );
}
