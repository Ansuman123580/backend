"use client";

import React, { useState } from "react";
import { useChat } from "@/context/ChatContext";
import { MagneticButton } from "@/components/ui/MagneticButton";
import {
  ArrowLeft,
  Sparkles,
  ShieldAlert,
  Clock,
  MessageSquare,
  Image as ImageIcon,
  Sliders,
  Users,
  Check,
  User,
} from "lucide-react";
import { motion } from "framer-motion";

const ROOM_LIFESPAN_OPTIONS = [
  { label: "30s", sec: 30 },
  { label: "1m", sec: 60 },
  { label: "5m", sec: 300 },
  { label: "10m", sec: 600 },
  { label: "30m", sec: 1800 },
  { label: "1h", sec: 3600 },
  { label: "6h", sec: 21600 },
  { label: "24h", sec: 86400 },
];

const TTL_OPTIONS = [
  { label: "Never", sec: 0 },
  { label: "10s", sec: 10 },
  { label: "30s", sec: 30 },
  { label: "1m", sec: 60 },
  { label: "5m", sec: 300 },
  { label: "10m", sec: 600 },
  { label: "30m", sec: 1800 },
  { label: "1h", sec: 3600 },
];

const CAPACITY_OPTIONS = [2, 3, 5, 10, 25];

