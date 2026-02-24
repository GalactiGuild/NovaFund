"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Briefcase, Heart, Users as UsersIcon } from "lucide-react";
import { motion } from "framer-motion";
import { UserProfileCard } from "@/components/social/UserProfileCard";
import { FollowButton } from "@/components/social/FollowButton";
import { useSocial } from "@/contexts/SocialContext";
import { socialStore } from "@/lib/social-store";

type Tab = "created" | "backed" | "followers" | "following";

export default function ProfilePage({
  params,
}: {
  params: { wallet: string };
}) {
  const wallet = decodeURIComponent(params.wallet);
  const { getFollowerCount, getFollowingCount, getProfile } = useSocial();
  const [activeTab, setActiveTab] = useState<Tab>("created");

  const profile = getProfile(wallet);
  const followers = socialStore.getFollowers(wallet);
  const following = socialStore.getFollowing(wallet);

  const tabs: {
    key: Tab;
    label: string;
    count: number;
    icon: React.ElementType;
  }[] = useMemo(
    () => [
      {
        key: "created",
        label: "Projects Created",
        count: profile.projectsCreated,
        icon: Briefcase,
      },
      {
        key: "backed",
        label: "Backed",
        count: profile.projectsBacked,
        icon: Heart,
      },
      {
        key: "followers",
        label: "Followers",
        count: getFollowerCount(wallet),
        icon: UsersIcon,
      },
      {
        key: "following",
        label: "Following",
        count: getFollowingCount(wallet),
        icon: UsersIcon,
      },
    ],
    [profile, wallet, getFollowerCount, getFollowingCount]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link
          href="/explore"
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Explore
        </Link>

        <UserProfileCard walletAddress={wallet} showFollow />

        {/* Tabs */}
        <div className="mt-8 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-purple-500/20 text-purple-300"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-6"
        >
          {activeTab === "created" && (
            <div className="space-y-3">
              {profile.projectsCreated === 0 ? (
                <EmptyTabState message="No projects created yet." />
              ) : (
                Array.from({ length: profile.projectsCreated }).map((_, i) => (
                  <ProjectPlaceholder key={i} index={i} type="created" />
                ))
              )}
            </div>
          )}

          {activeTab === "backed" && (
            <div className="space-y-3">
              {profile.projectsBacked === 0 ? (
                <EmptyTabState message="No projects backed yet." />
              ) : (
                Array.from({ length: Math.min(profile.projectsBacked, 5) }).map(
                  (_, i) => (
                    <ProjectPlaceholder key={i} index={i} type="backed" />
                  )
                )
              )}
            </div>
          )}

          {activeTab === "followers" && (
            <div className="space-y-3">
              {followers.length === 0 ? (
                <EmptyTabState message="No followers yet." />
              ) : (
                followers.map((f) => (
                  <WalletRow
                    key={f.followerWallet}
                    wallet={f.followerWallet}
                    date={f.createdAt}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === "following" && (
            <div className="space-y-3">
              {following.length === 0 ? (
                <EmptyTabState message="Not following anyone yet." />
              ) : (
                following.map((f) => (
                  <WalletRow
                    key={f.followingWallet}
                    wallet={f.followingWallet}
                    date={f.createdAt}
                  />
                ))
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function EmptyTabState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] py-12 text-center">
      <p className="text-sm text-white/30">{message}</p>
    </div>
  );
}

function WalletRow({ wallet, date }: { wallet: string; date: string }) {
  const displayName = socialStore.getMockName(wallet);
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 transition-colors hover:bg-white/[0.05]">
      <Link
        href={`/profile/${encodeURIComponent(wallet)}`}
        className="flex items-center gap-3"
      >
        <WalletAvatar wallet={wallet} />
        <div>
          <p className="text-sm font-semibold text-white">
            {displayName ?? wallet}
          </p>
          <p className="text-xs text-white/30">
            Since {new Date(date).toLocaleDateString()}
          </p>
        </div>
      </Link>
      <FollowButton targetWallet={wallet} size="sm" />
    </div>
  );
}

function WalletAvatar({ wallet }: { wallet: string }) {
  let hash = 0;
  for (let i = 0; i < wallet.length; i++) {
    hash = wallet.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return (
    <div
      className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: `hsl(${h}, 60%, 55%)` }}
    >
      {wallet.slice(0, 2)}
    </div>
  );
}

function ProjectPlaceholder({ index, type }: { index: number; type: string }) {
  const projectNames = [
    "Stellar Solar Initiative",
    "Quantum Ledger Explorer",
    "EcoHarvest Carbon Credits",
    "SolarGrid Mesh Network",
    "ZenFlow UI Kit",
  ];
  const name = projectNames[index % projectNames.length];
  return (
    <Link
      href={`/project/${index + 1}`}
      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 transition-colors hover:bg-white/[0.05]"
    >
      <div>
        <p className="text-sm font-semibold text-white">{name}</p>
        <p className="text-xs text-white/30">
          {type === "created" ? "Creator" : "Backer"}
        </p>
      </div>
      <span className="text-xs text-white/40">View</span>
    </Link>
  );
}
