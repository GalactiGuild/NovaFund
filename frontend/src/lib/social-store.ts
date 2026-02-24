import type {
  SocialComment,
  FollowRelation,
  ProjectSocialStats,
  SocialUser,
} from "@/types/social";

const STORAGE_KEYS = {
  comments: "novafund_social_comments",
  likes: "novafund_social_likes",
  follows: "novafund_social_follows",
  shares: "novafund_social_shares",
  profiles: "novafund_social_profiles",
  seeded: "novafund_social_seeded",
} as const;

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or unavailable */
  }
}

// ── Mock wallet addresses ──
const MOCK_WALLETS = [
  "GDQP2K...X7MZ",
  "GBZX9N...R4KJ",
  "GCRWF3...Y8QL",
  "GAVHI7...T2NP",
  "GCPWN5...M6VD",
  "GDFKL8...W3BH",
  "GBRMQ4...J9CS",
  "GCVNX6...P1RT",
];

const MOCK_NAMES: Record<string, string> = {
  "GDQP2K...X7MZ": "stellardev.eth",
  "GBZX9N...R4KJ": "nova_builder",
  "GCRWF3...Y8QL": "greenimpact",
  "GAVHI7...T2NP": "cryptoartist",
  "GCPWN5...M6VD": "defi_whale",
  "GDFKL8...W3BH": "lumens_fan",
  "GBRMQ4...J9CS": "solar_punk",
  "GCVNX6...P1RT": "web3_dev",
};

const MOCK_COMMENTS_POOL = [
  "This project has incredible potential. The team is well-organized and the milestones are realistic.",
  "Love the focus on sustainability. Backed this immediately after reading the whitepaper.",
  "How does the insurance pool work exactly? Would love more detail on the risk model.",
  "Been following this since day one. The progress on milestone 3 is really impressive.",
  "Great to see real-world impact projects on NovaFund. This is what decentralized finance should be about.",
  "The community around this project is amazing. Glad to be part of it.",
  "Curious about the validator consensus mechanism. Is there documentation available?",
  "Just contributed! Excited to see how the grid connection phase goes.",
  "This is exactly the kind of project that makes me bullish on Stellar.",
  "Would love to see quarterly impact reports once operations begin.",
  "The solar panel installation photos from phase 1 were incredible. Keep it up!",
  "Any plans for expanding to other regions after this pilot?",
];

function randomDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
  return d.toISOString();
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function seedMockData(): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(STORAGE_KEYS.seeded)) return;

  const projectIds = ["1", "2", "3", "4", "5", "6", "7", "8"];
  const comments: SocialComment[] = [];
  const likes: Record<string, string[]> = {};
  const follows: FollowRelation[] = [];
  const shares: Record<string, number> = {};
  const profiles: Record<string, SocialUser> = {};

  // Seed comments
  for (const pid of projectIds) {
    const count = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const wallet =
        MOCK_WALLETS[Math.floor(Math.random() * MOCK_WALLETS.length)];
      comments.push({
        id: `c_${generateId()}`,
        projectId: pid,
        authorWallet: wallet,
        content:
          MOCK_COMMENTS_POOL[
            Math.floor(Math.random() * MOCK_COMMENTS_POOL.length)
          ],
        createdAt: randomDate(30),
        likeCount: Math.floor(Math.random() * 15),
        isDeleted: false,
      });
    }
  }

  // Seed likes
  for (const pid of projectIds) {
    const likeCount = 20 + Math.floor(Math.random() * 80);
    const likers = new Set<string>();
    for (let i = 0; i < likeCount; i++) {
      likers.add(MOCK_WALLETS[Math.floor(Math.random() * MOCK_WALLETS.length)]);
    }
    likes[pid] = Array.from(likers);
  }

  // Seed follows
  for (let i = 0; i < MOCK_WALLETS.length; i++) {
    for (let j = 0; j < MOCK_WALLETS.length; j++) {
      if (i !== j && Math.random() > 0.6) {
        follows.push({
          followerWallet: MOCK_WALLETS[i],
          followingWallet: MOCK_WALLETS[j],
          createdAt: randomDate(60),
        });
      }
    }
  }

  // Seed shares
  for (const pid of projectIds) {
    shares[pid] = Math.floor(Math.random() * 50) + 5;
  }

  // Seed profiles
  for (const wallet of MOCK_WALLETS) {
    const followerCount = follows.filter(
      (f) => f.followingWallet === wallet
    ).length;
    const followingCount = follows.filter(
      (f) => f.followerWallet === wallet
    ).length;
    profiles[wallet] = {
      walletAddress: wallet,
      displayName: MOCK_NAMES[wallet],
      followerCount,
      followingCount,
      projectsCreated: Math.floor(Math.random() * 3),
      projectsBacked: Math.floor(Math.random() * 8) + 1,
    };
  }

  saveJSON(STORAGE_KEYS.comments, comments);
  saveJSON(STORAGE_KEYS.likes, likes);
  saveJSON(STORAGE_KEYS.follows, follows);
  saveJSON(STORAGE_KEYS.shares, shares);
  saveJSON(STORAGE_KEYS.profiles, profiles);
  localStorage.setItem(STORAGE_KEYS.seeded, "true");
}

// ── Store API ──

