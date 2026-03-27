'use client';

import { ProjectFormData } from '@/types/project';
import { formatCurrency } from '@/utils/validation';
import { Calendar, Target, Wallet } from 'lucide-react';
import Image from 'next/image';

interface PreviewCardProps {
  data: ProjectFormData;
}

export default function PreviewCard({ data }: PreviewCardProps) {
  const hasBasicInfo = data.title || data.description || data.category;
  const hasFundingInfo = data.fundingGoal > 0 || data.duration > 0 || data.walletAddress;
  const hasMilestones = data.milestones.length > 0;

  return (
    <div className="sticky top-6 bg-white/20 backdrop-blur-lg rounded-xl shadow-xl border border-white/30 overflow-hidden">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md border-b border-white/20 px-6 py-4">
        <h3 className="text-white font-semibold text-lg">Live Preview</h3>
        <p className="text-white/80 text-sm mt-1">
          See how your project looks in real-time
        </p>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Project Image Placeholder */}
        <div className="aspect-video bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center border-2 border-white/20 relative overflow-hidden">
          {data.imageUrl ? (
            <Image 
              src={data.imageUrl} 
              alt="Project preview" 
              fill
              className="object-cover rounded-lg"
              unoptimized
            />
          ) : (
            <div className="text-center text-white/60">
              <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">Project image</p>
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <h4 className={`text-2xl font-bold ${data.title ? 'text-white' : 'text-white/50'}`}>
            {data.title || 'Your Project Title'}
          </h4>
          {data.category && (
            <span className="inline-block mt-2 px-3 py-1 bg-white/20 backdrop-blur-sm text-white rounded-full text-xs font-medium border border-primary">
              {data.category}
            </span>
          )}
        </div>

        {/* Description */}
        <p className={`text-sm leading-relaxed ${data.description ? 'text-white/90' : 'text-white/50'}`}>
          {data.description || 'Your project description will appear here. Make it compelling to attract backers!'}
        </p>

        {/* Funding Info */}
        {(hasFundingInfo || hasBasicInfo) && (
          <div className="pt-4 border-t border-white/20 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                <Target className="w-5 h-5 text-white/90" />
              </div>
              <div>
                <p className="text-xs text-white/70">Funding Goal</p>
                <p className="text-lg font-bold text-white">
                  {data.fundingGoal > 0 ? formatCurrency(data.fundingGoal) : '$0'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                <Calendar className="w-5 h-5 text-white/90" />
              </div>
              <div>
                <p className="text-xs text-white/70">Duration</p>
                <p className="text-sm font-semibold text-white">
                  {data.duration > 0 ? `${data.duration} days` : 'Not set'}
                </p>
              </div>
            </div>

            {data.walletAddress && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                  <Wallet className="w-5 h-5 text-white/90" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs text-white/70">Stellar Address</p>
                  <p className="text-xs font-mono text-white/80 truncate">
                    {data.walletAddress}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Milestones */}
        {hasMilestones && (
          <div className="pt-4 border-t border-white/20">
            <h5 className="text-sm font-semibold text-white mb-3">Milestones</h5>
            <div className="space-y-2">
              {data.milestones.map((milestone, index) => (
                <div key={milestone.id} className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {milestone.title || `Milestone ${index + 1}`}
                      </p>
                      {milestone.description && (
                        <p className="text-xs text-white/70 mt-1 line-clamp-2">
                          {milestone.description}
                        </p>
                      )}
                    </div>
                    <span className="text-sm font-bold text-white whitespace-nowrap">
                      {milestone.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
