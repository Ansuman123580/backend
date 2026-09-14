"use client";

import React from "react";
import { useChat } from "@/context/ChatContext";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Info, AlertTriangle } from "lucide-react";

export function ToastContainer() {
  const { toasts, removeToast } = useChat();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => removeToast(toast.id)}
            className="pointer-events-auto cursor-pointer flex items-center gap-3 px-4 py-3 rounded-xl bg-[#13161c]/90 border border-white/10 text-white shadow-2xl backdrop-blur-md"
          >
            {toast.type === "success" && (
              <span className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </span>
            )}
            {toast.type === "warning" && (
              <span className="w-5 h-5 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
              </span>
            )}
            {(!toast.type || toast.type === "info") && (
              <span className="w-5 h-5 rounded-full bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Info className="w-3 h-3 stroke-[2.5]" />
              </span>
            )}
            <span className="text-sm font-medium text-zinc-200 tracking-wide">
              {toast.text}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

