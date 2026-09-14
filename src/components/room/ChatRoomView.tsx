"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
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
  Flame,
  Sliders,
  Trash2,
  Link2,
  UploadCloud,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LightboxModal } from "@/components/ui/LightboxModal";
import { PrivacyShield } from "@/components/ui/PrivacyShield";
import { AntiScreenshotWatermark } from "@/components/ui/AntiScreenshotWatermark";
import { DisappearingTimerSelector } from "@/components/room/DisappearingTimerSelector";
import { ViewOncePhotoBubble } from "@/components/room/ViewOncePhotoBubble";
import { DestroyRoomModal } from "@/components/room/DestroyRoomModal";
import { RoomSettingsDrawer } from "@/components/room/RoomSettingsDrawer";

const EMOJI_OPTIONS = ["❤️", "😂", "👍", "🔥", "😮", "😢"];

function renderSafeMessageContent(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-sky-400 hover:text-sky-300 underline underline-offset-2 break-all inline-flex items-center gap-0.5"
        >
          <span>{part}</span>
          <ExternalLink className="w-2.5 h-2.5 inline shrink-0" />
        </a>
      );
    }
    return part;
  });
}

export function ChatRoomView() {
  const {
    session,
    timeRemaining,
    messages,
    isTyping,
    connectionState,
    isOwner,
    participants,
    sendMessage,
    retrySendMessage,
    deleteMessage,
    markViewOnceOpened,
    updateRoomSettings,
    kickParticipant,
    revokeInvite,
    markMessagesAsSeen,
    destroyRoom,
    copyInviteLink,
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
  const [isViewOnceSelected, setIsViewOnceSelected] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDestroyModalOpen, setIsDestroyModalOpen] = useState(false);

  const [activeLightboxImage, setActiveLightboxImage] = useState<{
    url: string;
    senderName: string;
    timestamp: number;
    isViewOnce?: boolean;
    messageId?: string;
  } | null>(null);

  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    senderName: string;
    content: string;
  } | null>(null);

  const [activeReactionMenu, setActiveReactionMenu] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [holdToRevealImageId, setHoldToRevealImageId] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [stealthProtectionEnabled, setStealthProtectionEnabled] = useState(true);
  const [antiScreenshotActive, setAntiScreenshotActive] = useState(true);

  // Smart Auto-Scroll State
  const [userIsScrolledUp, setUserIsScrolledUp] = useState(false);
  const [unreadNewCount, setUnreadNewCount] = useState(0);
  const prevMessagesCountRef = useRef(messages.length);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const touchStartXRef = useRef<number>(0);

  // Release held reveal on blur/mouseup
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

  // Mark incoming messages as seen on view
  useEffect(() => {
    markMessagesAsSeen();
  }, [messages.length, markMessagesAsSeen]);

  // Handle scroll position & smart auto-scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const isUp = distanceToBottom > 140;
    setUserIsScrolledUp(isUp);
    if (!isUp) {
      setUnreadNewCount(0);
    }
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setUserIsScrolledUp(false);
    setUnreadNewCount(0);
  }, []);

  // Auto-scroll only if user is near bottom
  useEffect(() => {
    if (messages.length > prevMessagesCountRef.current) {
      if (userIsScrolledUp) {
        setUnreadNewCount((prev) => prev + 1);
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
    prevMessagesCountRef.current = messages.length;
  }, [messages, userIsScrolledUp]);

  // Click quoted reply -> scroll to target message with glowing flash
  const handleScrollToRepliedMessage = (targetId: string) => {
    const targetEl = document.getElementById(`msg-${targetId}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(targetId);
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2200);
    }
  };

  // Auto-expanding textarea
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

  const processImageFile = useCallback(
    (file: File) => {
      if (session?.allowImages === false) {
        triggerToast("Photo sharing is disabled in this room.", "warning");
        return;
      }
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
      triggerToast("Photo attached. Ready to send.", "info");
    },
    [session?.allowImages, triggerToast]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleRemoveSelectedImage = () => {
    setSelectedImageFile(null);
    setIsViewOnceSelected(false);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processImageFile(files[0]);
    }
  };

  // Global Clipboard Paste listener (Cmd/Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            processImageFile(file);
            triggerToast("Photo pasted from clipboard", "info");
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [processImageFile, triggerToast]);

  const handleSend = () => {
    if (!inputVal.trim() && !selectedImageFile) return;

    broadcastTyping(false);
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);

    sendMessage(
      inputVal,
      replyingTo || undefined,
      selectedImageFile || undefined,
      isViewOnceSelected
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

  const handleCopyInviteLink = async () => {
    await copyInviteLink();
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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

  // Lightbox navigation calculations
  const allImages = messages
    .filter((m) => Boolean(m.imageUrl) && !m.isViewOnce && !m.isDeleted)
    .map((m) => ({
      url: m.imageUrl!,
      senderName: m.senderName,
      timestamp: m.timestamp,
    }));

  const currentImageIndex = activeLightboxImage
    ? allImages.findIndex((img) => img.url === activeLightboxImage.url)
    : -1;

  const hasPrevImage = currentImageIndex > 0;
  const hasNextImage = currentImageIndex !== -1 && currentImageIndex < allImages.length - 1;

  const handlePrevImage = () => {
    if (hasPrevImage) {
      setActiveLightboxImage(allImages[currentImageIndex - 1]);
    }
  };

  const handleNextImage = () => {
    if (hasNextImage) {
      setActiveLightboxImage(allImages[currentImageIndex + 1]);
    }
  };

  const totalSeconds = session?.durationSeconds || 300;
  const progressRatio = Math.max(0, timeRemaining / totalSeconds);
  const strokeDashoffset = 100 - progressRatio * 100;

  const activeOnlineCount = participants.filter((p) => p.status !== "offline").length || 1;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`min-h-screen flex flex-col justify-between transition-colors duration-1000 select-none relative ${
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

      {/* Print Protection Shield banner */}
      <div className="print-shield-notice">
        🔒 5MIN: Private temporary conversation. Printing content is prohibited.
      </div>

      {/* Drag & Drop Visual Dropzone Overlay */}
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md border-2 border-dashed border-sky-400 m-4 rounded-3xl pointer-events-none"
          >
            <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-center text-sky-400 mb-4 shadow-[0_0_30px_rgba(56,189,248,0.2)]">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold text-white tracking-tight">
              Drop photo to attach
            </h3>
            <p className="text-xs font-mono text-zinc-400 mt-1">
              Supports JPG, PNG, WEBP up to 10MB
            </p>
          </motion.div>
        )}
      </AnimatePresence>

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
      <header className="sticky top-0 z-40 px-4 sm:px-8 py-3.5 border-b border-white/[0.07] bg-[#090b0f]/85 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Room Identity Left */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-300 shadow-inner">
              <Lock className="w-3.5 h-3.5 stroke-[2.2]" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight text-white">
                  Private Room
                </span>

                {/* Connection State Pill */}
                {connectionState === "connected" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    CONNECTED
                  </span>
                )}
                {connectionState === "reconnecting" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    RECONNECTING
                  </span>
                )}
                {connectionState === "offline" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-mono text-red-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    OFFLINE
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-400 font-light">
                <Users className="w-3 h-3 text-zinc-400" />
                <span>
                  {activeOnlineCount} {activeOnlineCount === 1 ? "participant online" : "participants online"}
                  {session?.maxParticipants ? ` (max ${session.maxParticipants})` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Room Code Badge & Timer Center/Right */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Room Code Pill */}
            {session && (
              <div className="hidden md:flex items-center gap-1">
                <button
                  onClick={handleCopyCode}
                  title="Click to copy room code"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06] transition-all text-xs font-mono text-zinc-300"
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

                {/* Direct Invite Link */}
                <button
                  onClick={handleCopyInviteLink}
                  title="Copy direct invite link"
                  className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06] text-zinc-400 hover:text-white transition-all"
                >
                  {copiedLink ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
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

            {/* Header Controls */}
            <div className="flex items-center gap-1 sm:gap-1.5">
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
                    ? "Anti-Screenshot Guard Active: Messages blurred until hovered"
                    : "Anti-Screenshot Guard Off"
                }
              >
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden xl:inline text-[11px] font-semibold tracking-wider">
                  {antiScreenshotActive ? "GUARD ON" : "GUARD OFF"}
                </span>
              </button>

              {/* Stealth Photo Shield Toggle */}
              <button
                onClick={() => setStealthProtectionEnabled(!stealthProtectionEnabled)}
                aria-label="Toggle stealth photo protection"
                className={`p-2 rounded-xl transition-colors ${
                  stealthProtectionEnabled
                    ? "text-sky-400 bg-sky-500/10 hover:bg-sky-500/20"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                }`}
                title={
                  stealthProtectionEnabled
                    ? "Stealth Shield Active: Photos blurred until pressed & held"
                    : "Stealth Shield Inactive"
                }
              >
                {stealthProtectionEnabled ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>

              {/* Audio toggle */}
              <button
                onClick={toggleSound}
                aria-label="Toggle audio"
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4 text-zinc-600" />
                )}
              </button>

              {/* Settings Button */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                aria-label="Room Settings"
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors"
                title="Room Settings & Host Controls"
              >
                <Sliders className="w-4 h-4" />
              </button>

              {/* Leave Room Button */}
              <button
                onClick={leaveRoom}
                aria-label="Leave room"
                className="p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
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
        ref={chatContainerRef}
        onScroll={handleScroll}
        onContextMenu={(e) => e.preventDefault()}
        className="private-chat-content flex-1 max-w-4xl w-full mx-auto px-4 sm:px-8 py-6 overflow-y-auto flex flex-col justify-between relative"
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

              // Deleted Message Card
              if (msg.isDeleted) {
                return (
                  <motion.div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`flex flex-col ${msg.isSelf ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/[0.02] border border-white/[0.05] text-zinc-500 text-xs italic">
                      <Trash2 className="w-3.5 h-3.5 text-zinc-600" />
                      <span>This message was deleted</span>
                    </div>
                  </motion.div>
                );
              }

              const timeRemainingMsg = getMessageTimeRemaining(msg.expiresAt);
              const isTargetHighlighted = highlightedMessageId === msg.id;

              return (
                <motion.div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  initial={{ opacity: 0, scale: 0.95, y: 14 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, filter: "blur(4px)" }}
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  onTouchStart={(e) => {
                    touchStartXRef.current = e.touches[0].clientX;
                  }}
                  onTouchEnd={(e) => {
                    const touchEndX = e.changedTouches[0].clientX;
                    const diffX = touchEndX - touchStartXRef.current;
                    if (Math.abs(diffX) > 55 && session?.allowReplies !== false) {
                      setReplyingTo({
                        id: msg.id,
                        senderName: msg.senderName,
                        content: msg.content || "Photo",
                      });
                      textareaRef.current?.focus();
                    }
                  }}
                  className={`group relative flex flex-col ${
                    msg.isSelf ? "items-end" : "items-start"
                  }`}
                >
                  {/* Sender identity, timestamp & countdown */}
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

                    {/* Per-message countdown badge */}
                    {timeRemainingMsg && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] text-zinc-400 font-mono">
                        <Clock className="w-2.5 h-2.5 text-sky-400/80" />
                        {timeRemainingMsg}
                      </span>
                    )}

                    {/* Delivery Status Indicator */}
                    {msg.isSelf && (
                      <span className="ml-0.5 flex items-center" title={`Status: ${msg.deliveryStatus || "sent"}`}>
                        {msg.deliveryStatus === "sending" && (
                          <span className="w-3 h-3 border border-zinc-400 border-t-transparent rounded-full animate-spin inline-block" />
                        )}
                        {msg.deliveryStatus === "sent" && (
                          <Check className="w-3 h-3 text-zinc-400" />
                        )}
                        {msg.deliveryStatus === "delivered" && (
                          <CheckCheck className="w-3.5 h-3.5 text-zinc-300" />
                        )}
                        {msg.deliveryStatus === "seen" && (
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

                  {/* Quoted reply banner if replying */}
                  {msg.replyTo && (
                    <button
                      type="button"
                      onClick={() => handleScrollToRepliedMessage(msg.replyTo!.id)}
                      className={`text-left text-xs px-3 py-1.5 rounded-t-xl mb-[-2px] border border-b-0 max-w-[85%] sm:max-w-md transition-all hover:bg-white/[0.05] ${
                        msg.isSelf
                          ? "bg-white/[0.03] border-white/10 text-zinc-400 self-end"
                          : "bg-white/[0.02] border-white/10 text-zinc-400 self-start"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 mb-0.5">
                        <CornerDownRight className="w-2.5 h-2.5 text-sky-400" />
                        <span>Replying to {msg.replyTo.senderName}</span>
                      </div>
                      <p className="truncate line-clamp-1 italic text-zinc-300">
                        {msg.replyTo.content}
                      </p>
                    </button>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`relative group/bubble flex items-center transition-all duration-300 ${
                      isTargetHighlighted
                        ? "ring-2 ring-sky-400 ring-offset-2 ring-offset-black shadow-[0_0_25px_rgba(56,189,248,0.5)] rounded-2xl"
                        : ""
                    }`}
                  >
                    {msg.isViewOnce ? (
                      <ViewOncePhotoBubble
                        messageId={msg.id}
                        isSelf={msg.isSelf}
                        senderName={msg.senderName}
                        imageUrl={msg.imageUrl}
                        viewedAt={msg.viewedAt}
                        onOpen={() => {
                          if (msg.imageUrl && !msg.viewedAt) {
                            markViewOnceOpened(msg.id);
                            setActiveLightboxImage({
                              url: msg.imageUrl,
                              senderName: msg.senderName,
                              timestamp: msg.timestamp,
                              isViewOnce: true,
                              messageId: msg.id,
                            });
                          }
                        }}
                      />
                    ) : (
                      <div
                        className={`rounded-2xl text-sm leading-relaxed max-w-[90vw] sm:max-w-lg transition-all overflow-hidden ${
                          msg.isSelf
                            ? "bg-zinc-100 text-zinc-950 font-normal rounded-tr-sm shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
                            : "bg-[#14171f] text-zinc-200 border border-white/[0.07] rounded-tl-sm shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
                        }`}
                      >
                        {/* Attached Image */}
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
                            {/* Upload spinner */}
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

                            {/* Anti-screenshot prompt */}
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

                            {/* Expand button */}
                            {(!stealthProtectionEnabled || holdToRevealImageId === msg.id) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveLightboxImage({
                                    url: msg.imageUrl!,
                                    senderName: msg.senderName,
                                    timestamp: msg.timestamp,
                                    isViewOnce: false,
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
                              {renderSafeMessageContent(msg.content)}
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
                    )}

                    {/* Contextual actions popover on hover */}
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 hidden group-hover/bubble:flex items-center gap-1 px-1.5 py-1 rounded-xl bg-[#1b1f29] border border-white/10 shadow-xl backdrop-blur-md z-20 ${
                        msg.isSelf ? "-left-36" : "-right-36"
                      }`}
                    >
                      {/* Reply Button */}
                      {session?.allowReplies !== false && (
                        <button
                          onClick={() => {
                            setReplyingTo({
                              id: msg.id,
                              senderName: msg.senderName,
                              content: msg.content || "Photo",
                            });
                            textareaRef.current?.focus();
                          }}
                          title="Reply"
                          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 text-xs"
                        >
                          <CornerDownRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* React Button */}
                      {session?.allowReactions !== false && (
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
                      )}

                      {/* Copy Text Button */}
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

                      {/* Delete Message Button */}
                      {(msg.isSelf || isOwner) && (
                        <button
                          onClick={() => deleteMessage(msg.id)}
                          title="Delete message"
                          className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 text-xs transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Emoji Reaction Picker Popover */}
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

          {/* Typing Indicator */}
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

        {/* Floating "New Messages" Pill when scrolled up */}
        <AnimatePresence>
          {userIsScrolledUp && unreadNewCount > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              onClick={scrollToBottom}
              className="sticky bottom-4 left-1/2 -translate-x-1/2 z-30 mx-auto px-4 py-2 rounded-full bg-white text-zinc-950 font-mono text-xs font-semibold shadow-2xl flex items-center gap-2 hover:scale-105 transition-all"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>
                {unreadNewCount} new message{unreadNewCount > 1 ? "s" : ""}
              </span>
            </motion.button>
          )}
        </AnimatePresence>
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
                      ? `${(selectedImageFile.size / 1024).toFixed(0)} KB`
                      : "Photo"}
                    {isViewOnceSelected ? " • View-Once Enabled" : " • Standard Photo"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* View-Once Toggle */}
                {session?.allowViewOnce !== false && (
                  <button
                    type="button"
                    onClick={() => setIsViewOnceSelected(!isViewOnceSelected)}
                    title={
                      isViewOnceSelected
                        ? "View Once: Photo disappears after being opened once"
                        : "Click to enable View Once mode"
                    }
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all ${
                      isViewOnceSelected
                        ? "bg-sky-500/20 border-sky-400/50 text-sky-300 shadow-[0_0_15px_rgba(56,189,248,0.25)]"
                        : "bg-white/[0.04] border-white/10 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">
                      1
                    </span>
                    <span>VIEW ONCE</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleRemoveSelectedImage}
                  className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.05]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
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
            {session?.allowImages !== false ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach photo (JPG, PNG, WEBP)"
                className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors shrink-0"
              >
                <Paperclip className="w-4 h-4" />
              </button>
            ) : null}

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
              placeholder={
                selectedImageFile
                  ? isViewOnceSelected
                    ? "Add a caption for view-once photo…"
                    : "Add a caption…"
                  : "Write a message…"
              }
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
        isViewOnce={Boolean(activeLightboxImage?.isViewOnce)}
        hasPrev={hasPrevImage}
        hasNext={hasNextImage}
        onPrev={handlePrevImage}
        onNext={handleNextImage}
        onClose={() => setActiveLightboxImage(null)}
      />

      {/* Host Settings & Privacy Controls Drawer */}
      <RoomSettingsDrawer
        isOpen={isSettingsOpen}
        isOwner={isOwner}
        roomCode={session?.roomCode || ""}
        durationSeconds={session?.durationSeconds || 300}
        participants={participants.length > 0 ? participants : session?.participants || []}
        maxParticipants={session?.maxParticipants || 2}
        allowImages={session?.allowImages ?? true}
        allowReactions={session?.allowReactions ?? true}
        allowReplies={session?.allowReplies ?? true}
        allowViewOnce={session?.allowViewOnce ?? true}
        isInviteRevoked={session?.isInviteRevoked ?? false}
        onUpdateSettings={updateRoomSettings}
        onKickParticipant={kickParticipant}
        onRevokeInvite={revokeInvite}
        onDestroyRoom={() => {
          setIsSettingsOpen(false);
          setIsDestroyModalOpen(true);
        }}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Emergency Destroy Room Confirmation Modal */}
      <DestroyRoomModal
        isOpen={isDestroyModalOpen}
        roomCode={session?.roomCode || ""}
        onConfirm={async () => {
          await destroyRoom();
          setIsDestroyModalOpen(false);
        }}
        onClose={() => setIsDestroyModalOpen(false)}
      />
    </div>
  );
}
