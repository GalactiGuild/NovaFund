"use client";

import React, { useState } from "react";
import { Send } from "lucide-react";
import { useSocial } from "@/contexts/SocialContext";

interface CommentInputProps {
  projectId: string;
  placeholder?: string;
  onSubmit?: () => void;
}

const MAX_CHARS = 500;

export const CommentInput: React.FC<CommentInputProps> = ({
  projectId,
  placeholder = "Share your thoughts on this project...",
  onSubmit,
}) => {
  const { addComment } = useSocial();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const charCount = content.length;
  const canSubmit =
    content.trim().length > 0 && charCount <= MAX_CHARS && !submitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    // Simulate brief network delay
    setTimeout(() => {
      addComment(projectId, content.trim());
      setContent("");
      setSubmitting(false);
      onSubmit?.();
    }, 300);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          rows={3}
          maxLength={MAX_CHARS + 50}
          className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-purple-500/50 focus:bg-white/[0.07]"
        />
        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          <span
            className={`text-[10px] ${
              charCount > MAX_CHARS ? "text-rose-400" : "text-white/30"
            }`}
          >
            {charCount}/{MAX_CHARS}
          </span>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-purple-500/20 px-4 py-2 text-xs font-semibold text-purple-300 transition-colors hover:bg-purple-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
          <span>{submitting ? "Posting..." : "Post comment"}</span>
        </button>
      </div>
    </form>
  );
};
