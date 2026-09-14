"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, EyeOff } from "lucide-react";

interface PrivacyShieldProps {
  enabled?: boolean;
}

export function PrivacyShield({ enabled = true }: PrivacyShieldProps) {
  const [isMasked, setIsMasked] = useState(false);
  const [shieldReason, setShieldReason] = useState<string>("Session Shielded");

  useEffect(() => {
    if (!enabled) return;

    // Instant protection on visibility change (tab switch, minimize)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setShieldReason("Session Shielded — Tab Inactive");
        setIsMasked(true);
      }
    };

    // Instant protection on window blur (e.g. Snipping tool, macOS Cmd+Shift+4 overlay, app switch)
    const handleWindowBlur = () => {
      setShieldReason("Screenshot Protection Active — Focus Lost");
      setIsMasked(true);
    };

    const handleWindowFocus = () => {
      // Keep masked until explicit user tap or click to prevent snipping capture
    };

    // Keyboard shortcut interception for screenshot commands
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Windows PrintScreen
      if (e.key === "PrintScreen" || e.code === "PrintScreen") {
        e.preventDefault();
        setShieldReason("Screenshot Attempt Detected — Content Hidden");
        setIsMasked(true);
        // Overwrite clipboard if possible
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText("5MIN: Private temporary content protected against screenshots.").catch(() => {});
        }
        return;
      }

      // 2. Mac (Cmd + Shift + 3/4/5) and Windows (Win/Ctrl + Shift + S)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        setShieldReason("Screen Capture Shortcut Detected");
        setIsMasked(true);
      }

      // 3. Print dialog (Cmd+P, Ctrl+P)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setShieldReason("Printing Prohibited");
        setIsMasked(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen" || e.code === "PrintScreen") {
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText("").catch(() => {});
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
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
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-6 bg-[#040507]/98 backdrop-blur-3xl cursor-pointer select-none"
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
              {shieldReason}
            </h2>
            <p className="text-xs text-zinc-400 font-light leading-relaxed mb-6">
              Private room messages and media are shielded from external screen capture. Click anywhere or tap to return.
            </p>

            <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/[0.12] text-xs font-mono text-zinc-200 shadow-lg hover:bg-white/10 transition-colors">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Click to reveal conversation</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

