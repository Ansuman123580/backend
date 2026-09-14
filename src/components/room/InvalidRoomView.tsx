"use client";

import React from "react";
import { useChat } from "@/context/ChatContext";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { ShieldX, ArrowLeft, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

export function InvalidRoomView() {
  const { goToScreen, resetToHome } = useChat();

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-6 py-12 relative z-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg mx-auto"
      >
        <div className="p-8 sm:p-10 rounded-3xl bg-[#0e1015]/85 border border-white/[0.08] shadow-2xl backdrop-blur-2xl relative overflow-hidden text-center">
          {/* Subtle red/ambient halo */}
          <div className="absolute -top-20 -left-20 w-48 h-48 rounded-full bg-red-500/[0.06] blur-[60px] pointer-events-none" />

          {/* Icon */}
          <div className="w-12 h-12 rounded-2xl bg-red-500/[0.08] border border-red-500/20 flex items-center justify-center text-red-400 mx-auto mb-6">
            <ShieldX className="w-6 h-6 stroke-[1.8]" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-3">
            Room unavailable.
          </h1>
          <p className="text-sm text-zinc-400 font-light leading-relaxed max-w-sm mx-auto mb-8">
            This private room doesn’t exist or is no longer available.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <MagneticButton
              onClick={() => goToScreen("join")}
              size="lg"
              variant="primary"
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Another Code</span>
            </MagneticButton>

            <MagneticButton
              onClick={resetToHome}
              size="lg"
              variant="secondary"
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back Home</span>
            </MagneticButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

