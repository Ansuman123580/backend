"use client";

import React, { useState, useRef } from "react";
import { useChat } from "@/context/ChatContext";
import { formatRoomCodeInput, isValidRoomCodeFormat } from "@/lib/roomCode";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { ArrowRight, ArrowLeft, KeyRound, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export function JoinRoomView() {
  const { joinRoom, resetToHome } = useChat();
  const [code, setCode] = useState("");
  const [isShaking, setIsShaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const formatted = formatRoomCodeInput(e.target.value);
    setCode(formatted);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    const formatted = formatRoomCodeInput(pasted);
    setCode(formatted);
    setErrorMessage(null);
  };

  const [isJoining, setIsJoining] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setIsShaking(true);
      setErrorMessage("Please enter a room code.");
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    if (!isValidRoomCodeFormat(code)) {
      setIsShaking(true);
      setErrorMessage("This room could not be found.");
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    setIsJoining(true);
    try {
      const success = await joinRoom(code);
      if (!success) {
        setIsShaking(true);
        setErrorMessage("This room could not be found or is unavailable.");
        setTimeout(() => setIsShaking(false), 500);
      }
    } finally {
      setIsJoining(false);
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

        <div className="p-8 sm:p-10 rounded-3xl bg-[#0e1015]/85 border border-white/[0.08] shadow-2xl backdrop-blur-2xl relative overflow-hidden">
          {/* Subtle atmospheric glow */}
          <div className="absolute -top-24 -left-24 w-56 h-56 rounded-full bg-sky-500/[0.06] blur-[70px] pointer-events-none" />

          {/* Heading */}
          <div className="text-center mb-8">
            <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-400 mx-auto mb-4">
              <KeyRound className="w-4 h-4" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-2">
              Join a private room.
            </h1>
            <p className="text-sm text-zinc-400 font-light">
              Enter the code you received.
            </p>
          </div>

          {/* Join Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className={isShaking ? "animate-shake" : ""}>
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={code}
                  onChange={handleInputChange}
                  onPaste={handlePaste}
                  placeholder="XXXX-XX"
                  maxLength={7}
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full text-center font-mono text-3xl sm:text-4xl tracking-[0.25em] uppercase py-5 px-4 rounded-2xl bg-white/[0.02] border border-white/[0.1] focus:border-white/30 focus:bg-white/[0.04] text-white placeholder:text-zinc-600 focus:outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
                />
              </div>

              {/* Error Message */}
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 flex items-center justify-center gap-2 text-xs text-red-400 font-mono tracking-wide"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{errorMessage}</span>
                </motion.div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <MagneticButton
                type="submit"
                disabled={isJoining}
                size="lg"
                variant="primary"
                className="w-full group"
              >
                {isJoining ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
                    Joining...
                  </span>
                ) : (
                  <>
                    <span>Join Room</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </>
                )}
              </MagneticButton>
            </div>
          </form>

          <p className="text-center text-[11px] font-mono text-zinc-400 mt-6">
            Room codes are formatted as 4 letters followed by 2 digits.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

