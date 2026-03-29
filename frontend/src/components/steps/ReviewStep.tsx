'use client';

import { ProjectFormData } from '@/types/project';
import { formatCurrency } from '@/utils/validation';
import { CheckCircle2, Edit } from 'lucide-react';
import Image from 'next/image';

interface ReviewStepProps {
  data: ProjectFormData;
  onEdit: (step: number) => void;
}

export default function ReviewStep({ data, onEdit }: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Review Your Project</h2>
        <p className="mt-2 text-white/80">
          Take a moment to review all the details before submitting your project.
        </p>
      </div>

      {/* Basics Section */}
      <div className="bg-white/15 backdrop-blur-md border-2 border-white/30 rounded-lg p-6 shadow-md">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-white/90" />
              Project Basics
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onEdit(0)}
            className="text-white hover:text-white/90 hover:bg-white/10 px-3 py-1 rounded-lg flex items-center gap-1 text-sm font-medium transition-colors backdrop-blur-sm"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-white/70 uppercase tracking-wide">Title</p>
            <p className="text-white mt-1">{data.title}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-white/70 uppercase tracking-wide">Description</p>
            <p className="text-white/90 mt-1 text-sm leading-relaxed">{data.description}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-white/70 uppercase tracking-wide">Category</p>
            <span className="inline-block mt-1 px-3 py-1 bg-white/20 backdrop-blur-sm text-white rounded-full text-xs font-medium border border-primary">
              {data.category}
            </span>
          </div>
          {data.imageUrl && (
            <div>
              <p className="text-xs font-medium text-white/70 uppercase tracking-wide">Image</p>
              <div className="mt-2 relative w-full max-w-md h-48 rounded-lg overflow-hidden border-2 border-white/30">
                <Image 
                  src={data.imageUrl} 
                  alt="Project" 
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Funding Section */}
      <div className="bg-white/15 backdrop-blur-md border-2 border-white/30 rounded-lg p-6 shadow-md">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-white/90" />
              Funding Details
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onEdit(1)}
            className="text-white hover:text-white/90 hover:bg-white/10 px-3 py-1 rounded-lg flex items-center gap-1 text-sm font-medium transition-colors backdrop-blur-sm"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-medium text-white/70 uppercase tracking-wide">Funding Goal</p>
            <p className="text-2xl font-bold text-white mt-1">{formatCurrency(data.fundingGoal)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-white/70 uppercase tracking-wide">Duration</p>
            <p className="text-2xl font-bold text-white/90 mt-1">{data.duration} days</p>
          </div>
          <div>
            <p className="text-xs font-medium text-white/70 uppercase tracking-wide">Wallet Address</p>
            <p className="text-xs font-mono text-white/80 mt-1 break-all">{data.walletAddress}</p>
          </div>
        </div>
      </div>

      {/* Milestones Section */}
      <div className="bg-white/15 backdrop-blur-md border-2 border-white/30 rounded-lg p-6 shadow-md">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-white/90" />
              Milestones ({data.milestones.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onEdit(2)}
            className="text-white hover:text-white/90 hover:bg-white/10 px-3 py-1 rounded-lg flex items-center gap-1 text-sm font-medium transition-colors backdrop-blur-sm"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>
        <div className="space-y-3">
          {data.milestones.map((milestone, index) => (
            <div key={milestone.id} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border-2 border-white/20">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-7 h-7 rounded-full bg-white/30 backdrop-blur-sm text-white font-bold flex items-center justify-center text-sm shadow-md border border-white/20">
                      {index + 1}
                    </span>
                    <h4 className="font-semibold text-white">{milestone.title}</h4>
                  </div>
                  {milestone.description && (
                    <p className="text-sm text-white/80 ml-10">{milestone.description}</p>
                  )}
                  {milestone.estimatedDate && (
                    <p className="text-xs text-white/60 ml-10 mt-2">
                      Estimated: {new Date(milestone.estimatedDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-white">{milestone.percentage}%</span>
                  <p className="text-xs text-white/60 mt-1">{formatCurrency(data.fundingGoal * milestone.percentage / 100)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Submit Info */}
      <div className="bg-white/15 backdrop-blur-md border-2 border-white/30 rounded-lg p-6 shadow-md">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="text-base font-semibold text-white">Ready to Launch?</h4>
            <p className="text-sm text-white/80 mt-1">
              Once you submit, your project will be published on the Stellar blockchain. 
              Make sure all information is accurate and complete.
            </p>
            <ul className="text-sm text-white/80 mt-3 space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-white/90" />
                All required fields are complete
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-white/90" />
                Milestones total 100%
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-white/90" />
                Wallet address is valid
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
