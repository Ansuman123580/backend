"use client";

import React, { useState, useRef, useEffect } from "react";
import { useChat } from "@/context/ChatContext";
import { formatTimeRemaining } from "@/lib/roomCode";
import {
  Lock,
  Users,
  Copy,
  LogOut,
  Send,
  Smile,
  Paperclip,
  Check,
  CheckCheck,
  CornerDownRight,
  X,
  Sparkles,
  Shield,
  Volume2,
  VolumeX,
  Clock,
  RotateCw,
  Image as ImageIcon,
  AlertTriangle,
  Eye,
  EyeOff,
  ShieldAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LightboxModal } from "@/components/ui/LightboxModal";
import { PrivacyShield } from "@/components/ui/PrivacyShield";
import { AntiScreenshotWatermark } from "@/components/ui/AntiScreenshotWatermark";
import { DisappearingTimerSelector } from "@/components/room/DisappearingTimerSelector";

const EMOJI_OPTIONS = ["👍", "🔥", "🤫", "✨", "⏳"];

export function ChatRoomView() {
  const {
    session,
    timeRemaining,
    messages,
    isTyping,
    sendMessage,
    retrySendMessage,
    addReaction,
    copyToClipboard,
    leaveRoom,
    isExpiringSoon,
    isCriticalExpiring,
    soundEnabled,
    toggleSound,
    broadcastTyping,
    selectedTtl,
    setSelectedTtl,
    triggerToast,
  } = useChat();

  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const [inputVal, setInputVal] = useState("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [activeLightboxImage, setActiveLightboxImage] = useState<{
    url: string;
    senderName: string;
    timestamp: number;
  } | null>(null);

  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    senderName: string;
    content: string;
  } | null>(null);

  const [activeReactionMenu, setActiveReactionMenu] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [holdToRevealImageId, setHoldToRevealImageId] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [stealthProtectionEnabled, setStealthProtectionEnabled] = useState(true);
  const [antiScreenshotActive, setAntiScreenshotActive] = useState(true);

  // Release held reveal on any blur or mouseup anywhere
  useEffect(() => {
    const handleResetHold = () => {
      setHoldToRevealImageId(null);
      setHoveredMessageId(null);
    };
    window.addEventListener("blur", handleResetHold);
    window.addEventListener("mouseup", handleResetHold);
    window.addEventListener("touchend", handleResetHold);
    return () => {
      window.removeEventListener("blur", handleResetHold);
      window.removeEventListener("mouseup", handleResetHold);
      window.removeEventListener("touchend", handleResetHold);
    };
  }, []);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, imagePreviewUrl]);

  // Handle auto-expanding textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputVal(val);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        140
      )}px`;
    }

    if (val.trim()) {
      broadcastTyping(true);
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = setTimeout(() => {
        broadcastTyping(false);
      }, 1500);
    } else {
      broadcastTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        triggerToast("Please select an image (JPG, PNG, WEBP).", "warning");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        triggerToast("Image file size exceeds 10MB.", "warning");
        return;
      }
      setSelectedImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      triggerToast("Photo ready to send", "info");
    }
  };

  const handleRemoveSelectedImage = () => {
    setSelectedImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSend = () => {
    if (!inputVal.trim() && !selectedImageFile) return;

    broadcastTyping(false);
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);

    sendMessage(
      inputVal,
      replyingTo || undefined,
      selectedImageFile || undefined
    );

    setInputVal("");
    handleRemoveSelectedImage();
    setReplyingTo(null);
    setShowEmojiPicker(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleCopyCode = async () => {
    if (!session) return;
    await copyToClipboard(session.roomCode, "Room code copied to clipboard");
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const addEmojiToInput = (emoji: string) => {
    setInputVal((prev) => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const getMessageTimeRemaining = (expiresAt?: number) => {
    if (!expiresAt) return null;
    const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    if (diff < 60) return `${diff}s`;
    return `${Math.ceil(diff / 60)}m`;
  };

  // Timer Progress Math: 300 seconds total
  const totalSeconds = 300;
  const progressRatio = Math.max(0, timeRemaining / totalSeconds);
  const strokeDashoffset = 100 - progressRatio * 100;

  return (
    <div
      className={`min-h-screen flex flex-col justify-between transition-colors duration-1000 select-none ${
        isCriticalExpiring
          ? "bg-[#040506]"
          : isExpiringSoon
          ? "bg-[#07080a]"
          : "bg-background"
      }`}
    >
      {/* Privacy Shield on tab blur / background */}
      <PrivacyShield />

      {/* Forensic Anti-Screenshot Watermark */}
      <AntiScreenshotWatermark
        roomCode={session?.roomCode || "5MIN"}
        nickname={session?.participants?.find((p) => p.isSelf)?.name || "GUEST"}
      />

      {/* Print protection shield banner */}
      <div className="print-shield-notice">
        🔒 5MIN: Private temporary conversation. Printing content is prohibited.
      </div>

      {/* Expiring atmospheric tension vignette */}
      <div
        className={`pointer-events-none fixed inset-0 z-30 transition-opacity duration-1000 ${
          isCriticalExpiring
            ? "opacity-100 shadow-[inset_0_0_120px_rgba(239,68,68,0.08)]"
            : isExpiringSoon
            ? "opacity-60 shadow-[inset_0_0_80px_rgba(245,158,11,0.04)]"
            : "opacity-0"
        }`}
      />

      {/* SECURE CHAT HEADER */}
      <header className="sticky top-0 z-40 px-4 sm:px-8 py-3.5 border-b border-white/[0.07] bg-[#090b0f]/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          {/* Room Identity Left */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-300">
              <Lock className="w-3.5 h-3.5 stroke-[2.2]" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight text-white">
                  Private Room
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ACTIVE
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400 font-light">
                <Users className="w-3 h-3 text-zinc-400" />
                <span>2 participants</span>
              </div>
            </div>
          </div>

          {/* Room Code Badge & Timer Center/Right */}
          <div className="flex items-center gap-2 sm:gap-5">
            {/* Room Code Pill */}
            {session && (
              <button
                onClick={handleCopyCode}
                title="Click to copy room code"
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06] transition-all text-xs font-mono text-zinc-300"
              >
                <span className="tracking-wider text-zinc-400">CODE:</span>
                <span className="font-semibold text-white tracking-widest">
                  {session.roomCode}
                </span>
                {copiedCode ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-zinc-500" />
                )}
              </button>
            )}

            {/* Circular Progress Timer */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md transition-colors ${
                isCriticalExpiring
                  ? "bg-red-500/10 border-red-500/30 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                  : isExpiringSoon
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                  : "bg-white/[0.03] border-white/[0.08] text-white"
              }`}
            >
              {/* SVG Circular Ring Indicator */}
              <div className="relative w-5 h-5 flex items-center justify-center">
                <svg className="w-5 h-5 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-white/10"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={`transition-all duration-1000 ${
                      isCriticalExpiring
                        ? "text-red-400"
                        : isExpiringSoon
                        ? "text-amber-400"
                        : "text-sky-400"
                    }`}
                    strokeDasharray="100, 100"
                    strokeDashoffset={strokeDashoffset}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
              </div>

              <span className="font-mono text-xs sm:text-sm font-semibold tracking-wider">
                {formatTimeRemaining(timeRemaining)}
              </span>
            </div>

            {/* Stealth Shield, Audio & Leave Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Anti-Screenshot Master Guard Button */}
              <button
                onClick={() => setAntiScreenshotActive(!antiScreenshotActive)}
                aria-label="Toggle anti-screenshot guard"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono transition-all border ${
                  antiScreenshotActive
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                    : "bg-white/[0.03] border-white/10 text-zinc-500 hover:text-zinc-300"
                }`}
                title={
                  antiScreenshotActive
                    ? "Anti-Screenshot Guard Active: Messages & photos blurred until hovered/tapped"
                    : "Anti-Screenshot Guard Off: Plain text mode"
                }
              >
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden lg:inline text-[11px] font-semibold tracking-wider">
                  {antiScreenshotActive ? "ANTI-CAPTURE ON" : "ANTI-CAPTURE OFF"}
                </span>
              </button>

              {/* Stealth Mode Anti-Capture Toggle */}
              <button
                onClick={() => setStealthProtectionEnabled(!stealthProtectionEnabled)}
                aria-label="Toggle stealth photo protection"
                className={`p-2 rounded-lg transition-colors ${
                  stealthProtectionEnabled
                    ? "text-sky-400 bg-sky-500/10 hover:bg-sky-500/20"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                }`}
                title={
                  stealthProtectionEnabled
                    ? "Stealth Shield Active: Photos blurred until pressed & held"
                    : "Stealth Shield Inactive: Photos visible normally"
                }
              >
                {stealthProtectionEnabled ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>

              <button
                onClick={toggleSound}
                aria-label="Toggle audio"
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4 text-zinc-600" />
                )}
              </button>

              <button
                onClick={leaveRoom}
                aria-label="Leave room"
                className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Leave room"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MESSAGES FEED CONTAINER */}
      <main
        onContextMenu={(e) => e.preventDefault()}
        className="private-chat-content flex-1 max-w-4xl w-full mx-auto px-4 sm:px-8 py-6 overflow-y-auto flex flex-col justify-between"
      >
        <div className="space-y-4 pb-4">
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              if (msg.senderId === "system") {
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-center my-4"
                  >
                    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.02] border border-white/[0.06] text-[11px] font-mono text-zinc-500 tracking-wide text-center">
                      <Shield className="w-3 h-3 text-sky-400/80" />
                      <span>{msg.content}</span>
                    </div>
                  </motion.div>
                );
              }

              const timeRemainingMsg = getMessageTimeRemaining(msg.expiresAt);

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, scale: 0.95, y: 14 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, filter: "blur(4px)" }}
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  className={`group relative flex flex-col ${
                    msg.isSelf ? "items-end" : "items-start"
                  }`}
                >
                  {/* Sender identity, timestamp & individual disappearing timer */}
                  <div className="flex items-center gap-2 px-1 mb-1 text-[11px] font-mono text-zinc-500">
                    <span className="font-medium text-zinc-400">
                      {msg.senderName}
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>

                    {/* Per-message self-destruct indicator */}
                    {timeRemainingMsg && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] text-zinc-400 font-mono">
                        <Clock className="w-2.5 h-2.5 text-sky-400/80" />
                        {timeRemainingMsg}
                      </span>
                    )}

                    {/* Delivery Status Indicator for outgoing messages */}
                    {msg.isSelf && (
                      <span className="ml-0.5">
                        {msg.deliveryStatus === "sending" && (
                          <span className="w-3 h-3 border border-zinc-400 border-t-transparent rounded-full animate-spin inline-block" />
                        )}
                        {msg.deliveryStatus === "sent" && (
                          <Check className="w-3 h-3 text-zinc-400" />
                        )}
                        {msg.deliveryStatus === "delivered" && (
                          <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
                        )}
                        {msg.deliveryStatus === "failed" && (
                          <button
                            onClick={() => retrySendMessage(msg.id)}
                            title="Retry sending"
                            className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 text-[10px]"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <RotateCw className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Quoted reply badge if replying */}
                  {msg.replyTo && (
                    <div
                      className={`text-xs px-3 py-1.5 rounded-t-xl mb-[-2px] border border-b-0 max-w-[85%] sm:max-w-md ${
                        msg.isSelf
                          ? "bg-white/[0.03] border-white/10 text-zinc-400 self-end"
                          : "bg-white/[0.02] border-white/10 text-zinc-400 self-start"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 mb-0.5">
                        <CornerDownRight className="w-2.5 h-2.5" />
                        <span>Replying to {msg.replyTo.senderName}</span>
                      </div>
                      <p className="truncate line-clamp-1 italic text-zinc-300">
                        {msg.replyTo.content}
                      </p>
                    </div>
                  )}

                  {/* Message Bubble (Text + Image) */}
                  <div className="relative group/bubble flex items-center">
                    <div
                      className={`rounded-2xl text-sm leading-relaxed max-w-[90vw] sm:max-w-lg transition-all overflow-hidden ${
                        msg.isSelf
                          ? "bg-zinc-100 text-zinc-950 font-normal rounded-tr-sm shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
                          : "bg-[#14171f] text-zinc-200 border border-white/[0.07] rounded-tl-sm shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
                      }`}
                    >
                      {/* Attached Image inside bubble */}
                      {msg.imageUrl && (
                        <div
                          onMouseDown={() => setHoldToRevealImageId(msg.id)}
                          onMouseUp={() => setHoldToRevealImageId(null)}
                          onMouseLeave={() => setHoldToRevealImageId(null)}
                          onTouchStart={() => setHoldToRevealImageId(msg.id)}
                          onTouchEnd={() => setHoldToRevealImageId(null)}
                          onContextMenu={(e) => e.preventDefault()}
                          className="relative cursor-pointer group/img overflow-hidden bg-black/40 select-none no-drag"
                        >
                          {/* Image upload progress overlay */}
                          {msg.deliveryStatus === "sending" && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                              <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mb-2" />
                              <span className="text-[10px] font-mono text-white tracking-wider">
                                Uploading…
                              </span>
                            </div>
                          )}

                          <img
                            src={msg.imageUrl}
                            alt="Encrypted attachment"
                            draggable={false}
                            className={`w-full max-h-72 sm:max-h-80 object-cover transition-all duration-300 pointer-events-none no-drag select-none ${
                              stealthProtectionEnabled && holdToRevealImageId !== msg.id
                                ? "filter blur-xl scale-105 brightness-50"
                                : "filter blur-0 scale-100 brightness-100"
                            }`}
                          />

                          {/* Anti-screenshot Hold-to-reveal Prompt */}
                          {stealthProtectionEnabled && holdToRevealImageId !== msg.id && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm p-4 text-center pointer-events-none">
                              <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white mb-2 shadow-lg">
                                <Eye className="w-5 h-5" />
                              </div>
                              <span className="text-xs font-semibold text-white tracking-wide mb-0.5">
                                Protected Photo
                              </span>
                              <span className="text-[10px] font-mono text-zinc-300">
                                Press & hold to reveal
                              </span>
                            </div>
                          )}

                          {/* Expand to Lightbox action when unblurred */}
                          {(!stealthProtectionEnabled || holdToRevealImageId === msg.id) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveLightboxImage({
                                  url: msg.imageUrl!,
                                  senderName: msg.senderName,
                                  timestamp: msg.timestamp,
                                });
                              }}
                              className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-md text-[10px] font-mono text-white flex items-center gap-1 hover:bg-black/90 transition-colors shadow-lg"
                            >
                              <ImageIcon className="w-3 h-3" />
                              <span>Expand</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Text content with Anti-Screenshot Protection */}
                      {msg.content && msg.content !== "[Photo]" && (
                        <div
                          onMouseEnter={() => setHoveredMessageId(msg.id)}
                          onMouseLeave={() => setHoveredMessageId(null)}
                          onTouchStart={() => setHoveredMessageId(msg.id)}
                          onTouchEnd={() => setHoveredMessageId(null)}
                          className="relative cursor-pointer select-none"
                        >
                          <p
                            className={`px-5 py-3.5 whitespace-pre-wrap break-words transition-all duration-200 select-none ${
                              antiScreenshotActive && hoveredMessageId !== msg.id
                                ? "filter blur-[7px] opacity-25 scale-[0.98] select-none pointer-events-none"
                                : "filter blur-0 opacity-100 scale-100"
                            }`}
                          >
                            {msg.content}
                          </p>
                          {antiScreenshotActive && hoveredMessageId !== msg.id && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-3">
                              <span className="text-[9px] font-mono tracking-widest text-zinc-300 bg-black/60 px-2 py-0.5 rounded-full border border-white/10 shadow-sm backdrop-blur-sm uppercase">
                                Hover to reveal
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Contextual hover actions */}
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 hidden group-hover/bubble:flex items-center gap-1 px-1.5 py-1 rounded-xl bg-[#1b1f29] border border-white/10 shadow-xl backdrop-blur-md z-20 ${
                        msg.isSelf ? "-left-28" : "-right-28"
                      }`}
                    >
                      <button
                        onClick={() =>
                          setReplyingTo({
                            id: msg.id,
                            senderName: msg.senderName,
                            content: msg.content || "Photo",
                          })
                        }
                        title="Reply"
                        className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 text-xs"
                      >
                        <CornerDownRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() =>
                          setActiveReactionMenu(
                            activeReactionMenu === msg.id ? null : msg.id
                          )
                        }
                        title="React"
                        className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 text-xs"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>

                      {msg.content && msg.content !== "[Photo]" && (
                        <button
                          onClick={() =>
                            copyToClipboard(msg.content, "Message copied")
                          }
                          title="Copy text"
                          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 text-xs"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Emoji Reaction Popover */}
                    {activeReactionMenu === msg.id && (
                      <div
                        className={`absolute -top-10 z-30 flex items-center gap-1.5 p-1.5 rounded-full bg-[#1b1f29] border border-white/15 shadow-2xl ${
                          msg.isSelf ? "right-0" : "left-0"
                        }`}
                      >
                        {EMOJI_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              addReaction(msg.id, emoji);
                              setActiveReactionMenu(null);
                            }}
                            className="p-1.5 text-sm hover:scale-125 transition-transform rounded-full hover:bg-white/10"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Reaction Badges */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5 px-1">
                      {msg.reactions.map((reaction) => (
                        <button
                          key={reaction.emoji}
                          onClick={() => addReaction(msg.id, reaction.emoji)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] hover:border-white/20 text-xs text-zinc-300 transition-colors"
                        >
                          <span>{reaction.emoji}</span>
                          <span className="text-[10px] font-mono font-medium text-zinc-400">
                            {reaction.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Tasteful Typing Indicator */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="flex items-center gap-2.5 px-2 py-1"
            >
              <div className="flex items-center gap-1 px-3.5 py-2 rounded-2xl bg-[#14171f] border border-white/[0.06] shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
              <span className="text-[11px] font-mono text-zinc-500">
                Someone is typing…
              </span>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* COMPOSER FOOTER */}
      <footer className="composer-container sticky bottom-0 z-40 px-4 sm:px-8 py-3 sm:py-4 bg-[#090b0f]/90 border-t border-white/[0.07] backdrop-blur-xl">
        <div className="max-w-4xl mx-auto">
          {/* Active Reply Banner */}
          {replyingTo && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="flex items-center justify-between px-3.5 py-2 mb-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-zinc-300"
            >
              <div className="flex items-center gap-2 truncate">
                <CornerDownRight className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="font-medium text-zinc-400">
                  Replying to {replyingTo.senderName}:
                </span>
                <span className="truncate italic text-zinc-300">
                  {replyingTo.content}
                </span>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="p-1 hover:text-white text-zinc-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}

          {/* Image Attachment Preview Bar */}
          {imagePreviewUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center justify-between p-2 mb-2 rounded-2xl bg-white/[0.03] border border-white/[0.1] backdrop-blur-md"
            >
              <div className="flex items-center gap-3">
                <img
                  src={imagePreviewUrl}
                  alt="Attachment preview"
                  className="w-12 h-12 object-cover rounded-xl border border-white/10"
                />
                <div>
                  <span className="text-xs font-medium text-white block">
                    {selectedImageFile?.name || "Image attachment"}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {selectedImageFile
                      ? `${(selectedImageFile.size / 1024).toFixed(0)} KB • Ready to send`
                      : "Photo attachment"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRemoveSelectedImage}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.05]"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* Main Input Box */}
          <div className="relative flex items-end gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-2xl bg-[#13161f] border border-white/[0.08] focus-within:border-white/25 focus-within:shadow-[0_0_20px_-5px_rgba(255,255,255,0.08)] transition-all">
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/jpg"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Photo Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach photo (JPG, PNG, WEBP)"
              className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors shrink-0"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Disappearing Message Timer Selector */}
            <div className="pb-1 shrink-0">
              <DisappearingTimerSelector
                selectedSeconds={selectedTtl}
                onSelect={setSelectedTtl}
              />
            </div>

            {/* Auto-growing Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputVal}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={selectedImageFile ? "Add a caption…" : "Write a message…"}
              className="w-full resize-none bg-transparent py-2 px-1 text-sm text-white placeholder:text-zinc-500 focus:outline-none max-h-36 leading-relaxed"
            />

            {/* Quick Emoji Trigger */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                title="Add emoji"
                className="p-2.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
              >
                <Smile className="w-4 h-4" />
              </button>

              {showEmojiPicker && (
                <div className="absolute bottom-12 right-0 flex gap-1 p-2 rounded-2xl bg-[#1a1e28] border border-white/10 shadow-2xl z-50">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => addEmojiToInput(emoji)}
                      className="p-1.5 hover:bg-white/10 rounded-lg text-base"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Send Button */}
            <button
              type="button"
              disabled={!inputVal.trim() && !selectedImageFile}
              onClick={handleSend}
              className="p-2.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-30 disabled:hover:bg-white disabled:pointer-events-none transition-all shrink-0 active:scale-95"
            >
              <Send className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>

          {/* Footer status notice */}
          <div className="flex items-center justify-between px-2 pt-2 text-[10px] font-mono text-zinc-400">
            <span>Enter to send • Shift + Enter for newline</span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-zinc-400" />
              Protected by 5MIN Privacy Guard
            </span>
          </div>
        </div>
      </footer>

      {/* Lightbox Fullscreen Image Modal */}
      <LightboxModal
        isOpen={Boolean(activeLightboxImage)}
        imageUrl={activeLightboxImage?.url || null}
        senderName={activeLightboxImage?.senderName}
        timestamp={activeLightboxImage?.timestamp}
        onClose={() => setActiveLightboxImage(null)}
      />
    </div>
  );
}
