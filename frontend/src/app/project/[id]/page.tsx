"use client";

import { useMemo, useState } from "react";
import { Clock8, ShieldCheck, Sparkles, Target, Users } from "lucide-react";
import MilestoneTimeline, {
  type Milestone,
} from "@/components/MilestoneTimeline";
import { ShareButton } from "@/components/social/ShareButton";
import { LikeButton } from "@/components/social/LikeButton";
import { SocialStats } from "@/components/social/SocialStats";
import { UserProfileCard } from "@/components/social/UserProfileCard";
import { BackerAvatars } from "@/components/social/BackerAvatars";
import { CommentSection } from "@/components/social/CommentSection";
import { AuditBadge } from "@/components/AuditBadge";
import { ProjectDetail, type RWAProjectProps } from "@/components/ProjectDetail";

type ContributionState = "idle" | "loading" | "success" | "error";

const milestones: Milestone[] = [
  {
    id: "m1",
    title: "Project Initialization & Legal Framework",
    description:
      "Establish governance protocols, finalize legal structure, and secure initial validator partnerships for compliance.",
    amount: "$280K",
    due: "Completed Dec 15, 2025",
    status: "completed",
    progress: 100,
    releaseDetails: "Initial tranche fully released",
  },
  {
    id: "m2",
    title: "Site Preparation & Permits",
    description:
      "Secure permits for installation sites, complete environmental assessments, and prepare foundation work.",
    amount: "$320K",
    due: "Completed Jan 10, 2026",
    status: "completed",
    progress: 100,
    releaseDetails: "Permits secured and construction approved",
  },
  {
    id: "m3",
    title: "Solar Panel Installation",
    description:
      "Deploy solar panel arrays across identified sites and connect to local grid infrastructure.",
    amount: "$410K",
    due: "Active — Installation in progress",
    status: "active",
    progress: 68,
    releaseDetails: "Phase 1 installations completed",
  },
  {
    id: "m4",
    title: "Grid Connection & Testing",
    description:
      "Connect solar installations to power grid, conduct safety testing, and obtain operational certification.",
    amount: "$240K",
    due: "Est. Mar 2026",
    status: "locked",
    progress: 34,
    releaseDetails: "Locked until installation milestone clears",
  },
  {
    id: "m5",
    title: "Operations & Revenue Sharing",
    description:
      "Begin commercial operations, initiate revenue sharing with investors, and establish maintenance protocols.",
    amount: "$150K",
    due: "Est. Apr 2026",
    status: "locked",
    progress: 12,
    releaseDetails: "Dependent on grid connection milestone",
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
    label: "Community Impact",
    value: "5,000 households",
    detail: "Estimated solar energy access",
    icon: Users,
  },
  {
    label: "Expected ROI",
    value: "12-18% annually",
    detail: "Projected returns after project completion",
    icon: Sparkles,
  },
];

const projectProfile = {
  name: "Stellar Solar Initiative",
  ticker: "SSI",
  category: "Green Energy & Sustainability",
  tagline:
    "Empowering communities with decentralized solar energy solutions powered by Stellar micro-transactions.",
};

