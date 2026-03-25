"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
  Wallet,
} from "lucide-react";

type SourceChain = {
  id: "ethereum" | "polygon";
  name: string;
  network: string;
  settlement: string;
  feeRate: number;
  accent: string;
  tone: string;
};

type DestinationProject = {
  id: string;
  name: string;
  ticker: string;
  category: string;
  wallet: string;
  fundingProgress: number;
  raised: string;
  description: string;
};

const SOURCE_CHAINS: SourceChain[] = [
  {
    id: "ethereum",
    name: "Ethereum",
    network: "Mainnet",
    settlement: "~12 minutes",
    feeRate: 0.008,
    accent: "from-blue-400 via-cyan-300 to-sky-200",
    tone: "border-blue-400/20 bg-blue-500/10 text-blue-100",
  },
  {
    id: "polygon",
    name: "Polygon",
    network: "PoS",
    settlement: "~3 minutes",
    feeRate: 0.003,
    accent: "from-fuchsia-400 via-violet-300 to-indigo-200",
    tone: "border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100",
  },
];

const DESTINATION_PROJECTS: DestinationProject[] = [
  {
    id: "stellar-solar-initiative",
    name: "Stellar Solar Initiative",
    ticker: "SSI",
    category: "Green Energy",
    wallet: "GB3F...SOLAR",
    fundingProgress: 62,
    raised: "$870K",
    description:
      "Community solar deployments funded on Stellar with milestone-based disbursements.",
  },
  {
    id: "quantum-ledger-explorer",
    name: "Quantum Ledger Explorer",
    ticker: "QLE",
    category: "Infrastructure",
    wallet: "GA9P...QLEDG",
    fundingProgress: 65,
    raised: "$32.5K",
    description:
      "A real-time analytics layer for high-frequency settlement and trading activity.",
  },
  {
    id: "ocean-guardian-ai",
    name: "Ocean Guardian AI",
    ticker: "OGA",
    category: "Climate Tech",
    wallet: "GD7A...OCEAN",
    fundingProgress: 37,
    raised: "$45K",
    description:
      "Autonomous monitoring drones protecting marine ecosystems with Stellar-backed funding.",
  },
];

