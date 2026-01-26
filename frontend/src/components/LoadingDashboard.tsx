import React from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";

const LoadingDashboard: React.FC = () => {
  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <div className="h-8 bg-gray-700 rounded w-64 mb-2"></div>
              <div className="h-4 bg-gray-700 rounded w-48"></div>
            </div>
            <div className="h-10 bg-gray-700 rounded w-32"></div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="h-4 bg-gray-700 rounded w-20 mb-2"></div>
                    <div className="h-8 bg-gray-700 rounded w-16 mb-1"></div>
                    <div className="h-3 bg-gray-700 rounded w-24"></div>
                  </div>
                  <div className="w-12 h-12 bg-gray-700 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Investment Table */}
            <div className="lg:col-span-2">
              <div className="bg-gray-800 rounded-lg">
                <div className="p-6 border-b border-gray-700">
                  <div className="h-6 bg-gray-700 rounded w-40 mb-2"></div>
                  <div className="h-4 bg-gray-700 rounded w-64"></div>
                </div>
                <div className="p-6 space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <div className="h-4 bg-gray-700 rounded flex-1"></div>
                      <div className="h-4 bg-gray-700 rounded w-20"></div>
                      <div className="h-4 bg-gray-700 rounded w-20"></div>
                      <div className="h-4 bg-gray-700 rounded w-16"></div>
                      <div className="h-8 bg-gray-700 rounded w-16"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="lg:col-span-1">
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="h-6 bg-gray-700 rounded w-32 mb-4"></div>
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-3">
                      <div className="h-3 bg-gray-700 rounded w-16"></div>
                      <div className="h-3 bg-gray-700 rounded flex-1"></div>
                      <div className="h-3 bg-gray-700 rounded w-12"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default LoadingDashboard;
