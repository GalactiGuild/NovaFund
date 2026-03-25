"use client";

import React from "react";
import { Heart, MessageCircle, Share2 } from "lucide-react";
import { useSocial } from "@/contexts/SocialContext";

interface SocialStatsProps {
  projectId: string;
  compact?: boolean;
}

export const SocialStats: React.FC<SocialStatsProps> = ({
  projectId,
  compact = false,
}) => {
  const { getProjectStats } = useSocial();
  const stats = getProjectStats(projectId);

  const items = [
    { icon: Heart, value: stats.likeCount, label: "likes" },
    { icon: MessageCircle, value: stats.commentCount, label: "comments" },
    { icon: Share2, value: stats.shareCount, label: "shares" },
  ];

  return (
    <div className="flex items-center gap-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1 text-white/40">
          <item.icon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
          <span className={compact ? "text-[10px]" : "text-xs"}>
            {item.value}
            {!compact && ` ${item.label}`}
          </span>
        </div>
      ))}
    </div>
  );
};
