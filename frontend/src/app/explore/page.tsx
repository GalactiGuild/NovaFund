"use client";

import React, { useState, useMemo, useEffect } from "react";
import { ProjectCard, type Project } from "@/components/ProjectCard";
import { Search, ChevronDown, Filter } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const MOCK_PROJECTS: Project[] = [
  {
    id: "1",
    title: "Quantum Ledger Explorer",
    description:
      "A next-generation blockchain explorer for high-frequency trading networks on Stellar.",
    category: "Tech",
    fundingStage: "Seed",
    successProbability: 42,
    goal: 50000,
    raised: 32500,
    backers: 124,
    daysLeft: 12,
    imageUrl: "",
    createdAt: "2024-01-15",
  },
  {
    id: "2",
    title: "EcoHarvest Carbon Credits",
    description:
      "Decentralized marketplace for verified carbon offsets from sustainable farming initiatives.",
    category: "Green Energy",
    fundingStage: "Series A",
    successProbability: 78,
    goal: 100000,
    raised: 85000,
    backers: 450,
    daysLeft: 5,
    imageUrl: "",
    createdAt: "2024-01-10",
  },
  {
    id: "3",
    title: "Neon Dreams: VR Art Gallery",
    description:
      "An immersive virtual reality space for digital artists to showcase and sell NFT-backed art.",
    category: "Art",
    fundingStage: "Crowdfunding",
    successProbability: 36,
    goal: 25000,
    raised: 12000,
    backers: 89,
    daysLeft: 20,
    imageUrl: "",
    createdAt: "2024-01-20",
  },
  {
    id: "4",
    title: "SolarGrid Mesh Network",
    description:
      "P2P energy sharing platform utilizing smart meters and Stellar micro-payments.",
    category: "Green Energy",
    fundingStage: "Seed",
    successProbability: 50,
    goal: 75000,
    raised: 15000,
    backers: 210,
    daysLeft: 45,
    imageUrl: "",
    createdAt: "2024-01-18",
  },
  {
    id: "5",
    title: "ZenFlow UI Kit",
    description:
      "A comprehensive design system for decentralized finance applications focused on accessibility.",
    category: "UX",
    fundingStage: "Crowdfunding",
    successProbability: 92,
    goal: 15000,
    raised: 14500,
    backers: 312,
    daysLeft: 2,
    imageUrl: "",
    createdAt: "2024-01-21",
  },
  {
    id: "6",
    title: "Ocean Guardian AI",
    description:
      "Autonomous marine drones monitoring coral reefs and detecting plastic pollution patterns.",
    category: "Tech",
    fundingStage: "Series A",
    successProbability: 61,
    goal: 120000,
    raised: 45000,
    backers: 156,
    daysLeft: 30,
    imageUrl: "",
    createdAt: "2024-01-05",
  },
  {
    id: "7",
    title: "Ethical Fashion Ledger",
    description:
      "Transparency protocol for clothing brands to verify sustainable supply chain practices.",
    category: "Art",
    fundingStage: "Seed",
    successProbability: 21,
    goal: 40000,
    raised: 5000,
    backers: 42,
    daysLeft: 60,
    imageUrl: "",
    createdAt: "2024-01-19",
  },
  {
    id: "8",
    title: "Stellar Dev Hub",
    description:
      "Community-driven platform for Stellar developer resources, grants, and collaboration.",
    category: "Tech",
    fundingStage: "Crowdfunding",
    successProbability: 85,
    goal: 30000,
    raised: 28000,
    backers: 560,
    daysLeft: 3,
    imageUrl: "",
    createdAt: "2024-01-12",
  },
];

type SortOption = "Newest" | "Ending Soon" | "Most Funded";

function ExploreContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(
    searchParams.get("q") || "",
  );
  const [sortBy, setSortBy] = useState<SortOption>(
    (searchParams.get("sort") as SortOption) || "Newest",
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams.getAll("category") || [],
  );
  const [fundingStage, setFundingStage] = useState<string>(
    searchParams.get("stage") || "",
  );
  const [maxDaysLeft, setMaxDaysLeft] = useState<number | null>(null);
  const [minSuccessProb, setMinSuccessProb] = useState<number>(0);
  const [isSortOpen, setIsSortOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));

    if (debouncedSearch) params.set("q", debouncedSearch);
    else params.delete("q");

    if (sortBy !== "Newest") params.set("sort", sortBy);
    else params.delete("sort");

    params.delete("category");
    selectedCategories.forEach((c) => params.append("category", c));

    if (fundingStage) params.set("stage", fundingStage);
    else params.delete("stage");

    const currentQuery = searchParams.toString();
    const newQuery = params.toString();
    if (currentQuery !== newQuery) {
      router.replace(`${pathname}?${newQuery}`, { scroll: false });
    }
  }, [
    debouncedSearch,
    sortBy,
    selectedCategories,
    fundingStage,
    pathname,
    router,
    searchParams,
  ]);

  const filteredAndSortedProjects = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();

    let result = MOCK_PROJECTS.filter((p) => {
      // Basic text search across important fields
      const inText = [p.title, p.description, p.category, p.fundingStage]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);

      if (q && !inText) return false;

      // Category filter (multi-select)
      if (
        selectedCategories.length > 0 &&
        !selectedCategories.includes(p.category)
      ) {
        return false;
      }

      // Funding stage filter
      if (fundingStage && p.fundingStage !== fundingStage) return false;

      // Days left filter (timeline)
      if (maxDaysLeft !== null && p.daysLeft > maxDaysLeft) return false;

      // Success probability
      if (
        typeof p.successProbability === "number" &&
        p.successProbability < minSuccessProb
      )
        return false;

      return true;
    });

    switch (sortBy) {
      case "Newest":
        result = [...result].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
      case "Ending Soon":
        result = [...result].sort((a, b) => a.daysLeft - b.daysLeft);
        break;
      case "Most Funded":
        result = [...result].sort(
          (a, b) => b.raised / b.goal - a.raised / a.goal,
        );
        break;
    }

    return result;
  }, [
    debouncedSearch,
    sortBy,
    selectedCategories,
    fundingStage,
    maxDaysLeft,
    minSuccessProb,
  ]);

  // Debounce the search input to reduce recomputations
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // derive dynamic filter options
  const categories = useMemo(
    () => Array.from(new Set(MOCK_PROJECTS.map((p) => p.category))),
    [],
  );
  const fundingStages = useMemo(
    () =>
      Array.from(
        new Set(MOCK_PROJECTS.map((p) => p.fundingStage).filter(Boolean)),
      ),
    [],
  );

  return (
    <div className="relative min-h-screen bg-[#050505] text-foreground overflow-hidden">
      {/* Subtle background glows */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-primary/20 opacity-40 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-1/4 h-[400px] w-[400px] -translate-y-1/2 rounded-[100%] bg-blue-500/10 opacity-30 blur-[100px]" />

      {/* Hero Section */}
      <div className="relative z-10 py-24 sm:py-32 border-b border-white/5 bg-grid-white/[0.02]">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col items-center text-center relative"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6 shadow-[0_0_20px_rgba(var(--primary),0.2)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Explore the Ecosystem
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-7xl">
              Discover{" "}
              <span className="bg-gradient-to-r from-primary via-blue-400 to-purple-500 bg-clip-text text-transparent">
                Impactful
              </span>{" "}
              Projects
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-white/50 font-light leading-relaxed">
              NovaFund is the marketplace for decentralized micro-investments.
              Explore high-growth opportunities powered by the Stellar network.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Main Content Layout */}
      <main className="container relative mx-auto px-6 py-12 z-10 w-full max-w-7xl">
        {/* Filters & Search Glass Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-12 relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/60 p-6 sm:p-8 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
        >
          {/* Subtle Inner Glow */}
          <div className="absolute inset-x-0 -top-px h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            {/* Search Bar */}
            <div className="relative flex-1 lg:max-w-md">
              <div className="mb-3 text-sm font-medium text-zinc-400 tracking-wide uppercase">
                Search
              </div>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-primary" />
                <input
                  type="text"
                  placeholder="Find your next investment..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-14 w-full rounded-2xl border border-white/5 bg-white/5 pl-12 pr-4 text-white placeholder-zinc-500 outline-none transition-all focus:border-primary/50 focus:bg-white/[0.08] focus:ring-4 focus:ring-primary/10"
                />
              </div>
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-end gap-4 lg:flex-nowrap">
              <div className="w-full sm:w-auto">
                <div className="mb-3 text-sm font-medium text-zinc-400 tracking-wide uppercase">
                  Category
                </div>
                <select
                  value={selectedCategories[0] || ""}
                  onChange={(e) =>
                    setSelectedCategories(
                      e.target.value ? [e.target.value] : [],
                    )
                  }
                  className="h-14 w-full sm:w-48 appearance-none rounded-2xl border border-white/5 bg-white/5 px-4 text-white outline-none transition-all hover:bg-white/[0.08] focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                >
                  <option className="bg-zinc-900" value="">
                    All Categories
                  </option>
                  {categories.map((c) => (
                    <option className="bg-zinc-900" key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-auto">
                <div className="mb-3 text-sm font-medium text-zinc-400 tracking-wide uppercase">
                  Stage
                </div>
                <select
                  value={fundingStage}
                  onChange={(e) => setFundingStage(e.target.value)}
                  className="h-14 w-full sm:w-48 appearance-none rounded-2xl border border-white/5 bg-white/5 px-4 text-white outline-none transition-all hover:bg-white/[0.08] focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                >
                  <option className="bg-zinc-900" value="">
                    Any Stage
                  </option>
                  {fundingStages.map((s) => (
                    <option className="bg-zinc-900" key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative w-full sm:w-auto">
                <div className="mb-3 text-sm font-medium text-zinc-400 tracking-wide uppercase">
                  Sort
                </div>
                <button
                  onClick={() => setIsSortOpen(!isSortOpen)}
                  className="flex h-14 w-full sm:w-48 items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-4 text-white transition-all hover:bg-white/[0.08] focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                >
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-zinc-400" />
                    {sortBy}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-zinc-400 transition-transform",
                      isSortOpen && "rotate-180",
                    )}
                  />
                </button>

                <AnimatePresence>
                  {isSortOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/95 shadow-2xl backdrop-blur-xl"
                    >
                      {(
                        ["Newest", "Ending Soon", "Most Funded"] as SortOption[]
                      ).map((option) => (
                        <button
                          key={option}
                          onClick={() => {
                            setSortBy(option);
                            setIsSortOpen(false);
                          }}
                          className={cn(
                            "flex w-full px-4 py-3 text-sm transition-colors hover:bg-white/10 text-left",
                            sortBy === option
                              ? "text-primary font-medium bg-primary/5"
                              : "text-zinc-400",
                          )}
                        >
                          {option}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Project Grid */}
        <div className="mb-20">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white">
              {filteredAndSortedProjects.length}{" "}
              <span className="text-zinc-500 font-normal">
                Projects available
              </span>
            </h2>
          </div>

          {filteredAndSortedProjects.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <AnimatePresence mode="popLayout">
                {filteredAndSortedProjects.map((project, idx) => (
                  <motion.div
                    key={project.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{
                      duration: 0.4,
                      delay: idx * 0.05,
                      type: "spring",
                    }}
                  >
                    <ProjectCard project={project} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-32 text-center rounded-3xl border border-white/5 bg-white/[0.01]"
            >
              <div className="rounded-full border border-white/10 bg-zinc-900/50 p-6 mb-6 shadow-xl backdrop-blur-sm">
                <Search className="h-10 w-10 text-zinc-500" />
              </div>
              <h3 className="text-3xl font-light tracking-tight text-white">
                No projects found
              </h3>
              <p className="mt-3 text-zinc-500 max-w-sm">
                We couldn&apos;t find any projects matching your current
                filters. Try relaxing your criteria.
              </p>

              <button
                onClick={() => {
                  setSelectedCategories([]);
                  setFundingStage("");
                  setMaxDaysLeft(null);
                  setMinSuccessProb(0);
                  setSearchQuery("");
                }}
                className="mt-8 rounded-full border border-primary/50 bg-primary/10 px-8 py-3 text-sm font-medium text-primary transition-all hover:bg-primary hover:text-black hover:shadow-[0_0_20px_rgba(var(--primary),0.5)]"
              >
                Clear all filters
              </button>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-[#050505]">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <ExploreContent />
    </React.Suspense>
  );
}