export function CreateRoomView() {
  const { initiateCreateRoom, resetToHome, userNickname, setUserNickname } = useChat();

  const [hostName, setHostName] = useState(userNickname || "Host");
  const [roomLifespanSec, setRoomLifespanSec] = useState(300); // 5m default
  const [customLifespanMin, setCustomLifespanMin] = useState<string>("");
  const [isCustomLifespan, setIsCustomLifespan] = useState(false);

  const [messageTtlSec, setMessageTtlSec] = useState(300); // 5m default
  const [photoTtlSec, setPhotoTtlSec] = useState(300); // 5m default

  const [allowImages, setAllowImages] = useState(true);
  const [allowReactions, setAllowReactions] = useState(true);
  const [allowReplies, setAllowReplies] = useState(true);
  const [allowViewOnce, setAllowViewOnce] = useState(true);
  const [maxParticipants, setMaxParticipants] = useState(2);

  const [activeTab, setActiveTab] = useState<"lifespan" | "messages" | "permissions">("lifespan");
  const [isGenerating, setIsGenerating] = useState(false);

  const getEffectiveRoomLifespan = () => {
    if (isCustomLifespan && customLifespanMin) {
      const parsed = parseFloat(customLifespanMin);
      if (!isNaN(parsed) && parsed > 0) {
        return Math.min(86400, Math.max(10, Math.round(parsed * 60)));
      }
    }
    return roomLifespanSec;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const finalDuration = getEffectiveRoomLifespan();
      await initiateCreateRoom({
        nickname: hostName.trim() || "Host",
        durationSeconds: finalDuration,
        defaultMessageTtl: messageTtlSec > 0 ? messageTtlSec : null,
        defaultPhotoTtl: photoTtlSec > 0 ? photoTtlSec : null,
        allowImages,
        allowReactions,
        allowReplies,
        allowViewOnce,
        maxParticipants,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDurationDisplay = (seconds: number) => {
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    if (seconds >= 60) {
      return `${Math.floor(seconds / 60)}m ${seconds % 60 ? `${seconds % 60}s` : ""}`.trim();
    }
    return `${seconds}s`;
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 sm:px-6 py-10 relative z-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl mx-auto"
      >
        {/* Back navigation */}
        <button
          onClick={resetToHome}
          className="mb-6 inline-flex items-center gap-2 text-xs font-mono tracking-wider uppercase text-zinc-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="p-6 sm:p-8 rounded-3xl bg-[#0e1015]/90 border border-white/[0.08] shadow-2xl backdrop-blur-2xl relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute -top-24 -left-24 w-60 h-60 rounded-full bg-sky-500/[0.06] blur-[70px] pointer-events-none" />

          {/* Heading */}
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-[10px] font-mono tracking-widest text-zinc-400 uppercase mb-3">
              <ShieldAlert className="w-3 h-3 text-sky-400" />
              Private Temporary Room
            </span>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mb-1.5">
              Create a private room
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 font-light">
              Configure ephemeral parameters before generating your invite.
            </p>
          </div>

          {/* Host Nickname Input */}
          <div className="mb-5 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.07]">
            <label className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 uppercase tracking-wider mb-2">
              <User className="w-3.5 h-3.5 text-sky-400" />
              <span>Your Display Name</span>
            </label>
            <input
              type="text"
              maxLength={30}
              value={hostName}
              onChange={(e) => {
                setHostName(e.target.value);
                setUserNickname(e.target.value);
              }}
              placeholder="e.g. Host, Ananya, Alex"
              className="w-full bg-[#13161f] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30 font-medium"
            />
          </div>

          {/* Navigation Tabs for Configuration */}
          <div className="flex rounded-2xl bg-white/[0.03] p-1 border border-white/[0.06] mb-5 text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveTab("lifespan")}
              className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "lifespan"
                  ? "bg-white text-zinc-950 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Room Timer</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("messages")}
              className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "messages"
                  ? "bg-white text-zinc-950 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Media TTL</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("permissions")}
              className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "permissions"
                  ? "bg-white text-zinc-950 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Privacy & Limits</span>
            </button>
          </div>

          {/* TAB 1: Room Lifespan */}
          {activeTab === "lifespan" && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 mb-6"
            >
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.07]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                    Auto-Destruct Countdown
                  </span>
                  <span className="font-mono text-xs font-bold text-white px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10 tracking-widest">
                    {formatDurationDisplay(getEffectiveRoomLifespan())}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {ROOM_LIFESPAN_OPTIONS.map((opt) => {
                    const isSelected = !isCustomLifespan && roomLifespanSec === opt.sec;
                    return (
                      <button
                        key={opt.sec}
                        type="button"
                        onClick={() => {
                          setIsCustomLifespan(false);
                          setRoomLifespanSec(opt.sec);
                        }}
                        className={`py-2 px-2 rounded-xl text-xs font-mono font-medium transition-all ${
                          isSelected
                            ? "bg-white text-zinc-950 font-semibold shadow-md scale-[1.02]"
                            : "bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.05]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {/* Custom duration toggle */}
                <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setIsCustomLifespan(!isCustomLifespan)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono border transition-all ${
                      isCustomLifespan
                        ? "bg-white/10 text-white border-white/20 font-semibold"
                        : "text-zinc-500 hover:text-zinc-300 border-transparent"
                    }`}
                  >
                    Custom Minutes:
                  </button>

                  {isCustomLifespan && (
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      value={customLifespanMin}
                      onChange={(e) => setCustomLifespanMin(e.target.value)}
                      placeholder="e.g. 45"
                      className="w-28 bg-[#13161f] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30 font-mono"
                    />
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: Media & Message TTL */}
          {activeTab === "messages" && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 mb-6"
            >
              {/* Message TTL */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.07]">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                    Default Message Expiration
                  </span>
                  <span className="text-xs font-mono text-sky-400 font-semibold">
                    {messageTtlSec === 0 ? "Never (Until Room Dies)" : formatDurationDisplay(messageTtlSec)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {TTL_OPTIONS.map((opt) => (
                    <button
                      key={`msg-${opt.sec}`}
                      type="button"
                      onClick={() => setMessageTtlSec(opt.sec)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-mono transition-all ${
                        messageTtlSec === opt.sec
                          ? "bg-white text-zinc-950 font-semibold shadow-sm"
                          : "bg-white/[0.03] text-zinc-400 hover:text-white border border-white/[0.05]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Photo TTL */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.07]">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                    Default Photo Expiration
                  </span>
                  <span className="text-xs font-mono text-amber-400 font-semibold">
                    {photoTtlSec === 0 ? "Never (Until Room Dies)" : formatDurationDisplay(photoTtlSec)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {TTL_OPTIONS.map((opt) => (
                    <button
                      key={`photo-${opt.sec}`}
                      type="button"
                      onClick={() => setPhotoTtlSec(opt.sec)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-mono transition-all ${
                        photoTtlSec === opt.sec
                          ? "bg-white text-zinc-950 font-semibold shadow-sm"
                          : "bg-white/[0.03] text-zinc-400 hover:text-white border border-white/[0.05]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: Permissions & Capacity */}
          {activeTab === "permissions" && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 mb-6"
            >
              {/* Max Capacity */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.07]">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-sky-400" />
                    <span>Maximum Participants</span>
                  </span>
                  <span className="text-xs font-mono text-white font-bold">
                    {maxParticipants} {maxParticipants === 2 ? "(1-on-1)" : "Max"}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {CAPACITY_OPTIONS.map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setMaxParticipants(cap)}
                      className={`py-2 px-2 rounded-xl text-xs font-mono transition-all ${
                        maxParticipants === cap
                          ? "bg-white text-zinc-950 font-semibold shadow-sm"
                          : "bg-white/[0.03] text-zinc-400 hover:text-white border border-white/[0.05]"
                      }`}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.07] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-white block">Allow Photo Uploads</span>
                    <span className="text-[10px] font-mono text-zinc-500">Participants can attach encrypted images</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowImages}
                    onChange={(e) => setAllowImages(e.target.checked)}
                    className="w-4 h-4 rounded accent-sky-400 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                  <div>
                    <span className="text-xs font-medium text-white block">Allow Reactions</span>
                    <span className="text-[10px] font-mono text-zinc-500">Enable emojis (❤️, 😂, 👍, 🔥, 😮, 😢)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowReactions}
                    onChange={(e) => setAllowReactions(e.target.checked)}
                    className="w-4 h-4 rounded accent-sky-400 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                  <div>
                    <span className="text-xs font-medium text-white block">Allow Quoted Replies</span>
                    <span className="text-[10px] font-mono text-zinc-500">Direct message context referencing</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowReplies}
                    onChange={(e) => setAllowReplies(e.target.checked)}
                    className="w-4 h-4 rounded accent-sky-400 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                  <div>
                    <span className="text-xs font-medium text-white block">Allow View-Once Photos</span>
                    <span className="text-[10px] font-mono text-zinc-500">Ephemeral media that burns upon closing</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowViewOnce}
                    onChange={(e) => setAllowViewOnce(e.target.checked)}
                    className="w-4 h-4 rounded accent-sky-400 cursor-pointer"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Trigger Button */}
          <div className="flex flex-col gap-3">
            <MagneticButton
              onClick={handleGenerate}
              disabled={isGenerating}
              size="lg"
              variant="primary"
              className="w-full"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
                  Allocating Private Room...
                </span>
              ) : (
                "Generate Private Room"
              )}
            </MagneticButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
