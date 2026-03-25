/** Notification types for filtering and preferences */
export type NotificationType =
  | "milestone_approval"
  | "contribution_confirmation"
  | "project_status"
  | "project_update"
  | "system"
  | "social_like"
  | "social_comment"
  | "social_follow";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  /** Optional link (e.g. project or dashboard) */
  link?: string;
  /** ISO timestamp */
  createdAt: string;
  read?: boolean;
}

export interface NotificationPreferences {
  milestoneApprovals: boolean;
  contributionConfirmations: boolean;
  projectStatus: boolean;
  projectUpdates: boolean;
  system: boolean;
  /** Browser push when tab is in background */
  pushEnabled: boolean;
  /** Play sound on new notification */
  soundEnabled: boolean;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  milestoneApprovals: true,
  contributionConfirmations: true,
  projectStatus: true,
  projectUpdates: true,
  system: true,
  pushEnabled: false,
  soundEnabled: true,
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  milestone_approval: "Milestone approval",
  contribution_confirmation: "Contribution",
  project_status: "Project status",
  project_update: "Project update",
  system: "System",
  social_like: "Project liked",
  social_comment: "New comment",
  social_follow: "New follower",
};
