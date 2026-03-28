"use client";

import { Check, Clock, Lock, AlertTriangle } from "lucide-react";

export type MilestoneStatus = "completed" | "active" | "pending" | "disputed";

export type Milestone = {
  id: string;
  title: string;
  date: string;
  description: string;
  status: MilestoneStatus;
};

const statusMeta: Record<
  MilestoneStatus,
  {
    label: string;
    iconBg: string;
    iconColor: string;
    borderColor: string;
    badgeBg: string;
    badgeText: string;
    isLocked: boolean;
  }
> = {
  completed: {
    label: "Completed",
    iconBg: "bg-emerald-500",
    iconColor: "text-white",
    borderColor: "border-emerald-500",
    badgeBg: "bg-emerald-500/20",
    badgeText: "text-emerald-300",
    isLocked: false,
  },
  active: {
    label: "In Progress",
    iconBg: "bg-amber-500",
    iconColor: "text-white",
    borderColor: "border-amber-400",
    badgeBg: "bg-amber-500/20",
    badgeText: "text-amber-300",
    isLocked: false,
  },
  pending: {
    label: "Pending",
    iconBg: "bg-transparent",
    iconColor: "text-slate-400",
    borderColor: "border-slate-500",
    badgeBg: "bg-slate-500/20",
    badgeText: "text-slate-400",
    isLocked: true,
  },
  disputed: {
    label: "Disputed",
    iconBg: "bg-rose-500",
    iconColor: "text-white",
    borderColor: "border-rose-500",
    badgeBg: "bg-rose-500/20",
    badgeText: "text-rose-300",
    isLocked: false,
  },
};

const iconMap: Record<MilestoneStatus, typeof Check> = {
  completed: Check,
  active: Clock,
  pending: Lock,
  disputed: AlertTriangle,
};

type MilestoneTimelineProps = {
  milestones: Milestone[];
};

export default function MilestoneTimeline({ milestones }: MilestoneTimelineProps) {
  const today = new Date();

  return (
    <div className="relative w-full max-w-2xl">
      <div
        aria-hidden="true"
        className="absolute left-6 top-8 bottom-8 w-0.5 bg-gradient-to-b from-emerald-500/50 via-amber-500/50 to-slate-600/30"
      />

      <div className="space-y-8">
        {milestones.map((milestone, index) => {
          const meta = statusMeta[milestone.status];
          const StatusIcon = iconMap[milestone.status];
          const milestoneDate = new Date(milestone.date);
          const isFuture = milestoneDate > today && meta.isLocked;

          return (
            <div
              key={milestone.id}
              className={`relative flex gap-6 ${index === milestones.length - 1 ? "" : ""}`}
            >
              <div className="relative z-10 flex-shrink-0">
                <div
                  className={`
                    flex h-12 w-12 items-center justify-center rounded-full border-2
                    ${milestone.status === "active" ? "animate-pulse" : ""}
                    ${milestone.status === "completed" ? "bg-emerald-500 border-emerald-500" : ""}
                    ${milestone.status === "active" ? `bg-amber-500 ${meta.borderColor}` : ""}
                    ${milestone.status === "pending" ? `border-2 border-slate-500 bg-slate-900/50` : ""}
                    ${milestone.status === "disputed" ? `bg-rose-500 ${meta.borderColor}` : ""}
                  `}
                >
                  <StatusIcon className={`h-5 w-5 ${meta.iconColor}`} />
                </div>
              </div>

              <div
                className={`
                  relative flex-1 rounded-xl border p-5
                  ${milestone.status === "completed" ? "border-emerald-500/30 bg-emerald-500/5" : ""}
                  ${milestone.status === "active" ? "border-amber-400/50 bg-amber-500/5 shadow-[0_0_20px_rgba(251,191,36,0.1)]" : ""}
                  ${milestone.status === "pending" ? "border-slate-600/30 bg-slate-800/30" : ""}
                  ${milestone.status === "disputed" ? "border-rose-500/30 bg-rose-500/5" : ""}
                `}
              >
                {isFuture && (
                  <div className="absolute inset-0 rounded-xl bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Lock className="h-4 w-4" />
                      <span className="text-sm font-medium">Locked until due date</span>
                    </div>
                  </div>
                )}

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-white truncate">
                        {milestone.title}
                      </h3>
                      <span
                        className={`
                          inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${meta.badgeBg} ${meta.badgeText}
                        `}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{milestone.date}</p>
                    <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                      {milestone.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
