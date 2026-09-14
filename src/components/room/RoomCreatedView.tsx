"use client";

import React, { useState } from "react";
import { useChat } from "@/context/ChatContext";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { Copy, Check, ArrowRight, Clock, Share2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export function RoomCreatedView() {
  const { session, enterCreatedRoom, copyToClipboard, resetToHome } = useChat();
  const [copied, setCopied] = useState(false);

  if (!session) return null;

  const handleCopy = async () => {
    await copyToClipboard(session.roomCode, "Room code copied to clipboard");
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-6 py-12 relative z-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg mx-auto"
      >
        {/* Back navigation */}
        <button
          onClick={resetToHome}
          className="mb-8 inline-flex items-center gap-2 text-xs font-mono tracking-wider uppercase text-zinc-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="p-8 sm:p-10 rounded-3xl bg-[#0e1015]/85 border border-white/[0.08] shadow-2xl backdrop-blur-2xl relative overflow-hidden">
          {/* Subtle atmospheric glow inside card */}
          <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-sky-500/[0.08] blur-[70px] pointer-events-none" />

          {/* Heading */}
          <div className="text-center mb-6">
            <span className="text-[11px] font-mono tracking-[0.25em] text-zinc-400 uppercase">
              Your Private Code
            </span>
          </div>

          {/* Code Container */}
          <div className="relative group my-4 p-8 rounded-2xl bg-white/[0.02] border border-white/[0.1] hover:border-white/[0.2] transition-all flex flex-col items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
            <div className="text-4xl sm:text-5xl font-mono font-semibold tracking-[0.25em] text-white select-all text-center">
              {session.roomCode}
            </div>

            {/* Micro copy button floating on the right */}
            <button
              onClick={handleCopy}
              className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-xs font-mono text-zinc-300 hover:text-white transition-all border border-white/10"
              title="Copy code"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied ✓</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          {/* 5-minute countdown teaser */}
          <div className="flex items-center justify-center gap-2 my-5 text-zinc-400">
            <Clock className="w-3.5 h-3.5 text-sky-400/80" />
            <span className="font-mono text-xs tracking-wider text-zinc-400">
              SESSION LIFESPAN:
            </span>
            <span className="font-mono text-xs font-semibold text-white">
              05:00
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 mt-6">
            <MagneticButton
              onClick={enterCreatedRoom}
              size="lg"
              variant="primary"
              className="w-full group"
            >
              <span>Enter Room</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </MagneticButton>
          </div>

          {/* Helper Note */}
          <div className="mt-6 flex items-start gap-2.5 text-center justify-center text-xs text-zinc-400 font-light leading-relaxed">
            <Share2 className="w-3.5 h-3.5 mt-0.5 text-zinc-500 shrink-0" />
            <span>Share this code with the person you want to chat with.</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

