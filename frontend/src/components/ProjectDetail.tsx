"use client";

import React from "react";
import * as Progress from "@radix-ui/react-progress";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Info, FileText, Download, TrendingUp, Calendar, Lock } from "lucide-react";
import { AuditBadge } from "./AuditBadge";
import MilestoneTimeline, { type Milestone } from "./MilestoneTimeline";
import { Term } from "@/components/ui";

export interface RWAProjectProps {
  id: string;
  name: string;
  ticker: string;
  category: string;
  totalValueLocked: string;
  expectedYield: string;
  maturityDate: string;
  fundingTarget: number;
  fundsCommitted: number;
  milestones: Milestone[];
}

export function ProjectDetail({ project }: { project: RWAProjectProps }) {
  const progressPercentage = Math.round((project.fundsCommitted / project.fundingTarget) * 100);

  const legalDocs = [
    { title: "Offering Memorandum", type: "PDF", size: "2.4 MB" },
    { title: "Asset Tokenization Agreement", type: "PDF", size: "1.1 MB" },
    { title: "SPV Registration Certificate", type: "PDF", size: "850 KB" },
    { title: "Risk Disclosure", type: "PDF", size: "1.5 MB" }
  ];

  return (
    <div className="flex flex-col gap-10">
      {/* Header Section */}
      <section className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <span className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-white/80 backdrop-blur">
            {project.category}
          </span>
          <AuditBadge projectId={project.id} />
        </div>
        
        <h1 className="text-5xl font-bold tracking-tight text-white lg:text-7xl drop-shadow-sm">
          {project.name} <span className="text-purple-400 font-light tracking-normal opacity-90">({project.ticker})</span>
        </h1>
      </section>

      {/* RWA Yield Metrics */}
      <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6 shadow-2xl ring-1 ring-white/5 transition-all hover:bg-white/[0.08]">
          <div className="flex items-center justify-between text-white/50 text-[11px] font-bold uppercase tracking-[0.2em] mb-4">
            <Term termKey="yield" side="top" />
            <TrendingUp className="h-5 w-5 text-emerald-400/90" />
          </div>
          <div className="text-4xl font-extrabold tracking-tight text-white drop-shadow-md">{project.expectedYield}</div>
          <p className="mt-2 text-xs font-medium text-white/40">Fixed APY distributed monthly</p>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6 shadow-2xl ring-1 ring-white/5 transition-all hover:bg-white/[0.08]">
          <div className="flex items-center justify-between text-white/50 text-[11px] font-bold uppercase tracking-[0.2em] mb-4">
            <Term termKey="tvl" side="top" />
            <Lock className="h-5 w-5 text-blue-400/90" />
          </div>
          <div className="text-4xl font-extrabold tracking-tight text-white drop-shadow-md">{project.totalValueLocked}</div>
          <p className="mt-2 text-xs font-medium text-white/40">Audited on-chain reserves</p>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6 shadow-2xl ring-1 ring-white/5 transition-all hover:bg-white/[0.08]">
          <div className="flex items-center justify-between text-white/50 text-[11px] font-bold uppercase tracking-[0.2em] mb-4">
            Maturity Date
            <Calendar className="h-5 w-5 text-purple-400/90" />
          </div>
          <div className="text-4xl font-extrabold tracking-tight text-white drop-shadow-md">{project.maturityDate}</div>
          <p className="mt-2 text-xs font-medium text-white/40">Principal repayment target</p>
        </div>
      </section>

      {/* Funding Progress (Radix) */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Funding Progress</h3>
            <div className="mt-2 flex gap-4 text-sm font-medium text-white/60">
              <span className="text-white">${(project.fundsCommitted / 1000).toFixed(0)}K Raised</span>
              <span>Target: ${(project.fundingTarget / 1000).toFixed(0)}K</span>
            </div>
          </div>
          <span className="text-2xl font-bold text-emerald-400 drop-shadow-sm">{progressPercentage}%</span>
        </div>
        
        <Progress.Root 
          className="relative h-4 w-full overflow-hidden rounded-full bg-black/50 border border-white/10 shadow-inner" 
          value={progressPercentage}
        >
          <Progress.Indicator
            className="h-full w-full flex-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-300 transition-all duration-[800ms] ease-[cubic-bezier(0.65, 0, 0.35, 1)]"
            style={{ transform: `translateX(-${100 - progressPercentage}%)` }}
          />
        </Progress.Root>
      </section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Legal & Compliance */}
        <section className="flex flex-col rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-white tracking-tight">Legal Documents</h3>
            <Tooltip.Provider delayDuration={200}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button className="rounded-full bg-white/5 p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white/80">
                    <Info className="h-4 w-4" />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content 
                    className="max-w-xs rounded-xl border border-white/10 bg-slate-950/95 px-4 py-3 text-xs font-medium leading-relaxed text-white shadow-2xl backdrop-blur-xl z-50"
                    sideOffset={5}
                  >
                    All documents are cryptographically hashed and verified on-chain.
                    <Tooltip.Arrow className="fill-slate-950" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          </div>
          
          <div className="flex flex-col gap-3">
            {legalDocs.map((doc, idx) => (
              <div 
                key={idx} 
                className="group flex cursor-pointer items-center justify-between rounded-2xl border border-white/5 bg-black/20 p-4 transition-all hover:bg-white/5 hover:border-white/10 hover:shadow-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-rose-400 transition-colors group-hover:bg-rose-500/20 group-hover:text-rose-300">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white transition-colors group-hover:text-purple-300">{doc.title}</h4>
                    <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-white/40">{doc.type} • {doc.size}</p>
                  </div>
                </div>
                <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/40 opacity-0 transition-all group-hover:opacity-100 group-hover:bg-white/10 group-hover:text-white">
                  <Download className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Timeline */}
        <section className="flex flex-col rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl">
          <h3 className="text-xl font-bold text-white tracking-tight mb-8">Execution Timeline</h3>
          <MilestoneTimeline milestones={project.milestones} />
        </section>
      </div>

    </div>
  );
}
