"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { Notification } from "@/types/notifications";
import { useNotifications } from "@/contexts/NotificationContext";
import { cn } from "@/lib/utils";

interface NotificationToastProps {
  notification: Notification;
  onDismiss: () => void;
  className?: string;
}

const typeStyles: Record<Notification["type"], string> = {
  milestone_approval: "from-amber-600/90 to-orange-600/90 border-amber-500/30",
  contribution_confirmation: "from-emerald-600/90 to-green-600/90 border-emerald-500/30",
  project_status: "from-blue-600/90 to-indigo-600/90 border-blue-500/30",
  project_update: "from-violet-600/90 to-purple-600/90 border-violet-500/30",
  system: "from-slate-600/90 to-slate-700/90 border-slate-500/30",
};

export function NotificationToast({
  notification,
  onDismiss,
  className,
}: NotificationToastProps) {
  const { preferences } = useNotifications();
  const enabled =
    (notification.type === "milestone_approval" && preferences.milestoneApprovals) ||
    (notification.type === "contribution_confirmation" &&
      preferences.contributionConfirmations) ||
    (notification.type === "project_status" && preferences.projectStatus) ||
    (notification.type === "project_update" && preferences.projectUpdates) ||
    (notification.type === "system" && preferences.system);

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [enabled, onDismiss]);

  if (!enabled) return null;

  const content = (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-gradient-to-r px-4 py-3 shadow-lg backdrop-blur-sm text-white",
        typeStyles[notification.type],
        className
      )}
      role="alert"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm truncate">{notification.title}</p>
        <p className="text-white/90 text-xs mt-0.5 line-clamp-2">
          {notification.message}
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  if (notification.link) {
    return (
      <Link href={notification.link} onClick={onDismiss} className="block">
        {content}
      </Link>
    );
  }
  return content;
}
