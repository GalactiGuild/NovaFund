"use client";

import React, { useState } from "react";
import { Heart, Trash2, Flag, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useSocial } from "@/contexts/SocialContext";
import { socialStore } from "@/lib/social-store";
import type { SocialComment } from "@/types/social";

interface CommentProps {
  comment: SocialComment;
}

function walletColor(wallet: string): string {
  let hash = 0;
  for (let i = 0; i < wallet.length; i++) {
    hash = wallet.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 60%, 55%)`;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export const Comment: React.FC<CommentProps> = ({ comment }) => {
  const { currentWallet, deleteComment, reportComment, likeComment } =
    useSocial();
  const [showConfirm, setShowConfirm] = useState<"delete" | "report" | null>(
    null
  );
  const [likeAnimating, setLikeAnimating] = useState(false);

  const isAuthor = comment.authorWallet === currentWallet;
  const displayName =
    socialStore.getMockName(comment.authorWallet) ?? comment.authorWallet;

  if (comment.isDeleted) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-xs text-white/30 italic">
        <Trash2 className="h-3 w-3" />
        <span>This comment has been deleted</span>
      </div>
    );
  }

  const handleLike = () => {
    likeComment(comment.id);
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 400);
  };

  const handleDelete = () => {
    deleteComment(comment.id);
    setShowConfirm(null);
  };

  const handleReport = () => {
    reportComment(comment.id);
    setShowConfirm(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group rounded-xl border border-white/5 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.05]"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ backgroundColor: walletColor(comment.authorWallet) }}
        >
          {comment.authorWallet.slice(0, 2)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">
              {displayName}
            </span>
            {isAuthor && (
              <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-300 border border-purple-500/20">
                You
              </span>
            )}
            <span className="text-xs text-white/30">
              {timeAgo(comment.createdAt)}
            </span>
          </div>

          <p className="mt-1.5 text-sm leading-relaxed text-white/70">
            {comment.content}
          </p>

          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={handleLike}
              className="flex items-center gap-1 text-xs text-white/40 transition-colors hover:text-rose-400"
            >
              <motion.div
                animate={likeAnimating ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <Heart className="h-3 w-3" />
              </motion.div>
              {comment.likeCount > 0 && <span>{comment.likeCount}</span>}
            </button>

            {isAuthor && (
              <button
                type="button"
                onClick={() => setShowConfirm("delete")}
                className="flex items-center gap-1 text-xs text-white/30 opacity-0 transition-all hover:text-rose-400 group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
                <span>Delete</span>
              </button>
            )}

            {!isAuthor && (
              <button
                type="button"
                onClick={() => setShowConfirm("report")}
                className="flex items-center gap-1 text-xs text-white/30 opacity-0 transition-all hover:text-amber-400 group-hover:opacity-100"
              >
                <Flag className="h-3 w-3" />
                <span>Report</span>
              </button>
            )}

            {comment.isReported && (
              <span className="flex items-center gap-1 text-[10px] text-amber-500/60">
                <AlertTriangle className="h-3 w-3" />
                Reported
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-slate-800/80 p-3 text-xs">
          <span className="text-white/60">
            {showConfirm === "delete"
              ? "Delete this comment?"
              : "Report this comment?"}
          </span>
          <button
            type="button"
            onClick={showConfirm === "delete" ? handleDelete : handleReport}
            className={`rounded-md px-3 py-1 font-semibold text-white ${
              showConfirm === "delete"
                ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                : "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
            }`}
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setShowConfirm(null)}
            className="rounded-md bg-white/5 px-3 py-1 text-white/50 hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      )}
    </motion.div>
  );
};
