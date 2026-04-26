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
      // Emit real-time notification (notification center + other tabs)
      try {
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
        // ignore
      }
    } catch {
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
    <div className="relative min-h-screen bg-[#050505] text-foreground overflow-hidden">
      {/* Subtle background glows */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-primary/20 opacity-40 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-1/4 h-[400px] w-[400px] -translate-y-1/2 rounded-[100%] bg-purple-600/10 opacity-30 blur-[100px]" />

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-20 right-4 z-50 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg animate-fade-in backdrop-blur-sm border border-white/20">
          {toastMessage}
        </div>
      )}

      <div className="container relative mx-auto px-6 py-12 z-10 max-w-7xl">
        <div className="mb-10 lg:mt-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6 shadow-[0_0_20px_rgba(var(--primary),0.2)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Investor Dashboard
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl mb-4">
            <span className="bg-gradient-to-r from-primary via-blue-400 to-purple-500 bg-clip-text text-transparent">
              Portfolio
            </span>{" "}
            Overview
          </h1>
          <p className="text-white/50 font-light leading-relaxed max-w-2xl text-lg">
            Track your investments, monitor returns, and manage your portfolio
            with real-time insights.
          </p>
        </div>

        <div className="mb-10">
          {hasInvestments && (
            <Button
              onClick={() => (window.location.href = "/explore")}
              className="rounded-full border border-primary/50 bg-primary/10 px-8 py-3 text-sm font-medium text-primary transition-all hover:bg-primary hover:text-black hover:shadow-[0_0_20px_rgba(var(--primary),0.5)]"
            >
              Explore More Projects
            </Button>
          )}
        </div>

        {hasInvestments ? (
          <>
            <PortfolioStats data={portfolioData} />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12 mb-20">
              {/* Investment Table */}
              <div className="lg:col-span-2 relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/60 p-6 sm:p-8 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                <div className="absolute inset-x-0 -top-px h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <InvestmentTable
                  investments={portfolioData.investments}
                  onClaim={handleClaim}
                />
              </div>

              {/* Portfolio Chart */}
              <div className="lg:col-span-1 relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/60 p-6 sm:p-8 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                <div className="absolute inset-x-0 -top-px h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <PortfolioChart investments={portfolioData.investments} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center rounded-3xl border border-white/5 bg-white/[0.01]">
            <div className="rounded-full border border-white/10 bg-zinc-900/50 p-6 mb-6 shadow-xl backdrop-blur-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-3xl font-light tracking-tight text-white">
              No Investments Yet
            </h3>
            <p className="mt-3 text-zinc-500 max-w-sm mx-auto mb-8">
              Start building your portfolio by exploring and investing in
              impactful projects.
            </p>
            <Button
              onClick={() => (window.location.href = "/explore")}
              className="rounded-full border border-primary bg-primary px-8 py-3 text-sm font-medium text-black transition-all hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(var(--primary),0.5)]"
            >
              Explore Projects
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
