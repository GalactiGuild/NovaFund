"use client";

import React, { useState } from "react";
import { Copy, Check, User } from "lucide-react";
import { FollowButton } from "./FollowButton";
import { useSocial } from "@/contexts/SocialContext";

interface UserProfileCardProps {
  walletAddress: string;
  showFollow?: boolean;
  compact?: boolean;
}

function walletColor(wallet: string): string {
  let hash = 0;
  for (let i = 0; i < wallet.length; i++) {
    hash = wallet.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 60%, 55%)`;
}

export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  walletAddress,
  showFollow = true,
  compact = false,
}) => {
  const { getProfile, getFollowerCount, getFollowingCount } = useSocial();
  const [copied, setCopied] = useState(false);
  const profile = getProfile(walletAddress);
  const followers = getFollowerCount(walletAddress);
  const following = getFollowingCount(walletAddress);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: walletColor(walletAddress) }}
        >
          {walletAddress.slice(0, 2)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {profile.displayName ?? walletAddress}
          </p>
          <p className="text-xs text-white/40">{followers} followers</p>
        </div>
        {showFollow && <FollowButton targetWallet={walletAddress} size="sm" />}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
          style={{ backgroundColor: walletColor(walletAddress) }}
        >
          <User className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-lg font-semibold text-white">
              {profile.displayName ?? "Anonymous"}
            </p>
            {showFollow && (
              <FollowButton targetWallet={walletAddress} size="sm" />
            )}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="mt-1 flex items-center gap-1 text-xs text-white/40 transition-colors hover:text-white/60"
          >
            <span className="font-mono">{walletAddress}</span>
            {copied ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
          <div className="mt-3 flex gap-4 text-xs text-white/50">
            <span>
              <strong className="text-white">{followers}</strong> followers
            </span>
            <span>
              <strong className="text-white">{following}</strong> following
            </span>
            <span>
              <strong className="text-white">{profile.projectsCreated}</strong>{" "}
              projects
            </span>
            <span>
              <strong className="text-white">{profile.projectsBacked}</strong>{" "}
              backed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
