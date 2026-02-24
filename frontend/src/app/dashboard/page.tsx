'use client';

import React, { useState, useEffect } from "react";
import { useAnalyticsData } from "../hooks/useAnalyticsData";
import { usePredictiveModels } from "../hooks/usePredictiveModels";

// Analytics Components
import { PerformanceChart } from "./components/PerformanceChart";
import { RiskMetrics } from "./components/RiskMetrics";
import { PredictiveInsights } from "./components/PredictiveInsights";
import { MarketTrends } from "./components/MarketTrends";

// Portfolio Components
import Button from "@/components/ui/Button";
import InvestmentTable from "@/components/InvestmentTable";
import PortfolioStats from "@/components/PortfolioStats";
import PortfolioChart from "@/components/PortfolioChart";
import LoadingDashboard from "@/components/LoadingDashboard";

// Types
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

interface PortfolioData {
  totalInvested: number;
  totalCurrentValue: number;
  totalClaimableReturns: number;
  totalProjects: number;
  investments: Investment[];
}

// Mock data for portfolio
const mockPortfolioData: PortfolioData = {
  totalInvested: 15000,
  totalCurrentValue: 18500,
  totalClaimableReturns: 2800,
  totalProjects: 8,
  investments: [
    {
      id: "1",
      projectName: "Solar Panel Initiative",
      amount: 5000,
      dateInvested: "2024-01-15",
      status: "active",
      currentValue: 6200,
      claimableReturns: 800,
      canClaim: true,
    },
    {
      id: "2",
      projectName: "Urban Farming Project",
      amount: 3000,
      dateInvested: "2024-02-20",
      status: "active",
      currentValue: 3600,
      claimableReturns: 400,
      canClaim: true,
    },
    {
      id: "3",
      projectName: "Clean Water Access",
      amount: 2500,
      dateInvested: "2024-03-10",
      status: "active",
      currentValue: 2800,
      claimableReturns: 200,
      canClaim: false,
    },
    {
      id: "4",
      projectName: "Education Technology",
      amount: 4500,
      dateInvested: "2024-01-05",
      status: "completed",
      currentValue: 5900,
      claimableReturns: 1400,
      canClaim: true,
    },
  ],
};

export default function DashboardPage() {
  // Portfolio state
  const [portfolioData, setPortfolioData] =
    useState<PortfolioData>(mockPortfolioData);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Analytics state
  const { data: analyticsData, isLoading: isLoadingAnalytics } = useAnalyticsData();
  const { data: predictiveData } = usePredictiveModels();

  // Simulate portfolio loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoadingPortfolio(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleClaim = async (investmentId: string, amount: number) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setPortfolioData((prev) => ({
        ...prev,
        investments: prev.investments.map((inv) =>
          inv.id === investmentId
            ? { ...inv, claimableReturns: 0, canClaim: false }
            : inv
        ),
        totalClaimableReturns: prev.totalClaimableReturns - amount,
      }));
      setToastMessage(`Successfully claimed $${amount.toLocaleString()}!`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      await fetch("/api/notifications/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "contribution_confirmation",
          title: "Returns claimed",
          message: `Successfully claimed $${amount.toLocaleString()} from your investment.`,
          link: "/dashboard",
        }),
      });
    } catch {
      setToastMessage("Failed to claim returns. Please try again.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const hasInvestments = portfolioData.investments.length > 0;

  if (isLoadingPortfolio || isLoadingAnalytics) {
    return <LoadingDashboard />;
  }

  return (
    <>
      {showToast && (
        <div className="fixed top-20 right-4 z-50 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in backdrop-blur-sm border border-white/20">
          {toastMessage}
        </div>
      )}

      <div className="container mx-auto px-4 py-8 pt-16">
        <div className="mb-10">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent mb-4">
            Unified Dashboard
          </h1>
          <p className="text-slate-400 max-w-2xl">
            Track your portfolio, monitor returns, and gain predictive insights with advanced analytics.
          </p>
        </div>

        {/* Portfolio Section */}
        {hasInvestments ? (
          <>
            <PortfolioStats data={portfolioData} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
              <div className="lg:col-span-2">
                <InvestmentTable
                  investments={portfolioData.investments}
                  onClaim={handleClaim}
                />
              </div>
              <div className="lg:col-span-1">
                <PortfolioChart investments={portfolioData.investments} />
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-16 px-4">
            <h3 className="text-2xl font-bold text-white mb-2">No Investments Yet</h3>
            <p className="text-slate-400 mb-8 max-w-sm mx-auto">
              Start building your portfolio by exploring and investing in impactful projects.
            </p>
            <Button
              onClick={() => (window.location.href = "/explore")}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500"
            >
              Explore Projects
            </Button>
          </div>
        )}

        {/* Analytics Section */}
        <div className="mt-16 grid gap-6 md:grid-cols-2">
          <PerformanceChart data={analyticsData.performance} />
          <RiskMetrics metrics={analyticsData.risk} />
          <PredictiveInsights insights={predictiveData?.insights || []} />
          <MarketTrends data={analyticsData.trends} />
        </div>
      </div>
    </>
  );
}
