import React from "react";
import Card from "@/components/ui/Card";

interface PortfolioData {
  totalInvested: number;
  totalCurrentValue: number;
  totalClaimableReturns: number;
  totalProjects: number;
}

interface PortfolioStatsProps {
  data: PortfolioData;
}

const PortfolioStats: React.FC<PortfolioStatsProps> = ({ data }) => {
  const totalGains = data.totalCurrentValue - data.totalInvested;
  const totalGainsPercentage =
    data.totalInvested > 0
      ? ((totalGains / data.totalInvested) * 100).toFixed(1)
      : "0.0";

  const stats = [
    {
      title: "Total Invested",
      value: `$${data.totalInvested.toLocaleString()}`,
      description: "Across all projects",
      color: "text-blue-400",
      bgColor: "bg-blue-900/20",
    },
    {
      title: "Current Value",
      value: `$${data.totalCurrentValue.toLocaleString()}`,
      description: `${totalGainsPercentage}% ${totalGains >= 0 ? "gain" : "loss"}`,
      color: totalGains >= 0 ? "text-green-400" : "text-red-400",
      bgColor: totalGains >= 0 ? "bg-green-900/20" : "bg-red-900/20",
    },
    {
      title: "Claimable Returns",
      value: `$${data.totalClaimableReturns.toLocaleString()}`,
      description: "Ready to claim",
      color: "text-purple-400",
      bgColor: "bg-purple-900/20",
    },
    {
      title: "Active Projects",
      value: data.totalProjects.toString(),
      description: "In portfolio",
      color: "text-orange-400",
      bgColor: "bg-orange-900/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <Card key={index} className={`${stat.bgColor} border border-gray-700`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </div>
            <div
              className={`w-12 h-12 rounded-full ${stat.bgColor} flex items-center justify-center`}
            >
              {index === 0 && (
                <svg
                  className={`w-6 h-6 ${stat.color}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                  />
                </svg>
              )}
              {index === 1 && (
                <svg
                  className={`w-6 h-6 ${stat.color}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              )}
              {index === 2 && (
                <svg
                  className={`w-6 h-6 ${stat.color}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              )}
              {index === 3 && (
                <svg
                  className={`w-6 h-6 ${stat.color}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default PortfolioStats;
