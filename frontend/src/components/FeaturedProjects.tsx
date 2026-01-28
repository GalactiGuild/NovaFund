"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { ProjectCard } from "./ProjectCard";
import { Button } from "./ui";

const FEATURED_PROJECTS = [
  {
    id: "1",
    title: "EcoSolar Grid",
    description: "Bringing renewable energy to underserved communities across Africa",
    category: "Green Energy" as const,
    goal: 50000,
    raised: 32000,
    backers: 1240,
    daysLeft: 18,
    imageUrl: "",
    createdAt: "2024-01-01",
  },
  {
    id: "2",
    title: "MindFlow App",
    description: "AI-powered meditation and mental wellness platform for developers",
    category: "Tech" as const,
    goal: 30000,
    raised: 28500,
    backers: 950,
    daysLeft: 12,
    imageUrl: "",
    createdAt: "2024-01-05",
  },
  {
    id: "3",
    title: "Urban Art Collective",
    description: "Street art museum and NFT gallery for emerging artists worldwide",
    category: "Art" as const,
    goal: 25000,
    raised: 19200,
    backers: 680,
    daysLeft: 25,
    imageUrl: "",
    createdAt: "2024-01-08",
  },
];

export const FeaturedProjects: React.FC = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: "easeOut",
      },
    },
  };

  return (
    <section className="relative py-20 lg:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0e27] via-transparent to-[#0a0e27]/50" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="mb-16">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
                  Featured Projects
                </h2>
                <div className="h-1 w-20 bg-gradient-to-r from-purple-400 to-cyan-400 rounded-full" />
                <p className="mt-6 max-w-2xl text-lg text-gray-300">
                  Discover groundbreaking projects that are reshaping industries 
                  and creating positive impact around the world.
                </p>
              </div>
              <motion.div
                whileHover={{ x: 5 }}
                className="lg:flex-shrink-0"
              >
                <Button
                  variant="secondary"
                  className="inline-flex items-center gap-2 group"
                >
                  Explore All Projects
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </motion.div>
            </div>
          </motion.div>

          {/* Projects Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURED_PROJECTS.map((project, index) => (
              <motion.div
                key={project.id}
                variants={itemVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                transition={{
                  duration: 0.8,
                  delay: index * 0.1,
                  ease: "easeOut",
                }}
              >
                <ProjectCard project={project} />
              </motion.div>
            ))}
          </div>

          {/* CTA Section */}
          <motion.div
            variants={itemVariants}
            className="mt-16 rounded-2xl border border-white/10 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 p-8 sm:p-12 backdrop-blur-sm text-center"
          >
            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Ready to invest in innovation?
            </h3>
            <p className="text-gray-300 mb-8 max-w-xl mx-auto">
              Join thousands of community members funding the future. Start with 
              as little as $1 and become part of the investment revolution.
            </p>
            <Button variant="primary" size="lg" className="inline-flex items-center gap-2">
              Get Started Now
              <ArrowRight className="w-5 h-5" />
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
