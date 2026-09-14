"use client";

import React, { useState, useEffect } from "react";
import { Eye, Flame, Lock, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

interface ViewOncePhotoBubbleProps {
  messageId: string;
  isSelf: boolean;
  senderName: string;
  imageUrl?: string | null;
  viewedAt?: number | null;
  onOpen: () => void;
}

export function ViewOncePhotoBubble({
  messageId,
  isSelf,
  senderName,
  imageUrl,
  viewedAt,
  onOpen,
}: ViewOncePhotoBubbleProps) {
  const isBurned = Boolean(viewedAt) || !imageUrl;

  if (isBurned) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.07] text-zinc-400 select-none">
        <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-500">
          <Flame className="w-4 h-4 text-amber-500/80" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-xs font-medium text-zinc-300">
            View Once Photo
          </span>
          <span className="text-[10px] font-mono text-zinc-500">
            {isSelf ? "Opened by recipient" : "Opened • Permanently Disappeared"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onOpen}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all select-none ${
        isSelf
          ? "bg-zinc-800/90 text-white border border-white/10 hover:border-white/20"
          : "bg-gradient-to-r from-sky-950/40 to-indigo-950/40 border border-sky-500/30 text-white hover:border-sky-500/50 shadow-[0_0_20px_-5px_rgba(56,189,248,0.15)]"
      }`}
    >
      <div className="relative">
        <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400">
          <Eye className="w-4 h-4" />
        </div>
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-sky-400 text-zinc-950 font-mono font-bold text-[9px] flex items-center justify-center shadow-md">
          1
        </span>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold tracking-wide text-white">
            View Once Photo
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-300 uppercase tracking-wider">
            Protected
          </span>
        </div>
        <span className="text-[10px] font-mono text-zinc-400 mt-0.5">
          {isSelf ? "1-time view sent • Tap to inspect" : "Tap to view • Destructs after viewing"}
        </span>
      </div>
    </motion.button>
  );
}

