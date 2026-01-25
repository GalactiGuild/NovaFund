"use client";

import { useMemo, useState } from "react";
import { Clock8, ShieldCheck, Sparkles, Target, Users } from "lucide-react";
import MilestoneTimeline, { type Milestone } from "@/components/MilestoneTimeline";

type ContributionState = "idle" | "loading" | "success" | "error";

const milestones: Milestone[] = [
  {
    id: "m1",
    title: "Governance & Compliance Readiness",
    description:
      "Finalize legal counsel, escrow contract, and validator KPIs while aligning the community charter.",
    amount: "$280K",
    due: "Completed Nov 25, 2025",
    status: "completed",
    progress: 100,
    releaseDetails: "Initial tranche fully released",
  },
  {
    id: "m2",
    title: "Infrastructure & Edge Integration",
    description:
      "Deploy data relays, integrate the audit nodes, and secure telemetry streams for the Aurora corridor.",
    amount: "$320K",
    due: "Completed Dec 12, 2025",
    status: "completed",
    progress: 100,
    releaseDetails: "Validators signed off on release",
  },
  {
    id: "m3",
    title: "Validator Network Expansion",
    description:
      "Bring 12 regional validation nodes online + enable real-time monitoring dashboards.",
    amount: "$410K",
    due: "Active — Awaiting telemetry verification",
    status: "active",
    progress: 68,
    releaseDetails: "Pending validator votes",
  },
  {
    id: "m4",
    title: "Earth-to-Orbit Launch Coordination",
    description:
      "Contract satellite partners, complete orbital handshakes, and onboard insurers for coverage.",
    amount: "$240K",
    due: "Est. Feb 2026",
    status: "locked",
    progress: 34,
    releaseDetails: "Locked until validator milestone clears",
  },
  {
    id: "m5",
    title: "Community Rewards & Reporting",
    description:
      "Publish impact retrospectives, distribute governance tokens, and finalize monitoring dashboards.",
    amount: "$150K",
    due: "Est. Jun 2026",
    status: "locked",
    progress: 12,
    releaseDetails: "Dependent on prior deliverables",
  },
];

const highlightStats = [
  {
    label: "Target Raise",
    value: "$1.4M",
    detail: "Structured across 5 milestone releases",
    icon: Target,
  },
  {
    label: "Funded to date",
    value: "$870K",
    detail: "62% committed by verified investors",
    icon: Sparkles,
  },
  {
    label: "Validator partners",
    value: "12 regional nodes",
    detail: "Decentralized from Toronto to Lagos",
    icon: Users,
  },
  {
    label: "Launch window",
    value: "Q2 2026",
    detail: "Phased rollout after validator votes",
    icon: Clock8,
  },
];

const projectProfile = {
  name: "Lumen Atlas Data Relay",
  ticker: "LADR",
  category: "Climate & Connectivity Infrastructure",
  tagline:
    "A trust-minimized telemetry relay that connects Earth observation sensors to decentralized insurance pools.",
};

