"use client";

import React, { useState } from "react";
import { useChat } from "@/context/ChatContext";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { Copy, Check, ArrowRight, Clock, Share2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export function RoomCreatedView() {
  const {
    session,
    enterCreatedRoom,
    copyToClipboard,
    resetToHome,
    updateRoomLifespan,
  } = useChat();
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

          {/* Interactive Session Lifespan Timer Selector */}
          <div className="my-5 p-4 rounded-2xl bg-white/[0.025] border border-white/[0.08] backdrop-blur-md">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-zinc-400">
                <Clock className="w-3.5 h-3.5 text-sky-400/90" />
                <span className="font-mono text-xs tracking-wider text-zinc-400 uppercase">
                  SESSION LIFESPAN
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-white px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10 tracking-widest">
                {String(Math.floor((session.durationSeconds || 300) / 60)).padStart(2, "0")}:
                {String((session.durationSeconds || 300) % 60).padStart(2, "0")}
              </span>
            </div>

            {/* Preset Lifespan Pills */}
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
                const isSelected = (session.durationSeconds || 300) === item.sec;
                return (
                  <button
                    key={item.sec}
                    type="button"
                    onClick={() => updateRoomLifespan(item.sec)}
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

            <p className="mt-2 text-[10px] font-mono text-zinc-500 text-center">
              Tap any duration to adjust how long this room will remain active
            </p>
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

