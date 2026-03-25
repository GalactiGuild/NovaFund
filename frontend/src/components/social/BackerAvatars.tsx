"use client";

import React from "react";
import { socialStore } from "@/lib/social-store";

interface BackerAvatarsProps {
  projectId: string;
  maxDisplay?: number;
}

function walletColor(wallet: string): string {
  let hash = 0;
  for (let i = 0; i < wallet.length; i++) {
    hash = wallet.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 60%, 55%)`;
}

export const BackerAvatars: React.FC<BackerAvatarsProps> = ({
  projectId,
  maxDisplay = 5,
}) => {
  const likers = socialStore.getProjectLikes(projectId);
  const displayed = likers.slice(0, maxDisplay);
  const overflow = likers.length - maxDisplay;

  if (likers.length === 0) return null;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {displayed.map((wallet) => (
          <div
            key={wallet}
            title={wallet}
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-900 text-[10px] font-bold text-white"
            style={{ backgroundColor: walletColor(wallet) }}
          >
            {wallet.slice(0, 2)}
          </div>
        ))}
        {overflow > 0 && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-900 bg-white/10 text-[10px] font-semibold text-white/60">
            +{overflow}
          </div>
        )}
      </div>
      <span className="ml-2 text-xs text-white/40">
        {likers.length} backer{likers.length !== 1 ? "s" : ""}
      </span>
    </div>
  );
};