export default function ProjectPage({
  params,
}: {
  params: { id: string };
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contributionAmount, setContributionAmount] = useState("0.25");
  const [contributionNote, setContributionNote] = useState("");
  const [contributionStatus, setContributionStatus] = useState<ContributionState>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [latestContribution, setLatestContribution] = useState<
    { amount: string; note: string } | null
  >(null);

  const fundingTarget = 1_400_000;
  const fundsCommitted = 870_000;
  const fundsReleased = 620_000;
  const fundingProgress = Math.round((fundsCommitted / fundingTarget) * 100);
  const releaseProgress = Math.round((fundsReleased / fundingTarget) * 100);

  const completedCount = milestones.filter((milestone) => milestone.status === "completed").length;
  const activeMilestone = useMemo(
    () => milestones.find((milestone) => milestone.status === "active"),
    []
  );

  const openModal = () => {
    setIsModalOpen(true);
    setContributionStatus("idle");
    setStatusMessage("");
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setContributionStatus("idle");
    setStatusMessage("");
  };

  const handleContribute = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(contributionAmount);
    if (!contributionAmount || Number.isNaN(amount) || amount <= 0) {
      setContributionStatus("error");
      setStatusMessage("Enter a contribution amount greater than 0.");
      return;
    }

    setContributionStatus("loading");
    setStatusMessage("");

    setTimeout(() => {
      const success = Math.random() > 0.2;
      if (success) {
        setContributionStatus("success");
        setStatusMessage("Contribution queued. Expect the on-chain release window in 2 minutes.");
        setLatestContribution({
          amount: `${amount.toFixed(2)} XLM`,
          note: contributionNote || "Community wallet",
        });
      } else {
        setContributionStatus("error");
        setStatusMessage("Network handshake failed. Please try again.");
      }
    }, 1400);
  };

  return (
    <div className="min-h-screen max-w-screen overflow-hidden bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl md:px-4 py-10">
        <div className="rounded-4xl border border-white/5 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-950/80 p-8 shadow-[0_25px_80px_rgba(2,6,23,0.65)]">
          <div className="flex flex-col gap-3 text-sm text-white/60">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-white/50">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              <span>Project ID #{params.id}</span>
            </div>
            <h1 className="text-4xl font-semibold text-white sm:text-5xl">
              {projectProfile.name} <span className="text-emerald-300">({projectProfile.ticker})</span>
            </h1>
            <p className="max-w-3xl text-lg text-white/70">{projectProfile.tagline}</p>
            <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.3em] text-white/60">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {projectProfile.category}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {completedCount}/{milestones.length} milestones released
              </span>
            </div>
          </div>
          <div className="mt-8 grid gap-6 rounded-3xl border border-white/5 bg-black/20 p-6 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">Raised</p>
              <p className="text-3xl font-semibold text-white">$870K</p>
              <p className="text-xs text-white/60">62% of funding target</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">Released</p>
              <p className="text-3xl font-semibold text-emerald-300">$620K</p>
              <p className="text-xs text-white/60">4 of 5 tranches approved</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">Active milestone</p>
              <p className="text-2xl font-semibold text-white">
                {activeMilestone?.title ?? "Awaiting staging"}
              </p>
            </div>
          </div>
        </div>

        <section className="mt-10 grid gap-10 lg:grid-cols-[1.65fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-3 md:p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/60">Milestone roadmap</p>
                  <h2 className="text-3xl font-semibold text-white">Vertical fund releases</h2>
                </div>
                <span className="text-sm font-semibold text-white/70">
                  {completedCount}/{milestones.length} released
                </span>
              </div>
              <p className="mt-3 text-sm text-white/60">
                Every milestone automatically gates fund releases through validator votes and telemetry
                verification.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-3 md:p-6 shadow-xl">
              <MilestoneTimeline milestones={milestones} />
            </div>
          </div>

          <aside className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/60">Funding progress</p>
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm font-semibold text-white/70">
                  <span>Total committed</span>
                  <span>{fundingProgress}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-emerald-200 transition-all"
                    style={{ width: `${fundingProgress}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-white/60">
                  <span>Released funds</span>
                  <span>{releaseProgress}%</span>
                </div>
                <div className="h-1 rounded-full bg-gradient-to-r from-emerald-300/30 to-slate-600">
                  <div
                    className="h-1 rounded-full bg-emerald-300"
                    style={{ width: `${releaseProgress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {highlightStats.map((stat) => (
                <div key={stat.label} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
                  <stat.icon className="h-5 w-5 text-emerald-300/90" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">{stat.label}</p>
                    <p className="text-lg font-semibold text-white">{stat.value}</p>
                    <p className="text-xs text-white/60">{stat.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 rounded-2xl border border-white/5 bg-gradient-to-b from-slate-900 to-slate-950/80 p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.4em] text-white/60">
                <span>Participation</span>
                <span>{activeMilestone ? "Live" : "Queued"}</span>
              </div>
              <p className="text-sm text-white/70">
                Join the current tranche to help unlock the next milestone release. Contributions are
                reconciled by the escalation council within minutes.
              </p>
              <button
                type="button"
                onClick={openModal}
                className="w-full rounded-2xl border border-white/20 bg-gradient-to-r from-emerald-500 to-emerald-400  px-4 py-3 text-center text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 transition hover:brightness-110"
              >
                Contribute
              </button>
              {latestContribution && (
                <p className="text-xs text-white/60">
                  Latest confirmed: <strong className="text-white">{latestContribution.amount}</strong>{" "}
                  — {latestContribution.note}
                </p>
              )}
              <p className="text-xs text-emerald-300/90">
                Contributors receive real-time verification receipts before funds are released.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-black/40 p-4">
              <p className="text-xs uppercase tracking-[0.4em] text-white/60">Validation cadence</p>
              <p className="text-sm text-white/70">
                Validators validate each milestone within 24h. Locked milestones unlock once consensus is
                recorded.
              </p>
            </div>
          </aside>
        </section>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">Contribute to {projectProfile.ticker}</h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 transition hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <p className="mt-2 text-sm text-white/60">
              Contributions are simulated for now — an approval guard ensures successful transactions or
              surfaces errors.
            </p>

            <form onSubmit={handleContribute} className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-medium uppercase tracking-[0.4em] text-white/50">
                  Amount (XLM)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={contributionAmount}
                  onChange={(event) => setContributionAmount(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300"
                />
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-[0.4em] text-white/50">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  placeholder="How would you like your support used?"
                  value={contributionNote}
                  onChange={(event) => setContributionNote(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300"
                />
              </div>

              <button
                type="submit"
                disabled={contributionStatus === "loading"}
                className="w-full rounded-2xl border border-white/10 bg-gradient-to-r from-emerald-500 to-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {contributionStatus === "loading" ? "Processing…" : "Simulate contribution"}
              </button>
            </form>

            {statusMessage && (
              <p
                className={`mt-4 text-sm ${
                  contributionStatus === "success"
                    ? "text-emerald-300"
                    : contributionStatus === "error"
                    ? "text-rose-300"
                    : "text-white/60"
                }`}
              >
                {statusMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
