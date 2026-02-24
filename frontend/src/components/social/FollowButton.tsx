"use client";

import React, { useState } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useSocial } from "@/contexts/SocialContext";

interface FollowButtonProps {
  targetWallet: string;
  size?: "sm" | "md";
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  targetWallet,
  size = "md",
}) => {
  const { currentWallet, isFollowing, toggleFollow, getFollowerCount } =
    useSocial();
  const [animating, setAnimating] = useState(false);

  const following = isFollowing(targetWallet);
  const followerCount = getFollowerCount(targetWallet);
  const isSelf = currentWallet === targetWallet;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSelf) return;
    toggleFollow(targetWallet);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 400);
  };

  if (isSelf) return null;

  const sizeClasses =
    size === "sm" ? "px-3 py-1 text-xs gap-1" : "px-4 py-2 text-sm gap-1.5";

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      animate={animating ? { scale: [1, 1.05, 1] } : {}}
      className={`flex items-center rounded-full font-semibold transition-colors ${sizeClasses} ${
        following
          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
          : "border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20"
      }`}
    >
      {following ? (
        <UserCheck className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
      ) : (
        <UserPlus className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
      )}
      <span>{following ? "Following" : "Follow"}</span>
      {followerCount > 0 && (
        <span className="text-white/40">{followerCount}</span>
      )}
    </motion.button>
  );
};
