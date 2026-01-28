"use client";

import { LandingHero } from "@/components/LandingHero";
import { HowItWorks } from "@/components/HowItWorks";
import { FeaturedProjects } from "@/components/FeaturedProjects";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <LandingHero />

      {/* How It Works Section */}
      <HowItWorks />

      {/* Featured Projects Section */}
      <FeaturedProjects />
    </main>
  );
}
