"use client";

import { ProjectFormData, ValidationErrors } from '@/types/project';
import { DollarSign, Calendar, Wallet } from 'lucide-react';
import { Term } from '@/components/ui';

interface FundingStepProps {
  data: ProjectFormData;
  errors: ValidationErrors;
  onChange: (field: keyof ProjectFormData, value: unknown) => void;
}

export default function FundingStep({
  data,
  errors,
  onChange,
}: FundingStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold text-white">Funding Details</h2>
        <p className="mt-2 text-white/60 text-base">
          Set your funding goal and timeline. These help backers understand your
          project&apos;s scope.
        </p>
      </div>

      {/* Funding Goal */}
      <div>
        <label
          htmlFor="fundingGoal"
          className="block text-sm font-medium text-white/90 mb-2"
        >
          Funding Goal (USD) <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <DollarSign className="h-5 w-5 text-white/40" />
          </div>
          <input
            type="number"
            id="fundingGoal"
            value={data.fundingGoal || ""}
            onChange={(e) =>
              onChange("fundingGoal", parseFloat(e.target.value) || 0)
            }
            placeholder="10000"
            min="0"
            step="100"
            className={`w-full pl-11 pr-4 py-3 bg-white/5 border rounded-xl focus:outline-none focus:ring-2 transition-all text-white placeholder:text-white/30 ${
              errors.fundingGoal
                ? "border-red-500/50 focus:ring-red-500/20 focus:border-red-500/50 bg-red-500/5"
                : "border-white/10 focus:ring-primary/20 focus:border-primary/50 hover:border-white/20 hover:bg-white/10"
            }`}
          />
        </div>
        {errors.fundingGoal && (
          <p className="text-sm text-red-500 mt-1">{errors.fundingGoal}</p>
        )}
        <p className="text-xs text-white/40 mt-1">
          How much funding do you need to complete your project?
        </p>
      </div>

      {/* Duration */}
      <div>
        <label
          htmlFor="duration"
          className="block text-sm font-medium text-white/90 mb-2"
        >
          Campaign Duration (days) <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Calendar className="h-5 w-5 text-white/40" />
          </div>
          <input
            type="number"
            id="duration"
            value={data.duration || ""}
            onChange={(e) =>
              onChange("duration", parseInt(e.target.value) || 0)
            }
            placeholder="30"
            min="1"
            max="365"
            className={`w-full pl-11 pr-4 py-3 bg-white/5 border rounded-xl focus:outline-none focus:ring-2 transition-all text-white placeholder:text-white/30 ${
              errors.duration
                ? "border-red-500/50 focus:ring-red-500/20 focus:border-red-500/50 bg-red-500/5"
                : "border-white/10 focus:ring-primary/20 focus:border-primary/50 hover:border-white/20 hover:bg-white/10"
            }`}
          />
        </div>
        {errors.duration && (
          <p className="text-sm text-red-500 mt-1">{errors.duration}</p>
        )}
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[30, 60, 90].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => onChange("duration", days)}
              className={`px-4 py-2 text-sm rounded-lg transition-all font-medium border ${
                data.duration === days
                  ? "bg-primary text-black border-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                  : "bg-white/5 text-white border-white/10 hover:bg-white/10 hover:border-white/20"
              }`}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>

      {/* Stellar Wallet Address */}
      <div>
        <label htmlFor="walletAddress" className="block text-sm font-medium text-white/90 mb-2">
          <Term termKey="wallet" side="top" /> <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Wallet className="h-5 w-5 text-white/40" />
          </div>
          <input
            type="text"
            id="walletAddress"
            value={data.walletAddress}
            onChange={(e) => onChange("walletAddress", e.target.value)}
            placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
            className={`w-full pl-11 pr-4 py-3 bg-white/5 border rounded-xl focus:outline-none focus:ring-2 transition-all font-mono text-sm text-white placeholder:text-white/30 ${
              errors.walletAddress
                ? "border-red-500/50 focus:ring-red-500/20 focus:border-red-500/50 bg-red-500/5"
                : "border-white/10 focus:ring-primary/20 focus:border-primary/50 hover:border-white/20 hover:bg-white/10"
            }`}
          />
        </div>
        {errors.walletAddress && (
          <p className="text-sm text-red-500 mt-1">{errors.walletAddress}</p>
        )}
        <p className="text-xs text-white/40 mt-1">
          Your <Term termKey="stellar" side="right" /> public address where funds will be received. Must start with &apos;G&apos;.
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-primary/5 border-l-4 border-primary rounded-r-xl p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg
              className="w-5 h-5 text-primary"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-medium text-white/90"><Term termKey="allOrNothing" side="right" /></h4>
            <p className="text-sm text-white/60 mt-1">
              Funds are only released if you reach your goal within the
              specified duration. This protects backers and ensures you have
              enough to deliver.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
