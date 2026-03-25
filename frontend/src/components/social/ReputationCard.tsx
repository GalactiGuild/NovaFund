"use client";

import React from "react";
import { Award, Trophy, Zap, Star, ShieldCheck, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { BadgeTier, SocialUser } from "@/types/social";

interface ReputationCardProps {
  user: SocialUser;
}

const TIER_CONFIG: Record<BadgeTier, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  Bronze: {
    color: "text-amber-600",
    bg: "bg-amber-600/10",
    icon: Award,
    label: "Bronze Tier",
  },
  Silver: {
    color: "text-slate-300",
    bg: "bg-slate-300/10",
    icon: ShieldCheck,
    label: "Silver Tier",
  },
  Gold: {
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    icon: Star,
    label: "Gold Tier",
  },
  Platinum: {
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
    icon: Trophy,
    label: "Platinum Tier",
  },
};

export const ReputationCard: React.FC<ReputationCardProps> = ({ user }) => {
  const config = TIER_CONFIG[user.badgeTier];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
    >
      {/* Background Glow */}
      <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full ${config.bg} blur-3xl opacity-50`} />
      
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">On-Chain Reputation</h3>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-bold text-white tracking-tight">{user.reputationScore}</span>
              <span className="text-xs font-medium text-white/30">/ 1000 XP</span>
            </div>
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${config.bg} border border-white/5`}>
            <Icon className={`h-6 w-6 ${config.color}`} />
          </div>
        </div>

        {/* Reputation Progress Bar */}
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(user.reputationScore / 1000) * 100}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-purple-500 to-blue-500`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-white/40">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Success Rate</span>
            </div>
            <p className="mt-2 text-xl font-bold text-white">{user.successRate}%</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-white/40">
              <Zap className="h-4 w-4" />
              <span className="text-xs font-medium">Badge Tier</span>
            </div>
            <p className={`mt-2 text-xl font-bold ${config.color}`}>{user.badgeTier}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 border border-emerald-500/20">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-medium text-emerald-400/90">Verified On-Chain Activity</span>
        </div>
      </div>
    </motion.div>
  );
};
