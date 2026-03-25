"use client";

import React, { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Settings, CheckCheck, Wifi, WifiOff, Loader2 } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";
import type { Notification } from "@/types/notifications";
import { NOTIFICATION_TYPE_LABELS } from "@/types/notifications";
import { NotificationPreferencesPanel } from "./NotificationPreferencesPanel";
import { cn } from "@/lib/utils";

const DISPLAY_LIMIT = 50;

function SendTestNotificationButton({ onClose }: { onClose: () => void }) {
  const [sending, setSending] = useState(false);
  const send = async () => {
    setSending(true);
    try {
      await fetch("/api/notifications/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "project_update",
          title: "Test notification",
          message: "Real-time notifications are working. You’ll see updates here as they happen.",
        }),
      });
      onClose();
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };
  return (
    <button
      type="button"
      onClick={send}
      disabled={sending}
      className="text-xs text-purple-400 hover:text-purple-300 underline disabled:opacity-50"
    >
      {sending ? "Sending…" : "Send test notification"}
    </button>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffM = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffM < 1) return "Just now";
  if (diffM < 60) return `${diffM}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString();
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (id: string) => void;
}) {
  const read = !!notification.read;
  const handleClick = () => {
    if (!read) onRead(notification.id);
  };

  const content = (
    <div
      className={cn(
        "px-4 py-3 rounded-lg transition-colors text-left",
        !read && "bg-slate-800/60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium text-slate-200", !read && "text-white")}>
            {notification.title}
          </p>
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {NOTIFICATION_TYPE_LABELS[notification.type]} · {formatTime(notification.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );

  if (notification.link) {
    return (
      <Link href={notification.link} onClick={handleClick} className="block">
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={handleClick} className="block w-full text-left">
      {content}
    </button>
  );
}

export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    connectionStatus,
    markAsRead,
    markAllAsRead,
    preferences,
    setPreferences,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const displayList = notifications.slice(0, DISPLAY_LIMIT);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
        aria-label={open ? "Close notifications" : "Open notifications"}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-purple-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(90vw,380px)] rounded-xl border border-slate-700/80 bg-slate-900/95 shadow-xl backdrop-blur-md z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/80">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Notifications</span>
              {connectionStatus === "connected" && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <Wifi className="h-3.5 w-3.5" /> Live
                </span>
              )}
              {connectionStatus === "connecting" && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting
                </span>
              )}
              {connectionStatus === "disconnected" && (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <WifiOff className="h-3.5 w-3.5" /> Reconnecting…
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPreferences((s) => !s)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80"
                aria-label="Notification preferences"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>

          {showPreferences ? (
            <NotificationPreferencesPanel
              preferences={preferences}
              onChange={setPreferences}
              onClose={() => setShowPreferences(false)}
            />
          ) : (
            <>
              <div className="max-h-[min(60vh,320px)] overflow-y-auto overscroll-contain">
                {displayList.length === 0 ? (
                  <div className="px-4 py-8 text-center text-slate-500 text-sm">
                    <p className="mb-3">No notifications yet. You’ll see updates here in real time.</p>
                    <SendTestNotificationButton onClose={() => setOpen(false)} />
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700/50">
                    {displayList.map((n) => (
                      <NotificationItem
                        key={n.id}
                        notification={n}
                        onRead={markAsRead}
                      />
                    ))}
                  </div>
                )}
              </div>
              {notifications.length > DISPLAY_LIMIT && (
                <div className="px-4 py-2 text-center text-xs text-slate-500 border-t border-slate-700/50">
                  Showing latest {DISPLAY_LIMIT} of {notifications.length}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
