"use client";

import React, { useState } from "react";
import { useChat } from "@/context/ChatContext";
import { MagneticButton } from "@/components/ui/MagneticButton";
import {
  Copy,
  Check,
  ArrowRight,
  Clock,
  Share2,
  ArrowLeft,
  Shield,
  Users,
  MessageSquare,
  Image as ImageIcon,
  Flame,
} from "lucide-react";
import { motion } from "framer-motion";

export function RoomCreatedView() {
  const {
    session,
    enterCreatedRoom,
    copyToClipboard,
    copyInviteLink,
    resetToHome,
    updateRoomLifespan,
    triggerToast,
  } = useChat();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!session) return null;

  const handleCopyCode = async () => {
    await copyToClipboard(session.roomCode, "Room code copied to clipboard");
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleShareInvite = async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteUrl = `${origin}/?join=${session.roomCode}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "5MIN Private Room Invite",
          text: `Join my private room on 5MIN. Ephemeral content auto-dissolves.`,
          url: inviteUrl,
        });
        return;
      } catch (err) {
        // Fallback to clipboard if user dismissed or cancelled share dialog
      }
    }

    await copyInviteLink();
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const formatDurationDisplay = (seconds: number) => {
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    if (seconds >= 60) {
      return `${Math.floor(seconds / 60)}m`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 sm:px-6 py-12 relative z-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg mx-auto"
      >
        {/* Back navigation */}
        <button
          onClick={resetToHome}
          className="mb-6 inline-flex items-center gap-2 text-xs font-mono tracking-wider uppercase text-zinc-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="p-6 sm:p-9 rounded-3xl bg-[#0e1015]/85 border border-white/[0.08] shadow-2xl backdrop-blur-2xl relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-sky-500/[0.08] blur-[70px] pointer-events-none" />

          {/* Heading */}
          <div className="text-center mb-5">
            <span className="text-[11px] font-mono tracking-[0.25em] text-zinc-400 uppercase">
              Your Private Room Code
            </span>
          </div>

          {/* Code Container */}
          <div className="relative group my-3 p-6 sm:p-8 rounded-2xl bg-white/[0.02] border border-white/[0.1] hover:border-white/[0.2] transition-all flex flex-col items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
            <div className="text-4xl sm:text-5xl font-mono font-semibold tracking-[0.25em] text-white select-all text-center">
              {session.roomCode}
            </div>

            {/* Actions: Copy Code and Share Invite */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-xs font-mono text-zinc-300 hover:text-white transition-all border border-white/10"
                title="Copy code"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Code Copied ✓</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>

              <button
                onClick={handleShareInvite}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 hover:bg-sky-500/20 text-xs font-mono text-sky-300 hover:text-sky-200 transition-all border border-sky-400/20"
                title="Share direct invite link"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Invite Link Copied ✓</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share Invite Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Configured Room Summary */}
          <div className="my-5 p-4 rounded-2xl bg-white/[0.025] border border-white/[0.08] text-xs font-mono">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/[0.06] text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>Room Lifespan:</span>
              </span>
              <span className="font-bold text-white tracking-wider">
                {formatDurationDisplay(session.durationSeconds || 300)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400 pt-1">
              <div className="flex items-center gap-1.5">
                <Users className="w-3 h-3 text-zinc-500" />
                <span>Capacity: {session.maxParticipants || 2} max</span>
              </div>

              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3 text-zinc-500" />
                <span>Msg TTL: {session.defaultMessageTtl ? formatDurationDisplay(session.defaultMessageTtl) : "Never"}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <ImageIcon className="w-3 h-3 text-zinc-500" />
                <span>Photos: {session.allowImages !== false ? "Allowed" : "Blocked"}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Flame className="w-3 h-3 text-amber-500/80" />
                <span>View-Once: {session.allowViewOnce !== false ? "Enabled" : "Disabled"}</span>
              </div>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="flex flex-col gap-3">
            <MagneticButton
              onClick={enterCreatedRoom}
              size="lg"
              variant="primary"
              className="w-full"
            >
              <span className="flex items-center gap-2">
                <span>Enter Private Room</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            </MagneticButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
