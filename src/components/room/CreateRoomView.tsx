"use client";

import React, { useState } from "react";
import { useChat } from "@/context/ChatContext";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { ArrowLeft, Sparkles, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

export function CreateRoomView() {
  const { initiateCreateRoom, resetToHome } = useChat();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await initiateCreateRoom();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-6 py-12 relative z-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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

        <div className="p-8 sm:p-10 rounded-3xl bg-[#0e1015]/80 border border-white/[0.08] shadow-2xl backdrop-blur-xl relative overflow-hidden">
          {/* Subtle atmospheric glow inside card */}
          <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-sky-500/[0.06] blur-[60px] pointer-events-none" />

          {/* Heading */}
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-[10px] font-mono tracking-widest text-zinc-400 uppercase mb-4">
              <ShieldAlert className="w-3 h-3 text-sky-400" />
              Temporary Session
            </span>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-3">
              Create a private room.
            </h1>
            <p className="text-sm text-zinc-400 font-light">
              Your room will be temporary.
            </p>
          </div>

          {/* Minimal animated placeholder state */}
          <div className="my-8 py-10 px-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/[0.08] flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-500 mb-3">
              <Sparkles className="w-5 h-5 animate-pulse text-zinc-400" />
            </div>
            <div className="font-mono text-2xl tracking-[0.3em] text-zinc-600 select-none">
              •••• - ••
            </div>
            <span className="text-[11px] font-mono text-zinc-500 mt-2">
              Ready to allocate ephemeral channel
            </span>
          </div>

          {/* Trigger Button */}
          <div className="flex flex-col gap-3">
            <MagneticButton
              onClick={handleGenerate}
              disabled={isGenerating}
              size="lg"
              variant="primary"
              className="w-full"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
                  Generating...
                </span>
              ) : (
                "Generate Room Code"
              )}
            </MagneticButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

