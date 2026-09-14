"use client";

import React, { useState } from "react";
import { useChat } from "@/context/ChatContext";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { ArrowRight, KeyRound, Shield, Clock } from "lucide-react";
import { motion } from "framer-motion";

export function Hero() {
  const { initiateCreateRoom, goToScreen } = useChat();
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { innerWidth, innerHeight } = window;
    const x = (e.clientX / innerWidth - 0.5) * 20;
    const y = (e.clientY / innerHeight - 0.5) * 20;
    setMouseOffset({ x, y });
  };

  return (
    <section
      onMouseMove={handleMouseMove}
      className="relative min-h-[92vh] flex flex-col items-center justify-center pt-28 pb-16 px-6 sm:px-8 overflow-hidden select-none"
    >
      {/* Decorative Floating Depth Elements (Reacts to cursor) */}
      <motion.div
        animate={{ x: mouseOffset.x * -1.2, y: mouseOffset.y * -1.2 }}
        transition={{ type: "spring", stiffness: 100, damping: 30 }}
        className="pointer-events-none absolute top-1/3 left-[12%] hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] backdrop-blur-md text-[11px] font-mono text-zinc-500 tracking-wider"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 animate-pulse" />
        EPHEMERAL SESSION ACTIVE
      </motion.div>

      <motion.div
        animate={{ x: mouseOffset.x * 1.5, y: mouseOffset.y * 1.5 }}
        transition={{ type: "spring", stiffness: 100, damping: 30 }}
        className="pointer-events-none absolute bottom-1/4 right-[10%] hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] backdrop-blur-md text-[11px] font-mono text-zinc-500 tracking-wider"
      >
        <Clock className="w-3 h-3 text-zinc-400" />
        05:00 AUTO-EXPIRY
      </motion.div>

      <div className="max-w-4xl mx-auto text-center flex flex-col items-center relative z-10">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] mb-8 text-[11px] font-mono tracking-[0.22em] text-zinc-400 uppercase"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400/80 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
          PRIVATE • TEMPORARY • SIMPLE
        </motion.div>

        {/* Huge Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl sm:text-7xl md:text-8xl font-semibold tracking-tight text-white leading-[1.05] sm:leading-[1.02] mb-6 font-sans"
        >
          Talk.
          <br />
          <span className="text-zinc-400 font-normal">Then disappear.</span>
        </motion.h1>

        {/* Supporting text */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-lg sm:text-xl text-zinc-400 max-w-xl mx-auto font-light leading-relaxed mb-10"
        >
          Private conversations designed to last five minutes.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
        >
          <MagneticButton
            onClick={() => initiateCreateRoom()}
            size="lg"
            variant="primary"
            className="w-full sm:w-auto group"
          >
            <span>Create Private Room</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
          </MagneticButton>

          <MagneticButton
            onClick={() => goToScreen("join")}
            size="lg"
            variant="secondary"
            className="w-full sm:w-auto group"
          >
            <KeyRound className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
            <span>Join With Code</span>
          </MagneticButton>
        </motion.div>

        {/* Sub-indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="mt-8 flex items-center gap-2 text-[11px] font-mono tracking-[0.2em] text-zinc-500 uppercase"
        >
          <Shield className="w-3.5 h-3.5 text-zinc-500" />
          <span>No account required</span>
        </motion.div>
      </div>
    </section>
  );
}

