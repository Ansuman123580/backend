"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ZoomIn,
  ZoomOut,
  ShieldAlert,
  Lock,
  Flame,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface LightboxModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  senderName?: string;
  timestamp?: number;
  isViewOnce?: boolean;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
}

export function LightboxModal({
  isOpen,
  imageUrl,
  senderName = "Guest",
  timestamp,
  isViewOnce = false,
  hasPrev = false,
  hasNext = false,
  onPrev,
  onNext,
  onClose,
}: LightboxModalProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [burnSecondsRemaining, setBurnSecondsRemaining] = useState(10);

  // Keyboard controls: Escape, ArrowLeft, ArrowRight
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && hasPrev && onPrev) {
        onPrev();
      } else if (e.key === "ArrowRight" && hasNext && onNext) {
        onNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, hasPrev, hasNext, onPrev, onNext, onClose]);

  // Reset zoom and start 10s countdown if view-once
  useEffect(() => {
    if (isOpen) {
      setIsZoomed(false);
      setBurnSecondsRemaining(10);

      if (isViewOnce) {
        const interval = setInterval(() => {
          setBurnSecondsRemaining((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              onClose();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        return () => clearInterval(interval);
      }
    }
  }, [isOpen, isViewOnce, onClose]);

  if (!isOpen || !imageUrl) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
        onContextMenu={(e) => e.preventDefault()}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/94 backdrop-blur-2xl select-none"
      >
        {/* Top bar controls */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-5 left-6 right-6 flex items-center justify-between z-20 pointer-events-auto"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-zinc-300">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-medium text-white tracking-tight">
                {senderName}
              </span>
              {timestamp && (
                <span className="block text-[10px] font-mono text-zinc-400">
                  {new Date(timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </div>

          {/* View-once timer pill in top center if active */}
          {isViewOnce && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono text-xs font-semibold shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>BURNING IN {burnSecondsRemaining}s</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsZoomed(!isZoomed)}
              className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-zinc-300 hover:text-white transition-all"
              title={isZoomed ? "Zoom out" : "Zoom in"}
            >
              {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-zinc-300 hover:text-white transition-all"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Previous Image button */}
        {hasPrev && onPrev && !isViewOnce && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            className="absolute left-6 top-1/2 -translate-y-1/2 z-30 p-3 rounded-2xl bg-black/60 hover:bg-black/90 border border-white/15 text-white backdrop-blur-md transition-all hover:scale-110"
            title="Previous image"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Next Image button */}
        {hasNext && onNext && !isViewOnce && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute right-6 top-1/2 -translate-y-1/2 z-30 p-3 rounded-2xl bg-black/60 hover:bg-black/90 border border-white/15 text-white backdrop-blur-md transition-all hover:scale-110"
            title="Next image"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Center Image Container */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: isZoomed ? 1.4 : 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: "spring", stiffness: 360, damping: 28 }}
          onClick={(e) => {
            e.stopPropagation();
            setIsZoomed(!isZoomed);
          }}
          className="relative max-w-full max-h-[85vh] cursor-zoom-in overflow-hidden rounded-2xl shadow-2xl border border-white/10"
        >
          {/* Transparent interaction shield to prevent image dragging / saving */}
          <div
            className="absolute inset-0 z-10 select-none pointer-events-none"
            onContextMenu={(e) => e.preventDefault()}
          />

          <img
            src={imageUrl}
            alt="Private room attachment"
            draggable={false}
            className="max-h-[80vh] max-w-[90vw] object-contain rounded-2xl select-none pointer-events-none"
          />
        </motion.div>

        {/* Privacy deterrence notice pill */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] font-mono text-zinc-400 tracking-wider">
          <ShieldAlert className="w-3 h-3 text-sky-400/80" />
          <span>
            {isViewOnce
              ? "VIEW ONCE • WILL DISAPPEAR UPON EXIT"
              : "EPHEMERAL MEDIA • PROTECTED CONTENT"}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
