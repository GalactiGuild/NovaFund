"use client";

import { Activity, Check, Lock } from "lucide-react";

export type MilestoneStatus = "completed" | "active" | "locked";

export type Milestone = {
  id: string;
  title: string;
  description: string;
  amount: string;
  due: string;
  status: MilestoneStatus;
  progress: number;
  releaseDetails: string;
};

const statusMeta: Record<
  MilestoneStatus,
  {
    label: string;
    iconBg: string;
    text: string;
    iconColor: string;
  }
> = {
  completed: {
    label: "Released",
    iconBg: "bg-emerald-500/15 text-emerald-300 border-emerald-300/60",
    text: "Funds disbursed",
    iconColor: "text-emerald-300",
  },
  active: {
    label: "Active",
    iconBg: "bg-amber-500/15 text-amber-300 border-amber-300/60 animate-pulse",
    text: "Pending verification",
    iconColor: "text-amber-400",
  },
  locked: {
    label: "Locked",
    iconBg: "bg-slate-700/60 text-slate-200 border-slate-500/40",
    text: "Awaiting prior milestones",
    iconColor: "text-slate-200",
  },
};

const iconMap: Record<MilestoneStatus, typeof Check> = {
  completed: Check,
  active: Activity,
  locked: Lock,
};

type MilestoneTimelineProps = {
  milestones: Milestone[];
};

export default function MilestoneTimeline({ milestones }: MilestoneTimelineProps) {
  return (
    <div className="relative  md:pl-8">
      <div
        aria-hidden="true"
        className="absolute  top-5 h-[calc(83%-1.25rem)] w-px bg-white/50"
      />
      <div className="space-y-10">
        {milestones.map((milestone) => {
          const meta = statusMeta[milestone.status];
          const StatusIcon = iconMap[milestone.status];

          return (
            <div key={milestone.id} className="relative">
              <div className="absolute left-0 top-1">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl border p-2 ${meta.iconBg}`}
                >
                  <StatusIcon className={`h-5 w-5 ${meta.iconColor}`} />
                </div>
              </div>

              <div className="ml-14 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0px_30px_60px_rgba(2,6,23,0.35)]">
                <div className="flex items-center justify-between gap-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                      {meta.label}
                    </p>
                    <h3 className="text-xl font-semibold leading-snug text-white">{milestone.title}</h3>
                  </div>
                  <span className="text-sm font-semibold text-white/70">{milestone.amount}</span>
                </div>
                <p className="mt-3 text-sm text-white/70">{milestone.description}</p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-white/60">
                  <span>{milestone.due}</span>
                  <span>{milestone.releaseDetails}</span>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-medium text-white/70">
                    <span>Progress</span>
                    <span>{milestone.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-rose-500 transition-all"
                      style={{ width: `${milestone.progress}%` }}
                    />
                  </div>
                </div>
                <p className="mt-4 text-xs text-white/60">{meta.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