export default function ProjectPage({ params }: { params: { id: string } }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contributionAmount, setContributionAmount] = useState("0.25");
  const [contributionNote, setContributionNote] = useState("");
  const [contributionStatus, setContributionStatus] =
    useState<ContributionState>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [latestContribution, setLatestContribution] = useState<{
    amount: string;
    note: string;
  } | null>(null);
  const [insuranceSelected, setInsuranceSelected] = useState(false);

  const fundingTarget = 1_400_000;
  const fundsCommitted = 870_000;
  const fundsReleased = 620_000;
  const fundingProgress = Math.round((fundsCommitted / fundingTarget) * 100);
  const releaseProgress = Math.round((fundsReleased / fundingTarget) * 100);

  const rwaProjectData: RWAProjectProps = {
    id: params.id,
    name: projectProfile.name,
    ticker: projectProfile.ticker,
    category: projectProfile.category,
    totalValueLocked: "$1.4M",
    expectedYield: "12-18%",
    maturityDate: "Q3 2028",
    fundingTarget: fundingTarget,
    fundsCommitted: fundsCommitted,
    milestones: milestones
  };

  const completedCount = milestones.filter(
    (milestone) => milestone.status === "completed"
  ).length;
  const activeMilestone = useMemo(
    () => milestones.find((milestone) => milestone.status === "active"),
    []
  );

  const estimatedPremium = useMemo(() => {
    const amount = Number(contributionAmount);
    if (!contributionAmount || Number.isNaN(amount) || amount <= 0) {
      return "0.00";
    }
    const premiumRate = 0.02;
    return (amount * premiumRate).toFixed(2);
  }, [contributionAmount]);

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
    setStatusMessage("Preparing transaction and requesting fee sponsorship...");

    setTimeout(() => {
      const success = Math.random() > 0.1;
      if (success) {
        setContributionStatus("success");
        setStatusMessage(
          insuranceSelected
            ? "Contribution and insurance coverage successfully sponsored and submitted! Expect the on-chain release window in 2 minutes."
            : "Contribution successfully sponsored and submitted! Expect the on-chain release window in 2 minutes."
        );
        setLatestContribution({
          amount: `${amount.toFixed(2)} XLM`,
          note: contributionNote || "Community wallet",
        });
      } else {
        setContributionStatus("error");
        setStatusMessage("Network handshake or sponsorship failed. Please try again.");
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen max-w-screen overflow-hidden bg-slate-950 text-white">
      <div className="mx-auto max-w-8xl md:px-4 py-10">
        <div className="mt-4 grid gap-10 lg:grid-cols-[1.65fr_0.9fr]">
          <div className="space-y-10">
            <ProjectDetail project={rwaProjectData} />
            
            {/* Social Stats & Community */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-900/60 px-8 py-6 shadow-2xl">
              <SocialStats projectId={params.id} />
              <div className="flex items-center gap-4">
                <LikeButton projectId={params.id} />
                <ShareButton projectId={params.id} projectTitle={projectProfile.name} />
              </div>
              <BackerAvatars projectId={params.id} />
            </div>

            {/* Community Discussion */}
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl">
              <CommentSection projectId={params.id} />
            </div>
          </div>

          <aside className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl">
            {/* Project Creator */}
            <div>
              <p className="mb-3 text-xs uppercase tracking-[0.4em] text-white/60">
                Project creator
              </p>
              <UserProfileCard walletAddress="GDQP2K...X7MZ" compact />
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/60">
                Funding progress
              </p>
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm font-semibold text-white/70">
                  <span>Total committed</span>
                  <span>{fundingProgress}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-purple-400 via-purple-300 to-purple-200 transition-all"
                    style={{ width: `${fundingProgress}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-white/60">
                  <span>Released funds</span>
                  <span>{releaseProgress}%</span>
                </div>
                <div className="h-1 rounded-full bg-gradient-to-r from-purple-300/30 to-slate-600">
                  <div
                    className="h-1 rounded-full bg-purple-300"
                    style={{ width: `${releaseProgress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {highlightStats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3"
                >
                  <stat.icon className="h-5 w-5 text-purple-300/90" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                      {stat.label}
                    </p>
                    <p className="text-lg font-semibold text-white">
                      {stat.value}
                    </p>
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
                Join the current tranche to help unlock the next milestone
                release. Contributions are reconciled by the escalation council
                within minutes.
              </p>
              <button
                type="button"
                onClick={openModal}
                className="w-full rounded-2xl border border-white/20 bg-gradient-to-r from-purple-500 to-purple-400  px-4 py-3 text-center text-sm font-semibold text-slate-950 shadow-lg shadow-purple-500/40 transition hover:brightness-110"
              >
                Contribute
              </button>
              {latestContribution && (
                <p className="text-xs text-white/60">
                  Latest confirmed:{" "}
                  <strong className="text-white">
                    {latestContribution.amount}
                  </strong>{" "}
                  — {latestContribution.note}
                </p>
              )}
              <p className="text-xs text-purple-300/90">
                Contributors receive real-time verification receipts before
                funds are released.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-purple-500/20 bg-gradient-to-b from-slate-900 to-slate-950/80 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-purple-300" />
                  <p className="text-xs uppercase tracking-[0.4em] text-white/60">
                    Insurance pool
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInsuranceSelected((value) => !value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    insuranceSelected
                      ? "bg-purple-500 text-slate-950"
                      : "bg-white/5 text-white/70 border border-white/10"
                  }`}
                >
                  {insuranceSelected ? "Enabled" : "Add coverage"}
                </button>
              </div>
              <p className="text-sm text-white/70">
                Protect your downside with an on-chain insurance pool that pays
                out if the project fails after funds are released.
              </p>
              <p className="text-xs text-white/60">
                Indicative premium:{" "}
                <span className="font-semibold text-purple-200">
                  {estimatedPremium} XLM
                </span>{" "}
                for a {contributionAmount} XLM contribution.
              </p>
              <p className="text-[11px] text-white/50">
                Pricing is simulated for now and will be driven by project risk
                scores and pool utilization once contracts are wired in.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-black/40 p-4">
              <p className="text-xs uppercase tracking-[0.4em] text-white/60">
                Validation cadence
              </p>
              <p className="text-sm text-white/70">
                Validators validate each milestone within 24h. Locked milestones
                unlock once consensus is recorded.
              </p>
            </div>
          </aside>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">
                Contribute to {projectProfile.ticker}
              </h3>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-purple-200">
                  Fee Sponsored
                </span>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 transition hover:bg-white/10"
                >
                  Close
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm text-white/60">
              Contributions are simulated for now — an approval guard ensures
              successful transactions or surfaces errors.
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
                  onChange={(event) =>
                    setContributionAmount(event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-base text-white outline-none transition focus:border-purple-300"
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
                  className="mt-2 w-full rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-base text-white outline-none transition focus:border-purple-300"
                />
              </div>

              <button
                type="submit"
                disabled={contributionStatus === "loading"}
                className="w-full rounded-2xl border border-white/10 bg-gradient-to-r from-purple-500 to-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {contributionStatus === "loading"
                  ? "Processing…"
                  : "Simulate contribution"}
              </button>
            </form>

            {statusMessage && (
              <p
                className={`mt-4 text-sm ${
                  contributionStatus === "success"
                    ? "text-purple-300"
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
