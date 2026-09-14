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
  CornerDownRight,
  X,
  Sparkles,
  Shield,
  Volume2,
  VolumeX,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const EMOJI_OPTIONS = ["👍", "🔥", "🤫", "✨", "⏳"];

export function ChatRoomView() {
  const {
    session,
    timeRemaining,
    messages,
    isTyping,
    sendMessage,
    addReaction,
    copyToClipboard,
    leaveRoom,
    isExpiringSoon,
    isCriticalExpiring,
    soundEnabled,
    toggleSound,
    broadcastTyping,
  } = useChat();

  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const [inputVal, setInputVal] = useState("");
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    senderName: string;
    content: string;
  } | null>(null);
  const [activeReactionMenu, setActiveReactionMenu] = useState<string | null>(
    null
  );
  const [copiedCode, setCopiedCode] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

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

  const handleSend = () => {
    if (!inputVal.trim()) return;
    broadcastTyping(false);
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    sendMessage(inputVal, replyingTo || undefined);
    setInputVal("");
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

  // Timer Progress Math: 300 seconds total
  const totalSeconds = 300;
  const progressRatio = Math.max(0, timeRemaining / totalSeconds);
  const strokeDashoffset = 100 - progressRatio * 100;

  return (
    <div
      className={`min-h-screen flex flex-col justify-between transition-colors duration-1000 ${
        isCriticalExpiring
          ? "bg-[#040506]"
          : isExpiringSoon
          ? "bg-[#07080a]"
          : "bg-background"
      }`}
    >
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
          <div className="flex items-center gap-3 sm:gap-6">
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
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border backdrop-blur-md transition-colors ${
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

            {/* Actions: Sound & Leave */}
            <div className="flex items-center gap-1">
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
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-8 py-6 overflow-y-auto flex flex-col justify-between">
        {/* Messages List */}
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

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className={`group relative flex flex-col ${
                    msg.isSelf ? "items-end" : "items-start"
                  }`}
                >
                  {/* Sender identity & timestamp */}
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

                  {/* Message Bubble */}
                  <div className="relative group/bubble flex items-center">
                    <div
                      className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed max-w-[90vw] sm:max-w-lg transition-all ${
                        msg.isSelf
                          ? "bg-zinc-100 text-zinc-950 font-normal rounded-tr-sm shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
                          : "bg-[#14171f] text-zinc-200 border border-white/[0.07] rounded-tl-sm shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
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
                            content: msg.content,
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

                      <button
                        onClick={() => copyToClipboard(msg.content, "Message copied")}
                        title="Copy text"
                        className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 text-xs"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
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
      <footer className="sticky bottom-0 z-40 px-4 sm:px-8 py-4 bg-[#090b0f]/85 border-t border-white/[0.07] backdrop-blur-xl">
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

          {/* Main Input Box */}
          <div className="relative flex items-end gap-2 p-2 rounded-2xl bg-[#13161f] border border-white/[0.08] focus-within:border-white/25 focus-within:shadow-[0_0_20px_-5px_rgba(255,255,255,0.08)] transition-all">
            {/* Attachment icon */}
            <button
              type="button"
              onClick={() =>
                copyToClipboard(session?.roomCode || "", "Room code copied")
              }
              title="Share Room Code"
              className="p-2.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors shrink-0"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Auto-growing Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputVal}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Write a message…"
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
              disabled={!inputVal.trim()}
              onClick={handleSend}
              className="p-2.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-30 disabled:hover:bg-white disabled:pointer-events-none transition-all shrink-0"
            >
              <Send className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>

          <div className="flex items-center justify-between px-2 pt-2 text-[10px] font-mono text-zinc-400">
            <span>Enter to send • Shift + Enter for newline</span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-zinc-400" />
              All messages dissolve at 00:00
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

