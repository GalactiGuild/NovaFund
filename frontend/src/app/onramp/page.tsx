"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, DollarSign, Loader2, ExternalLink, AlertCircle } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";

type DepositStatus = 
  | "pending_user_transfer_start"
  | "pending_anchor"
  | "pending_stellar"
  | "pending_external"
  | "pending_trust"
  | "completed"
  | "error"
  | "incomplete";

interface DepositResponse {
  id: string;
  interactiveUrl: string;
  status: string;
}

interface StatusResponse {
  id: string;
  status: DepositStatus;
  amount?: number;
  assetCode: string;
  stellarTransactionId?: string;
  message?: string;
}

const STATUS_MESSAGES: Record<DepositStatus, { label: string; description: string }> = {
  pending_user_transfer_start: {
    label: "Waiting for deposit",
    description: "Complete the deposit process in the anchor window",
  },
  pending_anchor: {
    label: "Processing deposit",
    description: "The anchor is processing your fiat deposit",
  },
  pending_stellar: {
    label: "Submitting to Stellar",
    description: "Transaction is being submitted to the Stellar network",
  },
  pending_external: {
    label: "External processing",
    description: "Waiting for external system confirmation",
  },
  pending_trust: {
    label: "Trustline required",
    description: "Please add a trustline for the asset",
  },
  completed: {
    label: "Deposit complete",
    description: "USDC has been deposited to your wallet",
  },
  error: {
    label: "Deposit failed",
    description: "There was an error processing your deposit",
  },
  incomplete: {
    label: "Deposit incomplete",
    description: "The deposit was not completed",
  },
};

export default function OnRampPage() {
  const { walletAddress } = useWallet();
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [depositId, setDepositId] = useState<string | null>(null);
  const [interactiveUrl, setInteractiveUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

  // Poll for status updates
  useEffect(() => {
    if (!depositId) return;

    const pollStatus = async () => {
      try {
        const response = await fetch(`${apiUrl}/sep24/deposit/${depositId}`);
        if (response.ok) {
          const data: StatusResponse = await response.json();
          setStatus(data);

          // Stop polling if completed or error
          if (data.status === "completed" || data.status === "error") {
            return true;
          }
        }
      } catch (err) {
        console.error("Failed to fetch status:", err);
      }
      return false;
    };

    const interval = setInterval(async () => {
      const shouldStop = await pollStatus();
      if (shouldStop) {
        clearInterval(interval);
      }
    }, 5000);

    // Initial poll
    pollStatus();

    return () => clearInterval(interval);
  }, [depositId, apiUrl]);

  const handleInitiateDeposit = async () => {
    if (!walletAddress) {
      setError("Please connect your wallet first");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/sep24/deposit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress,
          assetCode: "USDC",
          amount: parseFloat(amount),
          anchorProvider: "moneygram",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to initiate deposit");
      }

      const data: DepositResponse = await response.json();
      setDepositId(data.id);
      setInteractiveUrl(data.interactiveUrl);
      
      // Open in new window
      window.open(data.interactiveUrl, "_blank", "width=500,height=700");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate deposit");
    } finally {
      setIsLoading(false);
    }
  };

  const statusInfo = status ? STATUS_MESSAGES[status.status] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto"
        >
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-cyan-300 to-sky-200 bg-clip-text text-transparent mb-4">
              Fiat On-Ramp
            </h1>
            <p className="text-slate-400 text-lg">
              Deposit fiat currency directly into your Stellar wallet as USDC
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            {!depositId ? (
              <>
                {/* Amount Input */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Amount (USD)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                {/* Wallet Address */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Destination Wallet
                  </label>
                  <div className="px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-300 text-sm font-mono truncate">
                    {walletAddress || "Not connected"}
                  </div>
                </div>

                {/* Info Box */}
                <div className="mb-6 p-4 bg-blue-500/10 border border-blue-400/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-200">
                      <p className="font-medium mb-1">Powered by MoneyGram Access</p>
                      <p className="text-blue-300/80">
                        You'll be redirected to complete your deposit securely through our anchor partner.
                        The process typically takes 5-15 minutes.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-6 p-4 bg-red-500/10 border border-red-400/20 rounded-xl text-red-200 text-sm">
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleInitiateDeposit}
                  disabled={isLoading || !walletAddress}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Initiating...
                    </>
                  ) : (
                    <>
                      Continue to Deposit
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                {/* Status Display */}
                <div className="text-center mb-8">
                  {status?.status === "completed" ? (
                    <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  ) : status?.status === "error" ? (
                    <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                  ) : (
                    <Loader2 className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-spin" />
                  )}
                  
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {statusInfo?.label || "Processing"}
                  </h2>
                  <p className="text-slate-400">
                    {statusInfo?.description || "Please wait..."}
                  </p>
                </div>

                {/* Status Details */}
                {status && (
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between py-2 border-b border-slate-700">
                      <span className="text-slate-400">Deposit ID</span>
                      <span className="text-white font-mono text-sm">{depositId}</span>
                    </div>
                    {status.amount && (
                      <div className="flex justify-between py-2 border-b border-slate-700">
                        <span className="text-slate-400">Amount</span>
                        <span className="text-white">{status.amount} {status.assetCode}</span>
                      </div>
                    )}
                    {status.stellarTransactionId && (
                      <div className="flex justify-between py-2 border-b border-slate-700">
                        <span className="text-slate-400">Transaction</span>
                        <a
                          href={`https://stellar.expert/explorer/testnet/tx/${status.stellarTransactionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Interactive URL */}
                {interactiveUrl && status?.status !== "completed" && (
                  <button
                    onClick={() => window.open(interactiveUrl, "_blank", "width=500,height=700")}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all duration-200 flex items-center justify-center gap-2 mb-4"
                  >
                    Reopen Deposit Window
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}

                {/* Reset Button */}
                {(status?.status === "completed" || status?.status === "error") && (
                  <button
                    onClick={() => {
                      setDepositId(null);
                      setInteractiveUrl(null);
                      setStatus(null);
                      setAmount("");
                    }}
                    className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold rounded-xl transition-all duration-200"
                  >
                    Make Another Deposit
                  </button>
                )}
              </>
            )}
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            {[
              { icon: CheckCircle2, title: "Fast", desc: "5-15 minutes" },
              { icon: DollarSign, title: "Low Fees", desc: "Competitive rates" },
              { icon: CheckCircle2, title: "Secure", desc: "SEP-24 compliant" },
            ].map((feature, i) => (
              <div
                key={i}
                className="p-4 bg-slate-900/30 backdrop-blur border border-white/5 rounded-xl text-center"
              >
                <feature.icon className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                <h3 className="text-white font-semibold mb-1">{feature.title}</h3>
                <p className="text-slate-400 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
