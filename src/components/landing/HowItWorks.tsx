"use client";

import React from "react";
import { motion } from "framer-motion";
import { Key, Share2, Sparkles } from "lucide-react";

const steps = [
  {
    num: "01",
    title: "CREATE",
    desc: "Create a private room in seconds.",
    icon: Key,
    detail: "No login. No cookies. A random ephemeral code is generated immediately.",
  },
  {
    num: "02",
    title: "SHARE",
    desc: "Send the generated room code to one person.",
    icon: Share2,
    detail: "Share via text, link, or voice. Once both join, the 5-minute countdown begins.",
  },
  {
    num: "03",
    title: "DISAPPEAR",
    desc: "The conversation expires after five minutes.",
    icon: Sparkles,
    detail: "At 00:00, the session locks and messages dissolve completely into nothing.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-24 sm:py-32 px-6 sm:px-8 max-w-6xl mx-auto relative z-10"
    >
      {/* Section Header */}
      <div className="flex flex-col items-center text-center mb-16 sm:mb-24">
        <span className="text-[11px] font-mono tracking-[0.25em] text-zinc-500 uppercase mb-3">
          Architecture
        </span>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-white">
          Ephemeral by design.
        </h2>
      </div>

      {/* 3 Step Cards Grid */}
      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        {/* Subtle connecting horizontal beam across cards on desktop */}
        <div className="hidden md:block absolute top-1/2 left-0 right-0 h-[1px] -translate-y-12 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent pointer-events-none z-0" />

        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                duration: 0.7,
                delay: idx * 0.18,
                ease: [0.16, 1, 0.3, 1],
              }}
              whileHover={{ y: -4 }}
              className="group relative z-10 flex flex-col p-8 rounded-2xl bg-[#0e1015]/70 border border-white/[0.07] hover:border-white/[0.18] transition-all duration-300 shadow-xl backdrop-blur-sm"
            >
              {/* Step number badge */}
              <div className="flex items-center justify-between mb-8">
                <span className="text-3xl sm:text-4xl font-mono font-light tracking-tighter text-zinc-600 group-hover:text-zinc-400 transition-colors">
                  {step.num}
                </span>
                <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:border-white/20 transition-all">
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              {/* Title & Description */}
              <h3 className="text-xs font-mono font-semibold tracking-[0.2em] text-zinc-400 uppercase mb-2">
                {step.title}
              </h3>
              <p className="text-xl font-medium text-white mb-3 tracking-tight">
                {step.desc}
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed font-light mt-auto pt-4 border-t border-white/[0.04]">
                {step.detail}
              </p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

