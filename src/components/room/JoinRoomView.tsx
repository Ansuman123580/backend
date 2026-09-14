"use client";

import React, { useState, useRef } from "react";
import { useChat } from "@/context/ChatContext";
import { formatRoomCodeInput, isValidRoomCodeFormat } from "@/lib/roomCode";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { ArrowRight, ArrowLeft, KeyRound, AlertCircle, User, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export function JoinRoomView() {
  const { joinRoom, resetToHome, userNickname, setUserNickname } = useChat();

  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState(userNickname && userNickname !== "Host" ? userNickname : "Guest");
  const [isShaking, setIsShaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
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
      setErrorMessage("This room code format is invalid.");
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    setIsJoining(true);
    setErrorMessage(null);
    try {
      const sanitizedName = nickname.trim() || "Guest";
      setUserNickname(sanitizedName);
      const success = await joinRoom(code, sanitizedName);
      if (!success) {
        setIsShaking(true);
        setErrorMessage("Room unavailable, expired, or maximum capacity reached.");
        setTimeout(() => setIsShaking(false), 500);
      }
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 sm:px-6 py-12 relative z-10">
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
          <div className="text-center mb-6">
            <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-400 mx-auto mb-3">
              <KeyRound className="w-4 h-4 text-sky-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mb-1.5">
              Join a private room
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 font-light">
              Enter your invite code and chosen temporary alias.
            </p>
          </div>

          {/* Join Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Display Name Input */}
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.07]">
              <label className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 uppercase tracking-wider mb-2">
                <User className="w-3.5 h-3.5 text-sky-400" />
                <span>Your Display Alias</span>
              </label>
              <input
                type="text"
                maxLength={30}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Ananya, Alex, Guest"
                className="w-full bg-[#13161f] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30 font-medium"
              />
            </div>

            {/* Room Code Input */}
            <div className={isShaking ? "animate-shake" : ""}>
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.07]">
                <label className="block text-xs font-mono text-zinc-400 uppercase tracking-wider mb-2">
                  Room Invite Code
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={code}
                  onChange={handleInputChange}
                  onPaste={handlePaste}
                  placeholder="•••• - ••"
                  maxLength={7}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="w-full bg-[#13161f] border border-white/10 rounded-xl px-4 py-3 text-2xl sm:text-3xl text-center font-mono font-bold tracking-[0.25em] text-white placeholder:text-zinc-700 focus:outline-none focus:border-white/30 transition-all uppercase"
                />
              </div>

              {/* Error message */}
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2.5 flex items-center justify-center gap-1.5 text-xs font-mono text-red-400"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMessage}</span>
                </motion.div>
              )}
            </div>

            {/* Submit Button */}
            <MagneticButton
              type="submit"
              disabled={isJoining || !code.trim()}
              size="lg"
              variant="primary"
              className="w-full mt-2"
            >
              {isJoining ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
                  Verifying Room Server...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>Enter Room</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </MagneticButton>

            {/* Security notice */}
            <div className="mt-2 text-center flex items-center justify-center gap-1.5 text-[11px] font-mono text-zinc-500">
              <ShieldCheck className="w-3 h-3 text-zinc-400" />
              <span>Zero client data logging • Fully ephemeral</span>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
