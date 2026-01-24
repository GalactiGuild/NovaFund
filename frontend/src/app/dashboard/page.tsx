"use client";

import React, { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import InvestmentTable from "@/components/InvestmentTable";
import PortfolioStats from "@/components/PortfolioStats";
import PortfolioChart from "@/components/PortfolioChart";
import EmptyState from "@/components/EmptyState";
import DashboardLayout from "@/components/layout/DashboardLayout";
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
    <DashboardLayout>
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in">
          {toastMessage}
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Portfolio Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Track your investments and manage returns
            </p>
          </div>
          {hasInvestments && (
            <Button
              onClick={() => (window.location.href = "/explore")}
              variant="secondary"
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
          <EmptyState
            title="No Investments Yet"
            description="Start building your portfolio by exploring and investing in impactful projects."
            actionText="Explore Projects"
            actionHref="/explore"
          />
        )}
      </div>
    </DashboardLayout>
  );
}
