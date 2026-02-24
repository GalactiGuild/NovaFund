"use client";

import React, { useState } from "react";
import { MessageCircle, ArrowDownUp } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useSocial } from "@/contexts/SocialContext";
import { CommentInput } from "./CommentInput";
import { Comment } from "./Comment";

interface CommentSectionProps {
  projectId: string;
}

type SortMode = "newest" | "popular";

export const CommentSection: React.FC<CommentSectionProps> = ({
  projectId,
}) => {
  const { getComments } = useSocial();
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [showAll, setShowAll] = useState(false);

  const allComments = getComments(projectId);
  const sorted =
    sortMode === "newest"
      ? allComments
      : [...allComments].sort((a, b) => b.likeCount - a.likeCount);

  const INITIAL_DISPLAY = 5;
  const displayed = showAll ? sorted : sorted.slice(0, INITIAL_DISPLAY);
  const hasMore = sorted.length > INITIAL_DISPLAY;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-purple-300" />
          <h3 className="text-xl font-semibold text-white">
            Community Discussion
          </h3>
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white/50">
            {allComments.filter((c) => !c.isDeleted).length}
          </span>
        </div>
        <button
          type="button"
          onClick={() =>
            setSortMode((m) => (m === "newest" ? "popular" : "newest"))
          }
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
        >
          <ArrowDownUp className="h-3 w-3" />
          {sortMode === "newest" ? "Newest" : "Most liked"}
        </button>
      </div>

      <CommentInput projectId={projectId} />

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {displayed.map((comment) => (
            <Comment key={comment.id} comment={comment} />
          ))}
        </AnimatePresence>
      </div>

      {hasMore && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full rounded-xl border border-white/5 bg-white/[0.02] py-3 text-xs font-semibold text-white/40 transition-colors hover:bg-white/5 hover:text-white/60"
        >
          Show all {sorted.length} comments
        </button>
      )}

      {allComments.length === 0 && (
        <div className="py-8 text-center">
          <MessageCircle className="mx-auto h-10 w-10 text-white/10" />
          <p className="mt-3 text-sm text-white/30">
            No comments yet. Be the first to share your thoughts!
          </p>
        </div>
      )}
    </div>
  );
};
