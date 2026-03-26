"use client";

import React, { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import InvestmentTable from "@/components/InvestmentTable";
import PortfolioStats from "@/components/PortfolioStats";
import PortfolioChart from "@/components/PortfolioChart";
import LoadingDashboard from "@/components/LoadingDashboard";


// Mock data types
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

// Mock data
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
  const [portfolioData, setPortfolioData] =
    useState<PortfolioData>(mockPortfolioData);
  const [isLoading, setIsLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleClaim = async (investmentId: string, amount: number) => {
    try {
      // Mock claim process
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Update portfolio data
      setPortfolioData((prev) => ({
        ...prev,
        investments: prev.investments.map((inv) =>
          inv.id === investmentId
            ? { ...inv, claimableReturns: 0, canClaim: false }
            : inv,
        ),
        totalClaimableReturns: prev.totalClaimableReturns - amount,
      }));

      // Show success toast
      setToastMessage(`Successfully claimed $${amount.toLocaleString()}!`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      setToastMessage("Failed to claim returns. Please try again.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const hasInvestments = portfolioData.investments.length > 0;

  if (isLoading) {
    return <LoadingDashboard />;
  }

  return (
    <>
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-20 right-4 z-50 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in backdrop-blur-sm border border-white/20">
          {toastMessage}
        </div>
      )}

      <div className="container mx-auto px-4 py-8 pt-16">
        <div className="mb-10">
          <div className="inline-block px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-600/20 to-indigo-600/20 text-purple-300 text-sm font-medium mb-4">
            Investor Dashboard
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent mb-4">
            Portfolio Overview
          </h1>
          <p className="text-slate-400 max-w-2xl">
            Track your investments, monitor returns, and manage your portfolio with real-time insights.
          </p>
        </div>

        <div className="mb-8">
          {hasInvestments && (
            <Button
              onClick={() => (window.location.href = "/explore")}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-sm hover:shadow-md"
            >
              Explore More Projects
            </Button>
          )}
        </div>

        {hasInvestments ? (
          <>
            {/* Portfolio Stats */}
            <PortfolioStats data={portfolioData} />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
              {/* Investment Table */}
              <div className="lg:col-span-2">
                <InvestmentTable
                  investments={portfolioData.investments}
                  onClaim={handleClaim}
                />
              </div>

              {/* Portfolio Chart */}
              <div className="lg:col-span-1">
                <PortfolioChart investments={portfolioData.investments} />
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-16 px-4">
            <div className="mx-auto max-w-md">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-slate-800 to-slate-900 border border-white/10 mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
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
          </div>
        )}
      </div>
    </>
  );
}
