'use client';

import { ProjectFormData, ValidationErrors } from '@/types/project';
import { DollarSign, Calendar, Wallet } from 'lucide-react';

interface FundingStepProps {
  data: ProjectFormData;
  errors: ValidationErrors;
  onChange: (field: keyof ProjectFormData, value: any) => void;
}

export default function FundingStep({ data, errors, onChange }: FundingStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Funding Details</h2>
        <p className="mt-2 text-muted-foreground">
          Set your funding goal and timeline. These help backers understand your project&apos;s scope.
        </p>
      </div>

      {/* Funding Goal */}
      <div>
        <label htmlFor="fundingGoal" className="block text-sm font-medium text-foreground mb-2">
          Funding Goal (USD) <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
          </div>
          <input
            type="number"
            id="fundingGoal"
            value={data.fundingGoal || ''}
            onChange={(e) => onChange('fundingGoal', parseFloat(e.target.value) || 0)}
            placeholder="10000"
            min="0"
            step="100"
            className={`w-full pl-11 pr-4 py-3 bg-background border rounded-md focus:outline-none focus:ring-2 transition-all text-foreground placeholder:text-muted-foreground ${
              errors.fundingGoal 
                ? 'border-red-500 focus:ring-red-400 focus:border-red-500' 
                : 'border-border focus:ring-ring focus:border-ring'
            }`}
          />
        </div>
        {errors.fundingGoal && (
          <p className="text-sm text-red-500 mt-1">{errors.fundingGoal}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          How much funding do you need to complete your project?
        </p>
      </div>

      {/* Duration */}
      <div>
        <label htmlFor="duration" className="block text-sm font-medium text-foreground mb-2">
          Campaign Duration (days) <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </div>
          <input
            type="number"
            id="duration"
            value={data.duration || ''}
            onChange={(e) => onChange('duration', parseInt(e.target.value) || 0)}
            placeholder="30"
            min="1"
            max="365"
            className={`w-full pl-11 pr-4 py-3 bg-background border rounded-md focus:outline-none focus:ring-2 transition-all text-foreground placeholder:text-muted-foreground ${
              errors.duration 
                ? 'border-red-500 focus:ring-red-400 focus:border-red-500' 
                : 'border-border focus:ring-ring focus:border-ring'
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
              onClick={() => onChange('duration', days)}
              className={`px-4 py-2 text-sm rounded-md transition-all font-medium border ${
                data.duration === days
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background text-foreground border-border hover:bg-accent'
              }`}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>

      {/* Stellar Wallet Address */}
      <div>
        <label htmlFor="walletAddress" className="block text-sm font-medium text-foreground mb-2">
          Stellar Wallet Address <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Wallet className="h-5 w-5 text-muted-foreground" />
          </div>
          <input
            type="text"
            id="walletAddress"
            value={data.walletAddress}
            onChange={(e) => onChange('walletAddress', e.target.value)}
            placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
            className={`w-full pl-11 pr-4 py-3 bg-background border rounded-md focus:outline-none focus:ring-2 transition-all font-mono text-sm text-foreground placeholder:text-muted-foreground ${
              errors.walletAddress 
                ? 'border-red-500 focus:ring-red-400 focus:border-red-500' 
                : 'border-border focus:ring-ring focus:border-ring'
            }`}
          />
        </div>
        {errors.walletAddress && (
          <p className="text-sm text-red-500 mt-1">{errors.walletAddress}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Your Stellar public address where funds will be received. Must start with &apos;G&apos;.
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-accent/50 border-l-4 border-primary rounded-md p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground">All-or-nothing funding</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Funds are only released if you reach your goal within the specified duration. 
              This protects backers and ensures you have enough to deliver.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
