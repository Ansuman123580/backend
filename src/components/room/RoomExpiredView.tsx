"use client";

import React from "react";
import { useChat } from "@/context/ChatContext";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { Lock, ArrowRight, Home, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export function RoomExpiredView() {
  const { createAnotherRoom, resetToHome } = useChat();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative z-10 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg mx-auto text-center"
      >
        <div className="p-10 sm:p-12 rounded-3xl bg-[#0b0d12]/90 border border-white/[0.08] shadow-[0_30px_70px_rgba(0,0,0,0.8)] backdrop-blur-2xl relative overflow-hidden">
          {/* Faint blue/purple dissolution glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-sky-500/[0.04] blur-[80px] pointer-events-none" />

          {/* Locked Icon Badge */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-zinc-300 mx-auto mb-8 shadow-inner"
          >
            <Lock className="w-6 h-6 stroke-[1.8]" />
          </motion.div>

          {/* Time Expired Display */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-4"
          >
            <span className="font-mono text-4xl sm:text-5xl font-light tracking-[0.2em] text-zinc-600 block mb-3">
              00:00
            </span>
            <span className="inline-block px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.07] text-[11px] font-mono tracking-[0.25em] text-zinc-400 uppercase">
              Room Expired
            </span>
          </motion.div>

          {/* Heading and Ephemeral Note */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mb-10"
          >
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mb-2">
              This conversation has ended.
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 font-light max-w-sm mx-auto leading-relaxed">
              All messages from this session have dissolved completely. No logs or records remain.
            </p>
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <MagneticButton
              onClick={createAnotherRoom}
              size="lg"
              variant="primary"
              className="gap-2 group"
            >
              <span>Create New Room</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </MagneticButton>

            <MagneticButton
              onClick={resetToHome}
              size="lg"
              variant="secondary"
              className="gap-2"
            >
              <Home className="w-4 h-4 text-zinc-400" />
              <span>Return Home</span>
            </MagneticButton>
          </motion.div>

          <div className="mt-8 flex items-center justify-center gap-1.5 text-[11px] font-mono text-zinc-400">
            <Sparkles className="w-3 h-3 text-zinc-400" />
            <span>Talk. Then disappear.</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

