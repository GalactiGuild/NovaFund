export function PredictiveInsights({ insights }: { insights: any[] }) {
  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">Predictive Analytics</h3>
      <ul>
        {insights.map((i, idx) => (
          <li key={idx}>{i.message} (Confidence: {i.confidence}%)</li>
        ))}
      </ul>
    </div>
  );
}
