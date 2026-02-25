export interface SocialUser {
  walletAddress: string;
  displayName?: string;
  avatarUrl?: string;
  followerCount: number;
  followingCount: number;
  projectsCreated: number;
  projectsBacked: number;
}

export interface SocialComment {
  id: string;
  projectId: string;
  authorWallet: string;
  content: string;
  createdAt: string;
  parentId?: string;
  likeCount: number;
  isDeleted?: boolean;
  isReported?: boolean;
}

export interface ProjectSocialStats {
  likeCount: number;
  commentCount: number;
  shareCount: number;
}

export interface FollowRelation {
  followerWallet: string;
  followingWallet: string;
  createdAt: string;
}

export interface ShareEvent {
  projectId: string;
  platform: "twitter" | "copy";
  userWallet: string;
  timestamp: string;
}
