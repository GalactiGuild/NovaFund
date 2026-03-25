"use client";

import React, { useState, useRef, useEffect } from "react";
import { Share2, Link as LinkIcon, Check, X as XIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocial } from "@/contexts/SocialContext";

interface ShareButtonProps {
  projectId: string;
  projectTitle: string;
  compact?: boolean;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  projectId,
  projectTitle,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { shareProject, getShareCount } = useSocial();
  const ref = useRef<HTMLDivElement>(null);
  const shareCount = getShareCount(projectId);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const projectUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/project/${projectId}`
      : "";

  const handleTwitterShare = () => {
    const text = encodeURIComponent(
      `Check out "${projectTitle}" on NovaFund - decentralized micro-investment on Stellar`
    );
    const url = encodeURIComponent(projectUrl);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      "_blank",
      "noopener,noreferrer,width=600,height=400"
    );
    shareProject(projectId);
    setIsOpen(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(projectUrl);
      setCopied(true);
      shareProject(projectId);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Share2 className="h-3.5 w-3.5" />
        {!compact && <span>Share</span>}
        {shareCount > 0 && <span className="text-white/40">{shareCount}</span>}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleTwitterShare}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <XIcon className="h-4 w-4" />
              <span>Share on X / Twitter</span>
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <LinkIcon className="h-4 w-4" />
              )}
              <span>{copied ? "Copied!" : "Copy link"}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
