import React from "react";
import Card from "@/components/ui/Card";

interface Investment {
  id: string;
  projectName: string;
  amount: number;
  currentValue: number;
  status: "active" | "completed" | "failed";
}

interface PortfolioChartProps {
  investments: Investment[];
}

const PortfolioChart: React.FC<PortfolioChartProps> = ({ investments }) => {
  const totalValue = investments.reduce(
    (sum, inv) => sum + inv.currentValue,
    0,
  );

  const chartData = investments.map((inv) => ({
    ...inv,
    percentage: ((inv.currentValue / totalValue) * 100).toFixed(1),
  }));

  const colors = [
    "bg-purple-500",
    "bg-blue-500",
    "bg-green-500",
    "bg-yellow-500",
    "bg-red-500",
    "bg-indigo-500",
    "bg-pink-500",
    "bg-orange-500",
  ];

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Portfolio Allocation</h3>

      {/* Simple Bar Chart */}
      <div className="space-y-3">
        {chartData.map((item, index) => (
          <div key={item.id} className="flex items-center">
            <div className="w-24 text-sm text-muted-foreground truncate">
              {item.projectName}
            </div>
            <div className="flex-1 mx-3">
              <div className="bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full ${colors[index % colors.length]} transition-all duration-500`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
            <div className="w-16 text-sm text-right">{item.percentage}%</div>
            <div className="w-20 text-sm text-right text-muted-foreground">
              ${item.currentValue.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-2 gap-2 text-xs">
          {chartData.slice(0, 6).map((item, index) => (
            <div key={item.id} className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full ${colors[index % colors.length]} mr-2`}
              />
              <span className="truncate">{item.projectName}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default PortfolioChart;
