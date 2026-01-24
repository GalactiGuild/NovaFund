import React from "react";
import Button from "@/components/ui/Button";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-white">NovaFund</h1>
              <nav className="hidden md:flex space-x-6">
                <a
                  href="/dashboard"
                  className="text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Dashboard
                </a>
                <a
                  href="/explore"
                  className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Explore
                </a>
                <a
                  href="/portfolio"
                  className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Portfolio
                </a>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="secondary" size="sm">
                Connect Wallet
              </Button>
            </div>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
};

export default DashboardLayout;
