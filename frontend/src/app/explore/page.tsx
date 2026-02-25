"use client";

import React, { useState, useMemo, useEffect } from "react";
import { ProjectCard, type Project } from "@/components/ProjectCard";
import { Search, ChevronDown, Filter } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const MOCK_PROJECTS: Project[] = [
  {
    id: "1",
    title: "Quantum Ledger Explorer",
    description: "A next-generation blockchain explorer for high-frequency trading networks on Stellar.",
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
    description: "Decentralized marketplace for verified carbon offsets from sustainable farming initiatives.",
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
    description: "An immersive virtual reality space for digital artists to showcase and sell NFT-backed art.",
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
    description: "P2P energy sharing platform utilizing smart meters and Stellar micro-payments.",
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
    description: "A comprehensive design system for decentralized finance applications focused on accessibility.",
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
    description: "Autonomous marine drones monitoring coral reefs and detecting plastic pollution patterns.",
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
    description: "Transparency protocol for clothing brands to verify sustainable supply chain practices.",
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
    description: "Community-driven platform for Stellar developer resources, grants, and collaboration.",
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

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("Newest");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [fundingStage, setFundingStage] = useState<string>("");
  const [maxDaysLeft, setMaxDaysLeft] = useState<number | null>(null);
  const [minSuccessProb, setMinSuccessProb] = useState<number>(0);
  const [isSortOpen, setIsSortOpen] = useState(false);

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
      if (selectedCategories.length > 0 && !selectedCategories.includes(p.category)) {
        return false;
      }

      // Funding stage filter
      if (fundingStage && p.fundingStage !== fundingStage) return false;

      // Days left filter (timeline)
      if (maxDaysLeft !== null && p.daysLeft > maxDaysLeft) return false;

      // Success probability
      if (typeof p.successProbability === "number" && p.successProbability < minSuccessProb) return false;

      return true;
    });

    switch (sortBy) {
      case "Newest":
        result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "Ending Soon":
        result = [...result].sort((a, b) => a.daysLeft - b.daysLeft);
        break;
      case "Most Funded":
        result = [...result].sort((a, b) => (b.raised / b.goal) - (a.raised / a.goal));
        break;
    }

    return result;
  }, [debouncedSearch, sortBy, selectedCategories, fundingStage, maxDaysLeft, minSuccessProb]);

  // Debounce the search input to reduce recomputations
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // derive dynamic filter options
  const categories = useMemo(() => Array.from(new Set(MOCK_PROJECTS.map((p) => p.category))), []);
  const fundingStages = useMemo(() => Array.from(new Set(MOCK_PROJECTS.map((p) => p.fundingStage).filter(Boolean as any))), []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section / Navigation Overlay */}
      <div className="relative border-b border-white/5 bg-white/[0.02] py-20">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center"
          >
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl">
              Discover <span className="text-primary">Impactful</span> Projects
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-white/60">
              NovaFund is the marketplace for decentralized micro-investments. Explore high-growth opportunities powered by the Stellar network.
            </p>
          </motion.div>

        </div>

        {/* Filters Panel */}
        <div className="mb-8 flex flex-col gap-4 rounded-xl border border-white/5 bg-white/3 p-4 text-sm text-white/80 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="mb-2 font-semibold">Categories</div>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setSelectedCategories((prev) => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs transition-colors border",
                    selectedCategories.includes(c) ? "bg-primary text-black border-transparent" : "bg-white/5 text-white/60 border-white/5"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full sm:w-72">
            <div className="mb-2 font-semibold">Funding Stage</div>
            <select
              value={fundingStage}
              onChange={(e) => setFundingStage(e.target.value)}
              className="w-full rounded-md bg-white/5 p-2 text-white/80 outline-none"
            >
              <option value="">Any</option>
              {fundingStages.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-56">
            <div className="mb-2 font-semibold">Timeline (max days left)</div>
            <input
              type="number"
              placeholder="e.g. 30"
              min={0}
              value={maxDaysLeft ?? ""}
              onChange={(e) => setMaxDaysLeft(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-md bg-white/5 p-2 text-white/80 outline-none"
            />
          </div>

          <div className="w-full sm:w-64">
            <div className="mb-2 flex items-center justify-between font-semibold">
              <span>Min Success %</span>
              <span className="text-xs text-white/40">{minSuccessProb}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={minSuccessProb}
              onChange={(e) => setMinSuccessProb(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSelectedCategories([]); setFundingStage(""); setMaxDaysLeft(null); setMinSuccessProb(0); setSearchQuery(""); }}
              className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Grid Content */}
      <main className="container mx-auto px-6 py-16">
        {/* Search and Filters */}
        <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/20" />
            <input
              type="text"
              placeholder="Search projects by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white outline-none transition-colors focus:border-primary/50 focus:bg-white/10"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 text-sm font-medium text-white transition-colors hover:border-white/20 hover:bg-white/10"
            >
              <Filter className="h-4 w-4" />
              <span>Sort By: {sortBy}</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", isSortOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {isSortOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-full z-10 mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-2xl backdrop-blur-xl"
                >
                  {(["Newest", "Ending Soon", "Most Funded"] as SortOption[]).map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        setSortBy(option);
                        setIsSortOpen(false);
                      }}
                      className={cn(
                        "flex w-full px-4 py-3 text-left text-sm transition-colors hover:bg-white/5",
                        sortBy === option ? "text-primary font-bold" : "text-white/60"
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

        {filteredAndSortedProjects.length > 0 ? (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {filteredAndSortedProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-white/5 p-6">
              <Search className="h-12 w-12 text-white/20" />
            </div>
            <h3 className="mt-6 text-xl font-bold text-white">No projects found</h3>
            <p className="mt-2 text-white/40">Try adjusting your search query or filters.</p>
          </div>
        )}
      </main>

      {/* Footer Decoration */}
      <footer className="border-t border-white/5 py-12">
        <div className="container mx-auto px-6 text-center text-sm text-white/20">
          Built for the future of decentralized finance on Stellar.
        </div>
      </footer>
    </div>
  );
}
