"use client";

import React, { useState } from "react";
import { useChat } from "@/context/ChatContext";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { ArrowLeft, Sparkles, ShieldAlert, Clock } from "lucide-react";
import { motion } from "framer-motion";

export function CreateRoomView() {
  const { initiateCreateRoom, resetToHome, roomLifespan, setRoomLifespan } = useChat();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await initiateCreateRoom(roomLifespan);
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

          {/* Ephemeral channel placeholder */}
          <div className="my-6 py-8 px-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/[0.08] flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-500 mb-2">
              <Sparkles className="w-4 h-4 animate-pulse text-zinc-400" />
            </div>
            <div className="font-mono text-2xl tracking-[0.3em] text-zinc-600 select-none">
              •••• - ••
            </div>
            <span className="text-[11px] font-mono text-zinc-500 mt-1">
              Ready to allocate ephemeral channel
            </span>
          </div>

          {/* Lifespan Selection */}
          <div className="mb-6 p-4 rounded-2xl bg-white/[0.025] border border-white/[0.08] backdrop-blur-md">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Clock className="w-3.5 h-3.5 text-sky-400/90" />
                <span className="font-mono text-xs tracking-wider text-zinc-400 uppercase">
                  Session Lifespan
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-white px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10 tracking-widest">
                {String(Math.floor(roomLifespan / 60)).padStart(2, "0")}:
                {String(roomLifespan % 60).padStart(2, "0")}
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {[
                { label: "1m", sec: 60 },
                { label: "3m", sec: 180 },
                { label: "5m", sec: 300 },
                { label: "10m", sec: 600 },
                { label: "15m", sec: 900 },
                { label: "30m", sec: 1800 },
                { label: "1h", sec: 3600 },
              ].map((item) => {
                const isSelected = roomLifespan === item.sec;
                return (
                  <button
                    key={item.sec}
                    type="button"
                    onClick={() => setRoomLifespan(item.sec)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-mono font-medium transition-all ${
                      isSelected
                        ? "bg-white text-zinc-950 font-semibold shadow-[0_0_12px_rgba(255,255,255,0.2)] scale-[1.03]"
                        : "bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.06]"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
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