export const socialStore = {
  init() {
    seedMockData();
  },

  // ── Comments ──
  getComments(projectId: string): SocialComment[] {
    const all = loadJSON<SocialComment[]>(STORAGE_KEYS.comments, []);
    return all
      .filter((c) => c.projectId === projectId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  },

  addComment(
    projectId: string,
    authorWallet: string,
    content: string,
    parentId?: string
  ): SocialComment {
    const all = loadJSON<SocialComment[]>(STORAGE_KEYS.comments, []);
    const comment: SocialComment = {
      id: `c_${generateId()}`,
      projectId,
      authorWallet,
      content,
      createdAt: new Date().toISOString(),
      parentId,
      likeCount: 0,
      isDeleted: false,
    };
    all.push(comment);
    saveJSON(STORAGE_KEYS.comments, all);
    return comment;
  },

  deleteComment(commentId: string): void {
    const all = loadJSON<SocialComment[]>(STORAGE_KEYS.comments, []);
    const idx = all.findIndex((c) => c.id === commentId);
    if (idx !== -1) {
      all[idx].isDeleted = true;
      all[idx].content = "";
      saveJSON(STORAGE_KEYS.comments, all);
    }
  },

  reportComment(commentId: string): void {
    const all = loadJSON<SocialComment[]>(STORAGE_KEYS.comments, []);
    const idx = all.findIndex((c) => c.id === commentId);
    if (idx !== -1) {
      all[idx].isReported = true;
      saveJSON(STORAGE_KEYS.comments, all);
    }
  },

  likeComment(commentId: string): void {
    const all = loadJSON<SocialComment[]>(STORAGE_KEYS.comments, []);
    const idx = all.findIndex((c) => c.id === commentId);
    if (idx !== -1) {
      all[idx].likeCount += 1;
      saveJSON(STORAGE_KEYS.comments, all);
    }
  },

  // ── Project Likes ──
  getProjectLikes(projectId: string): string[] {
    const all = loadJSON<Record<string, string[]>>(STORAGE_KEYS.likes, {});
    return all[projectId] ?? [];
  },

  toggleProjectLike(projectId: string, wallet: string): boolean {
    const all = loadJSON<Record<string, string[]>>(STORAGE_KEYS.likes, {});
    if (!all[projectId]) all[projectId] = [];
    const idx = all[projectId].indexOf(wallet);
    const liked = idx === -1;
    if (liked) {
      all[projectId].push(wallet);
    } else {
      all[projectId].splice(idx, 1);
    }
    saveJSON(STORAGE_KEYS.likes, all);
    return liked;
  },

  hasLikedProject(projectId: string, wallet: string): boolean {
    const all = loadJSON<Record<string, string[]>>(STORAGE_KEYS.likes, {});
    return (all[projectId] ?? []).includes(wallet);
  },

  // ── Follows ──
  getFollowers(wallet: string): FollowRelation[] {
    const all = loadJSON<FollowRelation[]>(STORAGE_KEYS.follows, []);
    return all.filter((f) => f.followingWallet === wallet);
  },

  getFollowing(wallet: string): FollowRelation[] {
    const all = loadJSON<FollowRelation[]>(STORAGE_KEYS.follows, []);
    return all.filter((f) => f.followerWallet === wallet);
  },

  isFollowing(followerWallet: string, targetWallet: string): boolean {
    const all = loadJSON<FollowRelation[]>(STORAGE_KEYS.follows, []);
    return all.some(
      (f) =>
        f.followerWallet === followerWallet &&
        f.followingWallet === targetWallet
    );
  },

  toggleFollow(followerWallet: string, targetWallet: string): boolean {
    const all = loadJSON<FollowRelation[]>(STORAGE_KEYS.follows, []);
    const idx = all.findIndex(
      (f) =>
        f.followerWallet === followerWallet &&
        f.followingWallet === targetWallet
    );
    const following = idx === -1;
    if (following) {
      all.push({
        followerWallet,
        followingWallet: targetWallet,
        createdAt: new Date().toISOString(),
      });
    } else {
      all.splice(idx, 1);
    }
    saveJSON(STORAGE_KEYS.follows, all);
    return following;
  },

  // ── Shares ──
  getShareCount(projectId: string): number {
    const all = loadJSON<Record<string, number>>(STORAGE_KEYS.shares, {});
    return all[projectId] ?? 0;
  },

  incrementShare(projectId: string): number {
    const all = loadJSON<Record<string, number>>(STORAGE_KEYS.shares, {});
    all[projectId] = (all[projectId] ?? 0) + 1;
    saveJSON(STORAGE_KEYS.shares, all);
    return all[projectId];
  },

  // ── Stats ──
  getProjectStats(projectId: string): ProjectSocialStats {
    const likes = this.getProjectLikes(projectId);
    const comments = this.getComments(projectId).filter((c) => !c.isDeleted);
    const shareCount = this.getShareCount(projectId);
    return {
      likeCount: likes.length,
      commentCount: comments.length,
      shareCount,
    };
  },

  // ── Profiles ──
  getProfile(wallet: string): SocialUser {
    const all = loadJSON<Record<string, SocialUser>>(STORAGE_KEYS.profiles, {});
    return (
      all[wallet] ?? {
        walletAddress: wallet,
        followerCount: this.getFollowers(wallet).length,
        followingCount: this.getFollowing(wallet).length,
        projectsCreated: 0,
        projectsBacked: 0,
      }
    );
  },

  getMockWallets(): string[] {
    return MOCK_WALLETS;
  },

  getMockName(wallet: string): string | undefined {
    return MOCK_NAMES[wallet];
  },
};
