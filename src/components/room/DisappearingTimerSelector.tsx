"use client";

import React, { useState, useRef, useEffect } from "react";
import { Clock, Check, ChevronDown, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface DisappearingTimerOption {
  label: string;
  seconds: number;
}

const PRESET_OPTIONS: DisappearingTimerOption[] = [
  { label: "10s", seconds: 10 },
  { label: "30s", seconds: 30 },
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
  { label: "10m", seconds: 600 },
  { label: "30m", seconds: 1800 },
  { label: "1h", seconds: 3600 },
];

interface DisappearingTimerSelectorProps {
  selectedSeconds: number;
  onSelect: (seconds: number) => void;
}

export function DisappearingTimerSelector({
  selectedSeconds,
  onSelect,
}: DisappearingTimerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [customUnit, setCustomUnit] = useState<"seconds" | "minutes">("minutes");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowCustomInput(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentLabel = () => {
    const found = PRESET_OPTIONS.find((opt) => opt.seconds === selectedSeconds);
    if (found) return found.label;
    if (selectedSeconds < 60) return `${selectedSeconds}s`;
    if (selectedSeconds < 3600) return `${Math.round(selectedSeconds / 60)}m`;
    return `${(selectedSeconds / 3600).toFixed(1)}h`;
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customValue, 10);
    if (!isNaN(val) && val > 0) {
      const calculatedSeconds = customUnit === "minutes" ? val * 60 : val;
      onSelect(calculatedSeconds);
      setIsOpen(false);
      setShowCustomInput(false);
      setCustomValue("");
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block select-none">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Configurable message self-destruct timer"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-white/20 text-[11px] font-mono text-zinc-300 hover:text-white transition-all"
      >
        <Clock className="w-3 h-3 text-sky-400/90" />
        <span>{currentLabel()}</span>
        <ChevronDown className="w-2.5 h-2.5 opacity-60" />
      </button>

      {/* Popover Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-11 right-0 sm:left-0 sm:right-auto z-50 w-52 p-2 rounded-2xl bg-[#141720]/95 border border-white/10 shadow-2xl backdrop-blur-2xl"
          >
            <div className="px-2 py-1 mb-1 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                Self-Destruct
              </span>
              <Sparkles className="w-2.5 h-2.5 text-zinc-400" />
            </div>

            {!showCustomInput ? (
              <div className="space-y-0.5">
                {PRESET_OPTIONS.map((opt) => {
                  const isSelected = opt.seconds === selectedSeconds;
                  return (
                    <button
                      key={opt.seconds}
                      type="button"
                      onClick={() => {
                        onSelect(opt.seconds);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                        isSelected
                          ? "bg-white/[0.08] text-white font-medium"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check className="w-3 h-3 text-sky-400" />}
                    </button>
                  );
                })}

                <div className="pt-1 mt-1 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setShowCustomInput(true)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono text-zinc-400 hover:text-white hover:bg-white/[0.03] transition-colors"
                  >
                    Custom duration…
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleApplyCustom} className="p-1 space-y-2">
                <span className="block text-[10px] font-mono text-zinc-400">
                  Enter duration:
                </span>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="86400"
                    autoFocus
                    placeholder="Value"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    className="w-full px-2 py-1 text-xs font-mono rounded-lg bg-white/[0.04] border border-white/10 text-white focus:outline-none focus:border-white/30"
                  />
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as any)}
                    className="px-1.5 py-1 text-[11px] font-mono rounded-lg bg-[#1a1e28] border border-white/10 text-zinc-300 focus:outline-none"
                  >
                    <option value="seconds">Sec</option>
                    <option value="minutes">Min</option>
                  </select>
                </div>
                <div className="flex gap-1.5 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-1 text-[11px] font-mono font-medium rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 transition-colors"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomInput(false)}
                    className="px-2 py-1 text-[11px] font-mono rounded-lg bg-white/[0.04] text-zinc-400 hover:text-white"
                  >
                    Back
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
