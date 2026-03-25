"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { socialStore } from "@/lib/social-store";
import type {
  SocialComment,
  ProjectSocialStats,
  SocialUser,
} from "@/types/social";

const DEMO_WALLET = "GUSER1...DEMO";

interface SocialContextValue {
  currentWallet: string;
  /** Project likes */
  hasLikedProject: (projectId: string) => boolean;
  toggleProjectLike: (projectId: string) => boolean;
  getProjectStats: (projectId: string) => ProjectSocialStats;
  getProjectLikeCount: (projectId: string) => number;
  /** Follow system */
  isFollowing: (targetWallet: string) => boolean;
  toggleFollow: (targetWallet: string) => boolean;
  getFollowerCount: (wallet: string) => number;
  getFollowingCount: (wallet: string) => number;
  /** Comments */
  getComments: (projectId: string) => SocialComment[];
  addComment: (projectId: string, content: string) => SocialComment;
  deleteComment: (commentId: string) => void;
  reportComment: (commentId: string) => void;
  likeComment: (commentId: string) => void;
  /** Shares */
  shareProject: (projectId: string) => number;
  getShareCount: (projectId: string) => number;
  /** Profiles */
  getProfile: (wallet: string) => SocialUser;
  /** Force re-render trigger */
  version: number;
}

const SocialContext = createContext<SocialContextValue | null>(null);

export function SocialProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState(0);
  const currentWallet = DEMO_WALLET;

  useEffect(() => {
    socialStore.init();
    setVersion(1);
  }, []);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const hasLikedProject = useCallback(
    (projectId: string) =>
      socialStore.hasLikedProject(projectId, currentWallet),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentWallet, version]
  );

  const toggleProjectLike = useCallback(
    (projectId: string) => {
      const liked = socialStore.toggleProjectLike(projectId, currentWallet);
      bump();
      return liked;
    },
    [currentWallet, bump]
  );

  const getProjectStats = useCallback(
    (projectId: string) => socialStore.getProjectStats(projectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );

  const getProjectLikeCount = useCallback(
    (projectId: string) => socialStore.getProjectLikes(projectId).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );

  const isFollowingUser = useCallback(
    (targetWallet: string) =>
      socialStore.isFollowing(currentWallet, targetWallet),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentWallet, version]
  );

  const toggleFollow = useCallback(
    (targetWallet: string) => {
      const following = socialStore.toggleFollow(currentWallet, targetWallet);
      bump();
      return following;
    },
    [currentWallet, bump]
  );

  const getFollowerCount = useCallback(
    (wallet: string) => socialStore.getFollowers(wallet).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );

  const getFollowingCount = useCallback(
    (wallet: string) => socialStore.getFollowing(wallet).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );

  const getComments = useCallback(
    (projectId: string) => socialStore.getComments(projectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );

  const addComment = useCallback(
    (projectId: string, content: string) => {
      const comment = socialStore.addComment(projectId, currentWallet, content);
      bump();
      return comment;
    },
    [currentWallet, bump]
  );

  const deleteComment = useCallback(
    (commentId: string) => {
      socialStore.deleteComment(commentId);
      bump();
    },
    [bump]
  );

  const reportComment = useCallback(
    (commentId: string) => {
      socialStore.reportComment(commentId);
      bump();
    },
    [bump]
  );

  const likeCommentAction = useCallback(
    (commentId: string) => {
      socialStore.likeComment(commentId);
      bump();
    },
    [bump]
  );

  const shareProject = useCallback(
    (projectId: string) => {
      const count = socialStore.incrementShare(projectId);
      bump();
      return count;
    },
    [bump]
  );

  const getShareCount = useCallback(
    (projectId: string) => socialStore.getShareCount(projectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );

  const getProfile = useCallback(
    (wallet: string) => socialStore.getProfile(wallet),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );

  const value: SocialContextValue = {
    currentWallet,
    hasLikedProject,
    toggleProjectLike,
    getProjectStats,
    getProjectLikeCount,
    isFollowing: isFollowingUser,
    toggleFollow,
    getFollowerCount,
    getFollowingCount,
    getComments,
    addComment,
    deleteComment,
    reportComment,
    likeComment: likeCommentAction,
    shareProject,
    getShareCount,
    getProfile,
    version,
  };

  return (
    <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
  );
}

export function useSocial(): SocialContextValue {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error("useSocial must be used within SocialProvider");
  return ctx;
}
