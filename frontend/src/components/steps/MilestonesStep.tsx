"use client";

import { ProjectFormData, Milestone, ValidationErrors } from '@/types/project';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Term } from '@/components/ui';

interface MilestonesStepProps {
  data: ProjectFormData;
  errors: ValidationErrors;
  onChange: (field: keyof ProjectFormData, value: unknown) => void;
}

export default function MilestonesStep({
  data,
  errors,
  onChange,
}: MilestonesStepProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const addMilestone = () => {
    const newMilestone: Milestone = {
      id: `milestone-${Date.now()}`,
      title: "",
      description: "",
      percentage: 0,
      estimatedDate: "",
    };
    onChange("milestones", [...data.milestones, newMilestone]);
    setEditingId(newMilestone.id);
  };

  const updateMilestone = (
    id: string,
    field: keyof Milestone,
    value: unknown,
  ) => {
    const updatedMilestones = data.milestones.map((m) =>
      m.id === id ? { ...m, [field]: value } : m,
    );
    onChange("milestones", updatedMilestones);
  };

  const removeMilestone = (id: string) => {
    onChange(
      "milestones",
      data.milestones.filter((m) => m.id !== id),
    );
    if (editingId === id) setEditingId(null);
  };

  const totalPercentage = data.milestones.reduce(
    (sum, m) => sum + m.percentage,
    0,
  );
  const remainingPercentage = 100 - totalPercentage;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold text-white">
          Project <Term termKey="milestone" side="right" />
        </h2>
        <p className="mt-2 text-white/60 text-base">
          Break your project into key milestones. This builds trust and shows
          backers your roadmap.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="bg-primary/5 border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white/90">
            Total Allocation
          </span>
          <span
            className={`text-lg font-bold ${totalPercentage === 100 ? "text-green-400" : totalPercentage > 100 ? "text-red-400" : "text-white"}`}
          >
            {totalPercentage}%
          </span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-3 border border-white/10 shadow-inner">
          <div
            className={`h-full rounded-full transition-all ${
              totalPercentage === 100
                ? "bg-green-600"
                : totalPercentage > 100
                  ? "bg-red-500"
                  : "bg-primary"
            }`}
            style={{ width: `${Math.min(totalPercentage, 100)}%` }}
          />
        </div>
        {remainingPercentage !== 0 && (
          <p className="text-xs text-white/60 mt-2">
            {remainingPercentage > 0
              ? `${remainingPercentage}% remaining`
              : `Over by ${Math.abs(remainingPercentage)}%`}
          </p>
        )}
      </div>

      {/* Validation Errors */}
      {errors.milestones && (
        <div className="bg-red-500/10 border border-red-500 rounded-md p-3">
          <p className="text-sm text-red-500">{errors.milestones}</p>
        </div>
      )}

      {/* Milestones List */}
      <div className="space-y-4">
        {data.milestones.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-xl border-2 border-dashed border-white/20">
            <svg
              className="w-12 h-12 mx-auto text-white/40 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-white/90 font-medium">No milestones yet</p>
            <p className="text-sm text-white/60 mt-1">
              Add your first milestone to get started
            </p>
          </div>
        ) : (
          data.milestones.map((milestone, index) => (
            <div
              key={milestone.id}
              className="bg-white/5 border border-white/10 rounded-xl p-4 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-black font-bold flex items-center justify-center text-sm shadow-[0_0_15px_rgba(var(--primary),0.3)]">
                    {index + 1}
                  </div>
                  <h4 className="font-medium text-white/90">
                    Milestone {index + 1}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => removeMilestone(milestone.id)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-500/10 p-2 rounded-md transition-colors"
                  title="Remove milestone"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                {/* Title */}
                <div>
                  <label className="block text-xs font-medium text-white/90 mb-1">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={milestone.title}
                    onChange={(e) =>
                      updateMilestone(milestone.id, "title", e.target.value)
                    }
                    placeholder="e.g., Prototype Development"
                    className={`w-full px-3 py-2 bg-white/5 border rounded-lg focus:outline-none focus:ring-2 transition-all text-sm text-white placeholder:text-white/30 ${
                      errors[`milestone_${index}_title`]
                        ? "border-red-500/50 focus:ring-red-500/20 focus:border-red-500/50 bg-red-500/5"
                        : "border-white/10 focus:ring-primary/20 focus:border-primary/50"
                    }`}
                  />
                  {errors[`milestone_${index}_title`] && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors[`milestone_${index}_title`]}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-white/90 mb-1">
                    Description
                  </label>
                  <textarea
                    value={milestone.description}
                    onChange={(e) =>
                      updateMilestone(
                        milestone.id,
                        "description",
                        e.target.value,
                      )
                    }
                    placeholder="What will be accomplished in this milestone?"
                    rows={2}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 hover:border-white/20 hover:bg-white/10 text-sm resize-none text-white placeholder:text-white/30"
                  />
                </div>

                {/* Percentage and Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">
                      Funding % <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      value={milestone.percentage || ""}
                      onChange={(e) =>
                        updateMilestone(
                          milestone.id,
                          "percentage",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      placeholder="25"
                      min="0"
                      max="100"
                      className={`w-full px-3 py-2 bg-white/5 border rounded-lg focus:outline-none focus:ring-2 transition-all text-sm text-white placeholder:text-white/30 ${
                        errors[`milestone_${index}_percentage`]
                          ? "border-red-500/50 focus:ring-red-500/20 bg-red-500/5"
                          : "border-white/10 focus:ring-primary/20 focus:border-primary/50"
                      }`}
                    />
                    {errors[`milestone_${index}_percentage`] && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors[`milestone_${index}_percentage`]}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/90 mb-1">
                      Estimated Date
                    </label>
                    <input
                      type="date"
                      value={milestone.estimatedDate}
                      onChange={(e) =>
                        updateMilestone(
                          milestone.id,
                          "estimatedDate",
                          e.target.value,
                        )
                      }
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 text-sm text-white/90 color-scheme-dark"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Milestone Button */}
      <button
        type="button"
        onClick={addMilestone}
        className="w-full py-3 border-2 border-dashed border-white/20 text-white rounded-xl hover:bg-white/5 hover:border-white/40 transition-all flex items-center justify-center gap-2 font-medium"
      >
        <Plus className="w-5 h-5" />
        Add Milestone
      </button>

      {/* Helper Info */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
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
            <h4 className="text-sm font-medium text-white/90">
              <Term termKey="milestone" side="top" /> Tips
            </h4>
            <ul className="text-sm text-white/50 mt-1 space-y-1 list-disc list-inside">
              <li>Funding percentages must total exactly 100%</li>
              <li>Break complex projects into 3-5 manageable <Term termKey="milestone" side="left" />s</li>
              <li>Clear <Term termKey="milestone" side="left" />s increase backer confidence and trigger <Term termKey="smartContract" side="bottom" /> releases</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
