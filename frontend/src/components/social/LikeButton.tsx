"use client";

import React, { useState } from "react";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useSocial } from "@/contexts/SocialContext";

interface LikeButtonProps {
  projectId: string;
  compact?: boolean;
}

export const LikeButton: React.FC<LikeButtonProps> = ({
  projectId,
  compact = false,
}) => {
  const { hasLikedProject, toggleProjectLike, getProjectLikeCount } =
    useSocial();
  const [animating, setAnimating] = useState(false);

  const liked = hasLikedProject(projectId);
  const count = getProjectLikeCount(projectId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleProjectLike(projectId);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 400);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs transition-colors hover:bg-white/10"
    >
      <motion.div
        animate={animating ? { scale: [1, 1.3, 1] } : {}}
        transition={{ duration: 0.35 }}
      >
        <Heart
          className={`h-3.5 w-3.5 transition-colors ${
            liked ? "fill-rose-500 text-rose-500" : "text-white/60"
          }`}
        />
      </motion.div>
      {!compact && (
        <span className={liked ? "text-rose-400" : "text-white/60"}>
          {count > 0 ? count : "Like"}
        </span>
      )}
      {compact && count > 0 && (
        <span className={liked ? "text-rose-400" : "text-white/40"}>
          {count}
        </span>
      )}
    </button>
  );
};