export default function BridgePage() {
  const [sourceChainId, setSourceChainId] =
    useState<SourceChain["id"]>("ethereum");
  const [destinationProjectId, setDestinationProjectId] =
    useState<string>(DESTINATION_PROJECTS[0].id);
  const [amount, setAmount] = useState("500");

  const selectedChain = SOURCE_CHAINS.find(
    (chain) => chain.id === sourceChainId
  )!;
  const selectedProject = DESTINATION_PROJECTS.find(
    (project) => project.id === destinationProjectId
  )!;

  const quote = useMemo(() => {
    const parsedAmount = Number(amount);

    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return {
        bridgeFee: 0,
        networkFee: 0,
        receivedAmount: 0,
      };
    }

    const bridgeFee = parsedAmount * selectedChain.feeRate;
    const networkFee = selectedChain.id === "ethereum" ? 4.5 : 0.6;
    const receivedAmount = Math.max(parsedAmount - bridgeFee - networkFee, 0);

    return {
      bridgeFee,
      networkFee,
      receivedAmount,
    };
  }, [amount, selectedChain]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_32%),linear-gradient(180deg,_#050816_0%,_#090f1f_48%,_#04070f_100%)] text-white">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] px-6 py-10 shadow-[0_25px_80px_rgba(2,6,23,0.55)] sm:px-8 lg:px-12">
        <div className="absolute inset-0 bg-grid-white/[0.02]" />
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-fuchsia-400/10 blur-3xl" />

        <div className="relative z-10 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
              <ShieldCheck className="h-4 w-4" />
              Bridge external USDC liquidity into Stellar-native funding
            </div>

            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Route USDC from Ethereum or Polygon into a NovaFund project
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
              This flow is designed like a swap: choose a source chain, choose a
              Stellar project, preview the transfer, and hand the transaction
              off to a bridge provider once the API is connected.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                "USDC only for the first release",
                "Destination is the project Stellar wallet",
                "Bridge API wiring comes later",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/70 backdrop-blur"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-5 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                  Bridge preview
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Source Chain to Stellar Project
                </h2>
              </div>
              <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                Simulated
              </div>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <label className="text-xs uppercase tracking-[0.35em] text-white/50">
                  From
                </label>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {SOURCE_CHAINS.map((chain) => {
                    const active = chain.id === selectedChain.id;
                    return (
                      <button
                        key={chain.id}
                        type="button"
                        onClick={() => setSourceChainId(chain.id)}
                        className={`rounded-2xl border px-4 py-4 text-left transition ${
                          active
                            ? "border-white/30 bg-white/10"
                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                        }`}
                      >
                        <div
                          className={`inline-flex rounded-full border px-3 py-1 text-xs ${chain.tone}`}
                        >
                          {chain.network}
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div>
                            <p className="text-lg font-semibold text-white">
                              {chain.name}
                            </p>
                            <p className="text-sm text-white/50">
                              Est. settlement {chain.settlement}
                            </p>
                          </div>
                          <div
                            className={`h-10 w-10 rounded-full bg-gradient-to-br ${chain.accent} opacity-90`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="bridge-amount"
                    className="text-xs uppercase tracking-[0.35em] text-white/50"
                  >
                    Amount
                  </label>
                  <span className="text-xs text-white/50">Asset: USDC</span>
                </div>
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3">
                  <Wallet className="h-5 w-5 text-white/40" />
                  <input
                    id="bridge-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="w-full bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-white/20"
                    placeholder="0.00"
                  />
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/70">
                    USDC
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="destination-project"
                    className="text-xs uppercase tracking-[0.35em] text-white/50"
                  >
                    To project
                  </label>
                  <span className="text-xs text-white/50">
                    Destination chain: Stellar
                  </span>
                </div>
                <div className="relative mt-2">
                  <select
                    id="destination-project"
                    value={destinationProjectId}
                    onChange={(event) =>
                      setDestinationProjectId(event.target.value)
                    }
                    className="h-14 w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 pr-12 text-white outline-none transition focus:border-cyan-300/40"
                  >
                    {DESTINATION_PROJECTS.map((project) => (
                      <option
                        key={project.id}
                        value={project.id}
                        className="bg-slate-950"
                      >
                        {project.name} ({project.ticker})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
                </div>

                <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-white">
                        {selectedProject.name}
                      </p>
                      <p className="mt-1 text-sm text-white/60">
                        {selectedProject.description}
                      </p>
                    </div>
                    <Link
                      href={`/project/${selectedProject.id}`}
                      className="inline-flex items-center gap-1 text-sm text-cyan-200 transition hover:text-cyan-100"
                    >
                      View
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-black/20 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.25em] text-white/40">
                        Ticker
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {selectedProject.ticker}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-black/20 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.25em] text-white/40">
                        Raised
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {selectedProject.raised}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-black/20 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.25em] text-white/40">
                        Progress
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {selectedProject.fundingProgress}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-cyan-400/15 bg-cyan-400/5 p-4">
                <div className="flex items-center justify-between text-sm text-white/70">
                  <span>Bridge fee</span>
                  <span>{quote.bridgeFee.toFixed(2)} USDC</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-white/70">
                  <span>Estimated source gas</span>
                  <span>{quote.networkFee.toFixed(2)} USDC</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-white/70">
                  <span>Projected delivery</span>
                  <span>{selectedChain.settlement}</span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="text-sm uppercase tracking-[0.25em] text-white/50">
                    Received on Stellar
                  </span>
                  <span className="text-2xl font-semibold text-white">
                    {quote.receivedAmount.toFixed(2)} USDC
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-300 to-fuchsia-300 px-4 py-4 text-sm font-semibold text-slate-950 transition hover:brightness-110"
              >
                Simulate bridge intent
                <ArrowRight className="h-4 w-4" />
              </button>

              <p className="text-sm leading-6 text-white/50">
                This button is intentionally non-transactional for now. It marks
                the exact UX boundary where an Allbridge-style bridge quote and
                execution API can be attached later.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-white/50">
            Flow design
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white">
            What this frontend already handles
          </h2>
          <div className="mt-6 space-y-4">
            {[
              "Source chain selection limited to Ethereum and Polygon for clean first-release scope.",
              "Destination selection maps directly to a Stellar project and its receiving wallet.",
              "Quote panel surfaces estimated bridge fees, gas assumptions, and final USDC received.",
              "The final action is intentionally mocked so a third-party bridge provider can slot in later.",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-4"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
                <p className="text-sm leading-6 text-white/70">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-white/50">
            Integration notes
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white">
            API hook points
          </h2>
          <div className="mt-6 space-y-4 text-sm leading-6 text-white/70">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              `quote` request: source chain, token, amount, recipient wallet,
              destination chain, and project id.
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              `execute` request: signed wallet approval, bridge route id, and
              compliance metadata if the provider needs it.
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              `status` polling/websocket: bridge initiated, source confirmed,
              Stellar minted, project funded.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
