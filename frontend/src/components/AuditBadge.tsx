"use client";

import {
  ShieldCheck,
  ExternalLink,
  ShieldAlert,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { HoverCard } from "./ui/HoverCard";

interface AuditBadgeProps {
  projectId: string;
}

export function AuditBadge({}: AuditBadgeProps) {
  // Mock data for project audit metadata. In reality, you'd fetch this using the projectId
  // from a backend service or smart contract RPC check.
  const auditData = {
    auditor: "CertiK",
    score: 98,
    status: "Verified",
    date: "March 15, 2026",
    issues: {
      critical: 0,
      high: 0,
      medium: 1,
      low: 3,
    },
    url: "#",
  };

  return (
    <HoverCard
      trigger={
        <div className="flex cursor-default items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400 transition-all hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]">
          <ShieldCheck className="h-4 w-4" />
          <span>Audited</span>
        </div>
      }
      className="w-[340px] rounded-2xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl backdrop-blur-md normal-case tracking-normal"
    >
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">
                Smart Contract Audit
              </h4>
              <p className="text-xs text-white/50 mt-0.5">
                by {auditData.auditor}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xl font-bold text-emerald-400">
              {auditData.score}
              <span className="text-sm text-white/40">/100</span>
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-emerald-500/70 mt-0.5">
              Security Score
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm text-white/70">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Critical vulnerabilities
            </span>
            <span className="font-semibold text-white bg-white/5 px-2 py-0.5 rounded-md">
              {auditData.issues.critical}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm text-white/70">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              High risk findings
            </span>
            <span className="font-semibold text-white bg-white/5 px-2 py-0.5 rounded-md">
              {auditData.issues.high}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm text-white/70">
            <span className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              Medium risk findings
            </span>
            <span className="font-semibold text-white bg-white/5 px-2 py-0.5 rounded-md">
              {auditData.issues.medium}
            </span>
          </div>

          <div className="mt-3 rounded-xl border border-white/5 bg-black/30 p-3 text-xs leading-relaxed text-white/60">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Conclusion
            </span>
            <p>
              Contracts align precisely with decentralized best practices. Minor
              architectural optimizations were acknowledged.
            </p>
          </div>
        </div>

        {/* Action */}
        <a
          href={auditData.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-semibold text-white transition-all hover:bg-white/10 hover:border-white/20"
        >
          <FileText className="h-4 w-4 text-purple-300 transition-colors group-hover:text-purple-200" />
          View Full Report
          <ExternalLink className="ml-1 h-3.5 w-3.5 text-white/40 transition-colors group-hover:text-white/60" />
        </a>
      </div>
    </HoverCard>
  );
}
