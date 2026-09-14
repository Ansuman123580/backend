"use client";

import React from "react";
import { motion } from "framer-motion";
import { Ghost, UserX, Trash2 } from "lucide-react";

export function PrivacySection() {
  const pillars = [
    {
      icon: UserX,
      title: "No Accounts",
      text: "No passwords to remember, no emails to verify, no phone numbers tied to identity.",
    },
    {
      icon: Ghost,
      title: "No Profiles",
      text: "Every session is anonymous. No status updates, presence trackers, or metadata logs.",
    },
    {
      icon: Trash2,
      title: "No Permanent History",
      text: "Designed around a strict five-minute lifecycle. When time is up, the conversation closes.",
    },
  ];

  return (
    <section
      id="privacy"
      className="py-24 sm:py-32 px-6 sm:px-8 max-w-5xl mx-auto relative z-10 border-t border-white/[0.05]"
    >
      <div className="flex flex-col items-center text-center max-w-2xl mx-auto mb-16">
        <span className="text-[11px] font-mono tracking-[0.25em] text-zinc-500 uppercase mb-4">
          Philosophy
        </span>
        <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white mb-6">
          Nothing to remember.
        </h2>
        <p className="text-lg text-zinc-400 font-light leading-relaxed">
          No account. No profile. No permanent conversation history.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {pillars.map((pillar, idx) => {
          const Icon = pillar.icon;
          return (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                delay: idx * 0.15,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="p-7 rounded-2xl bg-white/[0.015] border border-white/[0.05] hover:border-white/[0.12] transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-zinc-300 mb-5">
                <Icon className="w-4 h-4 stroke-[1.8]" />
              </div>
              <h3 className="text-sm font-mono tracking-wider text-zinc-200 uppercase mb-2">
                {pillar.title}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed">
                {pillar.text}
              </p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

