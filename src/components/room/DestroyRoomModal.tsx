"use client";

import React, { useState } from "react";
import { AlertTriangle, Trash2, X, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DestroyRoomModalProps {
  isOpen: boolean;
  roomCode: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function DestroyRoomModal({
  isOpen,
  roomCode,
  onConfirm,
  onClose,
}: DestroyRoomModalProps) {
  const [isDestroying, setIsDestroying] = useState(false);
  const [progress, setProgress] = useState(0);

  if (!isOpen) return null;

  const handleDestroy = async () => {
    setIsDestroying(true);
    // Animate destruction progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + 15;
      });
    }, 60);

    try {
      await onConfirm();
      setProgress(100);
    } finally {
      clearInterval(interval);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 10 }}
          className="relative w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[#0e1015] border border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.15)] overflow-hidden text-center"
        >
          {/* Close button */}
          {!isDestroying && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Warning Icon */}
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400 mb-5 shadow-lg">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <span className="text-[11px] font-mono tracking-[0.25em] text-red-400 uppercase font-semibold block mb-1">
            Permanent Erasure
          </span>

          <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight mb-3">
            Destroy Room {roomCode}?
          </h2>

          <p className="text-xs text-zinc-400 font-light leading-relaxed mb-6">
            This will immediately disconnect all participants, permanently purge all messages, delete uploaded photos from storage, and close room <strong className="text-white font-mono">{roomCode}</strong>. This cannot be undone.
          </p>

          {isDestroying ? (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between text-xs font-mono text-red-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  PURGING CONVERSATION...
                </span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-medium text-zinc-300 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDestroy}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all flex items-center justify-center gap-2 active:scale-98"
              >
                <Trash2 className="w-4 h-4" />
                <span>Destroy Room</span>
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
