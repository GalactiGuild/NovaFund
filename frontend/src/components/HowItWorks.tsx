"use client";

import React from "react";
import { motion } from "framer-motion";
import { Lightbulb, BarChart3, Zap } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Discover & Connect",
    description:
      "Explore innovative projects from creators worldwide. Filter by category, funding stage, or impact area to find opportunities aligned with your vision.",
    icon: Lightbulb,
    color: "from-blue-500 to-cyan-500",
  },
  {
    number: "02",
    title: "Invest & Collaborate",
    description:
      "Contribute micro-investments starting at just $1. Join communities of backers, participate in decision-making, and support projects you believe in.",
    icon: BarChart3,
    color: "from-purple-500 to-blue-500",
  },
  {
    number: "03",
    title: "Track & Earn Rewards",
    description:
      "Monitor your portfolio in real-time. Earn reputation points, gain voting rights, and receive rewards as projects succeed on the Stellar blockchain.",
    icon: Zap,
    color: "from-orange-500 to-purple-500",
  },
];

export const HowItWorks: React.FC = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
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

  const stepVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (index: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.6,
        delay: index * 0.15,
        ease: "easeOut",
      },
    }),
  };

  return (
    <section className="relative py-20 lg:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0e27]/50 via-transparent to-[#0a0e27]/50" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
              How It Works
            </h2>
            <div className="h-1 w-20 bg-gradient-to-r from-purple-400 to-cyan-400 mx-auto rounded-full" />
            <p className="mt-6 max-w-2xl mx-auto text-lg text-gray-300">
              Three simple steps to become part of the investment revolution
            </p>
          </motion.div>

          {/* Steps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-6">
            {steps.map((step, index) => {
              const IconComponent = step.icon;
              return (
                <motion.div
                  key={index}
                  custom={index}
                  variants={stepVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-50px" }}
                  className="group"
                >
                  <div className="relative h-full">
                    {/* Card */}
                    <div className="relative h-full rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-gradient-to-br hover:from-white/10 hover:to-white/5">
                      {/* Step Number Badge */}
                      <div
                        className={`inline-flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br ${step.color} mb-6 group-hover:scale-110 transition-transform`}
                      >
                        <span className="text-lg font-bold text-white">
                          {step.number}
                        </span>
                      </div>

                      {/* Icon */}
                      <div className="mb-6">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-white/5 border border-white/10 group-hover:bg-white/10 transition-colors">
                          <IconComponent className="w-7 h-7 text-gray-300 group-hover:text-white transition-colors" />
                        </div>
                      </div>

                      {/* Content */}
                      <h3 className="text-xl font-semibold text-white mb-3">
                        {step.title}
                      </h3>
                      <p className="text-gray-400 leading-relaxed">
                        {step.description}
                      </p>

                      {/* Decorative line */}
                      {index < steps.length - 1 && (
                        <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-purple-500/50 to-transparent" />
                      )}
                    </div>

                    {/* Glow effect on hover */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/0 to-cyan-500/0 opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-300 pointer-events-none" />
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Visual Flow Indicator */}
          <motion.div
            variants={itemVariants}
            className="mt-16 text-center"
          >
            <p className="text-sm text-gray-400 mb-4">
              Ready to start your investment journey?
            </p>
            <div className="flex justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{
                    duration: 2,
                    delay: i * 0.3,
                    repeat: Infinity,
                  }}
                  className={`h-2 rounded-full ${
                    i < 2
                      ? "w-2 bg-purple-400"
                      : "w-8 bg-gradient-to-r from-purple-400 to-cyan-400"
                  }`}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
