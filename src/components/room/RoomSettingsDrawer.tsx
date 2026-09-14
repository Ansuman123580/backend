"use client";

import React, { useState } from "react";
import {
  X,
  Shield,
  Clock,
  Image as ImageIcon,
  Smile,
  CornerDownRight,
  Users,
  UserX,
  Trash2,
  Check,
  Radio,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Participant } from "@/types/chat";

interface RoomSettingsDrawerProps {
  isOpen: boolean;
  isOwner: boolean;
  roomCode: string;
  durationSeconds: number;
  participants: Participant[];
  allowImages: boolean;
  allowReactions: boolean;
  allowReplies: boolean;
  onUpdateSettings: (settings: {
    allowImages?: boolean;
    allowReactions?: boolean;
    allowReplies?: boolean;
    durationSeconds?: number;
  }) => Promise<void>;
  onKickParticipant?: (participantId: string) => void;
  onDestroyRoom: () => void;
  onClose: () => void;
}

export function RoomSettingsDrawer({
  isOpen,
  isOwner,
  roomCode,
  durationSeconds,
  participants,
  allowImages,
  allowReactions,
  allowReplies,
  onUpdateSettings,
  onKickParticipant,
  onDestroyRoom,
  onClose,
}: RoomSettingsDrawerProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm select-none">
        {/* Backdrop click */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 300 }}
          className="relative w-full max-w-md h-full bg-[#0d0f14] border-l border-white/10 shadow-2xl flex flex-col justify-between overflow-y-auto z-10"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white tracking-tight">
                  Privacy Controls
                </h3>
                <span className="text-[10px] font-mono text-zinc-500">
                  Room {roomCode} • {isOwner ? "Host Privileges" : "Guest View"}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="p-6 space-y-6 flex-1">
            {/* Participants list */}
            <div>
              <div className="flex items-center gap-2 mb-3 text-xs font-mono tracking-wider text-zinc-400 uppercase">
                <Users className="w-3.5 h-3.5 text-zinc-500" />
                <span>Active Participants ({participants.length}/2)</span>
              </div>

              <div className="space-y-2">
                {participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07]"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center font-mono font-bold text-xs text-white uppercase">
                          {p.name.slice(0, 2)}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0d0f14] ${
                            p.status === "offline" ? "bg-zinc-600" : "bg-emerald-400 animate-pulse"
                          }`}
                        />
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-white">
                            {p.name}
                          </span>
                          {p.isSelf && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-white/10 text-zinc-300">
                              YOU
                            </span>
                          )}
                          {p.isOwner && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-400 font-semibold">
                              HOST
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {p.status === "offline" ? "Offline" : "Active presence"}
                        </span>
                      </div>
                    </div>

                    {isOwner && !p.isSelf && onKickParticipant && (
                      <button
                        onClick={() => onKickParticipant(p.id)}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                        title="Revoke access"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Feature permissions (Owner only editable) */}
            <div>
              <span className="text-xs font-mono tracking-wider text-zinc-400 uppercase block mb-3">
                Channel Permissions
              </span>

              <div className="space-y-2.5">
                {/* Allow Images */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/[0.04] text-zinc-400">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-white block">
                        Allow Photo Sharing
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        Enable uploading images in room
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!isOwner}
                    onClick={() => onUpdateSettings({ allowImages: !allowImages })}
                    className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                      allowImages ? "bg-sky-500" : "bg-zinc-700"
                    } ${!isOwner ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        allowImages ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Allow Reactions */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/[0.04] text-zinc-400">
                      <Smile className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-white block">
                        Allow Emoji Reactions
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        Enable message reaction bar
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!isOwner}
                    onClick={() => onUpdateSettings({ allowReactions: !allowReactions })}
                    className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                      allowReactions ? "bg-sky-500" : "bg-zinc-700"
                    } ${!isOwner ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        allowReactions ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Allow Replies */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/[0.04] text-zinc-400">
                      <CornerDownRight className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-white block">
                        Allow Quoted Replies
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        Enable quoting specific messages
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!isOwner}
                    onClick={() => onUpdateSettings({ allowReplies: !allowReplies })}
                    className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                      allowReplies ? "bg-sky-500" : "bg-zinc-700"
                    } ${!isOwner ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        allowReplies ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Lifespan presets (Owner only) */}
            {isOwner && (
              <div>
                <span className="text-xs font-mono tracking-wider text-zinc-400 uppercase block mb-3">
                  Room Lifespan Extension
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: "30s", sec: 30 },
                    { label: "1m", sec: 60 },
                    { label: "5m", sec: 300 },
                    { label: "10m", sec: 600 },
                    { label: "30m", sec: 1800 },
                    { label: "1h", sec: 3600 },
                    { label: "6h", sec: 21600 },
                    { label: "24h", sec: 86400 },
                  ].map((preset) => (
                    <button
                      key={preset.sec}
                      type="button"
                      onClick={() => onUpdateSettings({ durationSeconds: preset.sec })}
                      className={`py-1.5 px-2 rounded-xl text-xs font-mono font-medium transition-all ${
                        durationSeconds === preset.sec
                          ? "bg-white text-zinc-950 font-semibold shadow-md"
                          : "bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.06]"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer / Danger zone */}
          <div className="p-6 border-t border-white/[0.08] bg-black/20">
            {isOwner ? (
              <button
                type="button"
                onClick={onDestroyRoom}
                className="w-full py-3 px-4 rounded-xl text-xs font-semibold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-600 border border-red-500/25 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                <span>Destroy Room Permanently</span>
              </button>
            ) : (
              <span className="text-center block text-[11px] font-mono text-zinc-500">
                Only the host can adjust room settings
              </span>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
