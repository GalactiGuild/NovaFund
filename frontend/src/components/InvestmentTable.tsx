"use client";

import React, { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

interface Investment {
  id: string;
  projectName: string;
  amount: number;
  dateInvested: string;
  status: "active" | "completed" | "failed";
  currentValue: number;
  claimableReturns: number;
  canClaim: boolean;
}

interface InvestmentTableProps {
  investments: Investment[];
  onClaim: (investmentId: string, amount: number) => Promise<void>;
}

const InvestmentTable: React.FC<InvestmentTableProps> = ({
  investments,
  onClaim,
}) => {
  const [claimingIds, setClaimingIds] = useState<Set<string>>(new Set());

  const handleClaim = async (investment: Investment) => {
    if (claimingIds.has(investment.id)) return;

    setClaimingIds((prev) => new Set(prev).add(investment.id));
    try {
      await onClaim(investment.id, investment.claimableReturns);
    } finally {
      setClaimingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(investment.id);
        return newSet;
      });
    }
  };

  const getStatusBadge = (status: Investment["status"]) => {
    switch (status) {
      case "active":
        return <Badge variant="primary">Active</Badge>;
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      case "failed":
        return <Badge variant="danger">Failed</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const calculateGainLoss = (currentValue: number, invested: number) => {
    const gain = currentValue - invested;
    const percentage = ((gain / invested) * 100).toFixed(1);
    return {
      amount: gain,
      percentage,
      isPositive: gain >= 0,
    };
  };

  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-700">
        <h2 className="text-xl font-semibold">Your Investments</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your portfolio and claim available returns
        </p>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden">
        <div className="divide-y divide-gray-700">
          {investments.map((investment) => {
            const gainLoss = calculateGainLoss(
              investment.currentValue,
              investment.amount,
            );
            const isClaiming = claimingIds.has(investment.id);

            return (
              <div key={investment.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-white">
                      {investment.projectName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Invested {formatDate(investment.dateInvested)}
                    </div>
                  </div>
                  {getStatusBadge(investment.status)}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Invested</div>
                    <div className="font-medium">${investment.amount.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Current Value</div>
                    <div className="font-medium">${investment.currentValue.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Gain/Loss</div>
                    <div className={gainLoss.isPositive ? "text-green-400" : "text-red-400"}>
                      {gainLoss.isPositive ? "+" : ""}${gainLoss.amount.toLocaleString()}
                      <div className="text-xs">({gainLoss.isPositive ? "+" : ""}{gainLoss.percentage}%)</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Claimable</div>
                    <div className="text-purple-400 font-medium">
                      ${investment.claimableReturns.toLocaleString()}
                    </div>
                  </div>
                </div>

                {investment.canClaim && investment.claimableReturns > 0 && (
                  <Button
                    size="sm"
                    onClick={() => handleClaim(investment)}
                    disabled={isClaiming}
                    className="w-full"
                  >
                    {isClaiming ? (
                      <div className="flex items-center justify-center">
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Claiming
                      </div>
                    ) : (
                      "Claim Returns"
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Project
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Invested
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Current Value
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Gain/Loss
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Claimable
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {investments.map((investment) => {
              const gainLoss = calculateGainLoss(
                investment.currentValue,
                investment.amount,
              );
              const isClaiming = claimingIds.has(investment.id);

              return (
                <tr
                  key={investment.id}
                  className="hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-white">
                        {investment.projectName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Invested {formatDate(investment.dateInvested)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    ${investment.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    ${investment.currentValue.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div
                      className={
                        gainLoss.isPositive ? "text-green-400" : "text-red-400"
                      }
                    >
                      {gainLoss.isPositive ? "+" : ""}$
                      {gainLoss.amount.toLocaleString()}
                      <div className="text-xs">
                        ({gainLoss.isPositive ? "+" : ""}
                        {gainLoss.percentage}%)
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="text-purple-400 font-medium">
                      ${investment.claimableReturns.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(investment.status)}
                  </td>
                  <td className="px-6 py-4">
                    {investment.canClaim && investment.claimableReturns > 0 ? (
                      <Button
                        size="sm"
                        onClick={() => handleClaim(investment)}
                        disabled={isClaiming}
                        className="min-w-[80px]"
                      >
                        {isClaiming ? (
                          <div className="flex items-center">
                            <svg
                              className="animate-spin -ml-1 mr-2 h-3 w-3 text-white"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Claiming
                          </div>
                        ) : (
                          "Claim"
                        )}
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {investment.claimableReturns === 0
                          ? "No returns"
                          : "Not ready"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="px-6 py-4 bg-gray-800/30 border-t border-gray-700">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">
            Total Investments: {investments.length}
          </span>
          <div className="flex space-x-6">
            <span>
              Total Invested:{" "}
              <span className="font-medium">
                $
                {investments
                  .reduce((sum, inv) => sum + inv.amount, 0)
                  .toLocaleString()}
              </span>
            </span>
            <span>
              Total Claimable:{" "}
              <span className="font-medium text-purple-400">
                $
                {investments
                  .reduce((sum, inv) => sum + inv.claimableReturns, 0)
                  .toLocaleString()}
              </span>
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default InvestmentTable;
