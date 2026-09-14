"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, EyeOff } from "lucide-react";

interface PrivacyShieldProps {
  enabled?: boolean;
}

export function PrivacyShield({ enabled = true }: PrivacyShieldProps) {
  const [isMasked, setIsMasked] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsMasked(true);
      }
    };

    const handleWindowBlur = () => {
      // Short delay to avoid accidental flicker on dialogs
      setTimeout(() => {
        if (!document.hasFocus()) {
          setIsMasked(true);
        }
      }, 150);
    };

    const handleWindowFocus = () => {
      setIsMasked(false);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [enabled]);

  return (
    <AnimatePresence>
      {isMasked && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setIsMasked(false)}
          className="fixed inset-0 z-40 flex flex-col items-center justify-center p-6 bg-[#060709]/95 backdrop-blur-3xl cursor-pointer select-none"
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            className="flex flex-col items-center text-center max-w-sm"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-400 mb-6 shadow-2xl">
              <EyeOff className="w-6 h-6 stroke-[1.8] text-sky-400/90" />
            </div>

            <span className="text-[11px] font-mono tracking-[0.25em] text-zinc-500 uppercase mb-2">
              Privacy Guard Active
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-white mb-2">
              Session Shielded
            </h2>
            <p className="text-xs text-zinc-400 font-light leading-relaxed mb-6">
              Private room content is automatically masked while the tab is out of focus. Click anywhere to resume.
            </p>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono text-zinc-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tap to reveal session</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
