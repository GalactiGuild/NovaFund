"use client";

import React from "react";
import type { NotificationPreferences } from "@/types/notifications";
import { requestNotificationPermission } from "@/lib/push-notification";
import { NOTIFICATION_TYPE_LABELS, type NotificationType } from "@/types/notifications";

interface NotificationPreferencesPanelProps {
  preferences: NotificationPreferences;
  onChange: (prefs: NotificationPreferences) => void;
  onClose: () => void;
}

const TYPE_KEYS: (keyof NotificationPreferences)[] = [
  "milestoneApprovals",
  "contributionConfirmations",
  "projectStatus",
  "projectUpdates",
  "system",
];

const TYPE_MAP: Record<keyof NotificationPreferences, NotificationType | null> = {
  milestoneApprovals: "milestone_approval",
  contributionConfirmations: "contribution_confirmation",
  projectStatus: "project_status",
  projectUpdates: "project_update",
  system: "system",
  pushEnabled: null,
  soundEnabled: null,
};

export function NotificationPreferencesPanel({
  preferences,
  onChange,
  onClose,
}: NotificationPreferencesPanelProps) {
  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    onChange({ ...preferences, [key]: value });
  };

  return (
    <div className="p-4 border-t border-slate-700/80">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-200">Notification preferences</h4>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white text-sm"
        >
          Done
        </button>
      </div>
      <div className="space-y-2 text-sm">
        {TYPE_KEYS.filter((k) => TYPE_MAP[k]).map((key) => (
          <label
            key={key}
            className="flex items-center justify-between gap-3 cursor-pointer text-slate-300"
          >
            <span>
              {NOTIFICATION_TYPE_LABELS[TYPE_MAP[key] as NotificationType]}
            </span>
            <input
              type="checkbox"
              checked={!!preferences[key]}
              onChange={(e) => handleToggle(key, e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
            />
          </label>
        ))}
        <div className="pt-2 mt-2 border-t border-slate-700/60 space-y-2">
          <label className="flex items-center justify-between gap-3 cursor-pointer text-slate-300">
            <span>Browser push (when tab in background)</span>
            <input
              type="checkbox"
              checked={preferences.pushEnabled}
              onChange={async (e) => {
                const checked = e.target.checked;
                if (checked) {
                  const perm = await requestNotificationPermission();
                  handleToggle("pushEnabled", perm === "granted");
                } else {
                  handleToggle("pushEnabled", false);
                }
              }}
              className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
            />
          </label>
          <label className="flex items-center justify-between gap-3 cursor-pointer text-slate-300">
            <span>Sound on new notification</span>
            <input
              type="checkbox"
              checked={preferences.soundEnabled}
              onChange={(e) => handleToggle("soundEnabled", e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
