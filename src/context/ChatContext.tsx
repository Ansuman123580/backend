"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import {
  ScreenState,
  RoomSession,
  Message,
  Participant,
  ToastMessage,
  DeliveryStatus,
  ConnectionState,
} from "@/types/chat";
import { isValidRoomCodeFormat } from "@/lib/roomCode";
import {
  playSoftClick,
  playSendMessageSound,
  playReceiveMessageSound,
  playCopySuccessSound,
  playExpiryChime,
  setSoundMuted,
} from "@/lib/sound";
import { getSupabaseClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/imageCompression";

const SESSION_DURATION = 300; // 5 minutes in seconds

const INITIAL_PEER_RESPONSES = [
  "Connected. This room disappears in 5 minutes.",
  "Quick question: are we aligned on the private release date?",
  "Understood. Let's keep this completely off-the-record.",
  "Photo received. Beautiful clarity.",
  "Time is ticking — 5MIN makes sure nothing remains.",
  "Got it. Talk to you soon.",
];

interface ChatContextType {
  screen: ScreenState;
  session: RoomSession | null;
  timeRemaining: number;
  messages: Message[];
  isTyping: boolean;
  toasts: ToastMessage[];
  soundEnabled: boolean;
  isExpiringSoon: boolean;
  isCriticalExpiring: boolean;
  connectionState: ConnectionState;
  isOwner: boolean;
  selfParticipant: Participant;
  peerParticipant: Participant;
  selectedTtl: number;
  setSelectedTtl: (seconds: number) => void;
  roomLifespan: number;
  setRoomLifespan: (seconds: number) => void;
  goToScreen: (screen: ScreenState) => void;
  initiateCreateRoom: (customDurationSeconds?: number) => Promise<string>;
  updateRoomLifespan: (seconds: number) => Promise<void>;
  enterCreatedRoom: () => void;
  joinRoom: (code: string) => Promise<boolean>;
  sendMessage: (
    content: string,
    replyTo?: Message["replyTo"],
    imageFile?: File,
    isViewOnce?: boolean
  ) => Promise<void>;
  retrySendMessage: (messageId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  markViewOnceOpened: (messageId: string) => Promise<void>;
  updateRoomSettings: (settings: {
    allowImages?: boolean;
    allowReactions?: boolean;
    allowReplies?: boolean;
    durationSeconds?: number;
  }) => Promise<void>;
  destroyRoom: () => Promise<void>;
  copyInviteLink: () => Promise<void>;
  addReaction: (messageId: string, emoji: string) => void;
  copyToClipboard: (text: string, label?: string) => Promise<void>;
  leaveRoom: () => void;
  resetToHome: () => void;
  createAnotherRoom: () => void;
  triggerToast: (text: string, type?: "info" | "success" | "warning") => void;
  removeToast: (id: string) => void;
  toggleSound: () => void;
  broadcastTyping: (isTyping: boolean) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<ScreenState>("landing");
  const [session, setSession] = useState<RoomSession | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(SESSION_DURATION);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [sessionId, setSessionId] = useState<string>("");
  const [selectedTtl, setSelectedTtl] = useState<number>(300); // Default 5m
  const [roomLifespan, setRoomLifespan] = useState<number>(300); // Default room lifespan 5m
  const [connectionState, setConnectionState] = useState<ConnectionState>("connected");

  // Clock skew tracking (server time vs client local time)
  const clockSkewRef = useRef<number>(0);
  const peerResponseIndex = useRef<number>(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const replyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeChannelRef = useRef<any>(null);

  const isExpiringSoon = timeRemaining <= 60 && timeRemaining > 0;
  const isCriticalExpiring = timeRemaining <= 10 && timeRemaining > 0;

  // Track browser online/offline status
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => setConnectionState("connected");
    const handleOffline = () => setConnectionState("offline");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Initialize or restore client session identifier
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      let stored = localStorage.getItem("5min_session_id");
      if (!stored) {
        stored =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `sess_${Date.now()}_${Math.random()}`;
        localStorage.setItem("5min_session_id", stored);
      }
      setSessionId(stored);
    } catch {
      setSessionId(`sess_${Date.now()}`);
    }
  }, []);

  const isOwner = Boolean(session?.creatorSessionId && session.creatorSessionId === sessionId) || Boolean(session?.isOwner);

  const selfParticipant: Participant = {
    id: sessionId || "user-self",
    name: "You",
    isSelf: true,
    isOwner: isOwner,
    status: connectionState === "offline" ? "offline" : "online",
    joinedAt: session?.createdAt || Date.now(),
  };

  const peerParticipant: Participant = {
    id: "user-peer",
    name: "Guest",
    isSelf: false,
    isOwner: !isOwner,
    status: session?.participantCount && session.participantCount > 1 ? "online" : "offline",
    joinedAt: session?.createdAt || Date.now(),
  };

  // Toast Helper
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const triggerToast = useCallback(
    (text: string, type: "info" | "success" | "warning" = "info") => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev.slice(-2), { id, text, type }]);
      setTimeout(() => {
        removeToast(id);
      }, 3500);
    },
    [removeToast]
  );

  // Sound toggle
  const toggleSound = useCallback(() => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setSoundMuted(!next);
    triggerToast(next ? "Audio cues enabled" : "Audio cues muted", "info");
  }, [soundEnabled, triggerToast]);

  // Copy to clipboard
  const copyToClipboard = useCallback(
    async (text: string, label = "Room code copied") => {
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        }
        playCopySuccessSound();
        triggerToast(label, "success");
      } catch {
        triggerToast("Failed to copy", "warning");
      }
    },
    [triggerToast]
  );

  // Navigation
  const goToScreen = useCallback((newScreen: ScreenState) => {
    playSoftClick();
    setScreen(newScreen);
  }, []);

  // Cleanup active Realtime channel
  const cleanupRealtime = useCallback(() => {
    if (realtimeChannelRef.current) {
      const supabase = getSupabaseClient();
      if (supabase) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
      realtimeChannelRef.current = null;
    }
  }, []);

  // Initiate Create Room (Authoritative Backend)
  const initiateCreateRoom = useCallback(
    async (customDurationSeconds?: number): Promise<string> => {
      playSoftClick();
      const duration = customDurationSeconds || roomLifespan || 300;
      const currentSessionId =
        sessionId ||
        (typeof localStorage !== "undefined"
          ? localStorage.getItem("5min_session_id") || "temp"
          : "temp");

      try {
        const res = await fetch("/api/rooms/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: currentSessionId,
            nickname: "Host",
            durationSeconds: duration,
          }),
        });

        const data = await res.json();
        if (!data.success) {
          triggerToast(data.message || "Failed to create room.", "warning");
          return "";
        }

        // Compute server clock skew
        if (data.serverTime) {
          clockSkewRef.current = Date.now() - new Date(data.serverTime).getTime();
        }

        const expiresAtMs = new Date(data.expiresAt).getTime();
        const createdAtMs = new Date(data.createdAt || Date.now()).getTime();
        const actualDuration = data.durationSeconds || duration;
        const remaining = Math.max(
          0,
          Math.floor((expiresAtMs - (Date.now() - clockSkewRef.current)) / 1000)
        );

        const newSession: RoomSession = {
          roomId: data.roomId,
          roomCode: data.roomCode,
          createdAt: createdAtMs,
          durationSeconds: actualDuration,
          expiresAt: expiresAtMs,
          participants: [selfParticipant, peerParticipant],
          participantCount: data.participantCount || 1,
          status: "active",
        };

        setSession(newSession);
        setTimeRemaining(remaining || actualDuration);
        setRoomLifespan(actualDuration);
        setMessages([]);
        setScreen("created");

        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem("5min_active_room", data.roomCode);
        }

        return data.roomCode;
      } catch {
        triggerToast("Network error. Please try again.", "warning");
        return "";
      }
    },
    [sessionId, triggerToast, roomLifespan]
  );

  // Update Room Lifespan
  const updateRoomLifespan = useCallback(
    async (seconds: number) => {
      if (!session) return;
      playSoftClick();

      const createdAtMs = session.createdAt || Date.now();
      const newExpiresAtMs = createdAtMs + seconds * 1000;
      const remaining = Math.max(
        0,
        Math.floor((newExpiresAtMs - (Date.now() - clockSkewRef.current)) / 1000)
      );

      setSession((prev) =>
        prev
          ? {
              ...prev,
              durationSeconds: seconds,
              expiresAt: newExpiresAtMs,
            }
          : null
      );
      setTimeRemaining(remaining);
      setRoomLifespan(seconds);

      try {
        await fetch(`/api/rooms/${session.roomCode}/lifespan`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionId || localStorage.getItem("5min_session_id"),
            durationSeconds: seconds,
          }),
        });
      } catch {
        // Optimistic state remains
      }
    },
    [session, sessionId]
  );

  // Enter room after viewing created code
  const enterCreatedRoom = useCallback(() => {
    if (!session) {
      initiateCreateRoom();
    }
    setScreen("chat");
    playSoftClick();

    setMessages([
      {
        id: `sys-${Date.now()}`,
        senderId: "system",
        senderName: "5MIN",
        isSelf: false,
        content: "Room activated. Private channel with end-of-session auto-dissolve.",
        timestamp: Date.now(),
      },
    ]);
  }, [session, initiateCreateRoom]);

  // Join Room (Authoritative Backend)
  const joinRoom = useCallback(
    async (code: string): Promise<boolean> => {
      const formatted = code.trim().toUpperCase();
      if (!isValidRoomCodeFormat(formatted)) {
        setScreen("invalid");
        return false;
      }

      playSoftClick();
      const currentSessionId =
        sessionId ||
        (typeof localStorage !== "undefined"
          ? localStorage.getItem("5min_session_id") || "temp"
          : "temp");

      try {
        const res = await fetch("/api/rooms/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: formatted,
            sessionId: currentSessionId,
            nickname: "Guest",
          }),
        });

        const data = await res.json();

        if (!data.success) {
          if (data.error === "ROOM_NOT_FOUND") {
            setScreen("invalid");
          } else if (data.error === "ROOM_EXPIRED") {
            triggerToast("This room has already expired.", "warning");
            setScreen("expired");
          } else if (data.error === "ROOM_FULL") {
            triggerToast("This private room is full (max 2 participants).", "warning");
          } else {
            triggerToast(data.message || "Failed to join room.", "warning");
          }
          return false;
        }

        if (data.serverTime) {
          clockSkewRef.current = Date.now() - new Date(data.serverTime).getTime();
        }

        const expiresAtMs = new Date(data.expiresAt).getTime();
        const createdAtMs = new Date(data.createdAt || Date.now()).getTime();
        const remaining = Math.max(
          0,
          Math.floor((expiresAtMs - (Date.now() - clockSkewRef.current)) / 1000)
        );

        const activeSession: RoomSession = {
          roomId: data.roomId,
          roomCode: data.code,
          createdAt: createdAtMs,
          durationSeconds: SESSION_DURATION,
          expiresAt: expiresAtMs,
          participants: [selfParticipant, peerParticipant],
          participantCount: data.participantCount || 2,
          status: "active",
        };

        setSession(activeSession);
        setTimeRemaining(remaining || SESSION_DURATION);
        setMessages([
          {
            id: `sys-${Date.now()}`,
            senderId: "system",
            senderName: "5MIN",
            isSelf: false,
            content: `Connected to room ${formatted}. Session active.`,
            timestamp: Date.now(),
          },
        ]);
        setScreen("chat");
        triggerToast(`Connected to room ${formatted}`, "success");

        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem("5min_active_room", formatted);
        }

        return true;
      } catch {
        triggerToast("Network error. Please try again.", "warning");
        return false;
      }
    },
    [sessionId, triggerToast]
  );

  // Send Message with Image Compression, View-Once & Per-Message TTL
  const sendMessage = useCallback(
    async (
      content: string,
      replyTo?: Message["replyTo"],
      imageFile?: File,
      isViewOnce?: boolean
    ) => {
      const trimmed = content.trim();
      if (!trimmed && !imageFile) return;
      if (!session) return;

      const currentSessionId = sessionId || "user-self";
      const optimisticId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const messageExpiresAt = Date.now() + selectedTtl * 1000;

      let previewUrl: string | undefined;
      let finalImageUrl: string | undefined;
      let finalImagePath: string | undefined;

      // Handle Image Compression & Optimistic State
      if (imageFile) {
        try {
          const compressed = await compressImage(imageFile);
          previewUrl = compressed.previewUrl;

          const optimisticMessage: Message = {
            id: optimisticId,
            senderId: currentSessionId,
            senderName: "You",
            isSelf: true,
            content: trimmed,
            imageUrl: previewUrl,
            isViewOnce: Boolean(isViewOnce),
            expiresAt: messageExpiresAt,
            ttlSeconds: selectedTtl,
            deliveryStatus: "sending",
            uploadProgress: 35,
            timestamp: Date.now(),
            replyTo,
          };

          setMessages((prev) => [...prev, optimisticMessage]);
          playSendMessageSound();

          // Upload image to backend
          const formData = new FormData();
          formData.append("file", compressed.file);
          formData.append("sessionId", currentSessionId);

          const uploadRes = await fetch(`/api/rooms/${session.roomCode}/upload`, {
            method: "POST",
            body: formData,
          });

          const uploadData = await uploadRes.json();
          if (!uploadData.success) {
            triggerToast(uploadData.message || "Image upload failed.", "warning");
            setMessages((prev) =>
              prev.map((m) =>
                m.id === optimisticId ? { ...m, deliveryStatus: "failed" } : m
              )
            );
            return;
          }

          finalImageUrl = uploadData.imageUrl;
          finalImagePath = uploadData.imagePath;

          // Update progress
          setMessages((prev) =>
            prev.map((m) =>
              m.id === optimisticId
                ? { ...m, uploadProgress: 100, imageUrl: finalImageUrl, imagePath: finalImagePath }
                : m
            )
          );
        } catch (err: any) {
          triggerToast(err.message || "Failed to process image.", "warning");
          return;
        }
      } else {
        // Plain text message
        const optimisticMessage: Message = {
          id: optimisticId,
          senderId: currentSessionId,
          senderName: "You",
          isSelf: true,
          content: trimmed,
          expiresAt: messageExpiresAt,
          ttlSeconds: selectedTtl,
          deliveryStatus: "sending",
          timestamp: Date.now(),
          replyTo,
        };

        setMessages((prev) => [...prev, optimisticMessage]);
        playSendMessageSound();
      }

      // Post message metadata to backend
      try {
        const res = await fetch(`/api/rooms/${session.roomCode}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: currentSessionId,
            senderName: "You",
            content: trimmed,
            imageUrl: finalImageUrl,
            imagePath: finalImagePath,
            isViewOnce: Boolean(isViewOnce),
            ttlSeconds: selectedTtl,
            replyTo,
          }),
        });

        const data = await res.json();
        if (!data.success) {
          if (data.error === "ROOM_EXPIRED") {
            triggerToast("Room has expired.", "warning");
            setScreen("expired");
          } else {
            triggerToast(data.message || "Failed to send message.", "warning");
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === optimisticId ? { ...m, deliveryStatus: "failed" } : m
            )
          );
          return;
        }

        // Successfully sent
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId
              ? {
                  ...m,
                  id: data.message?.id || optimisticId,
                  deliveryStatus: "sent",
                  expiresAt: data.message?.expiresAt
                    ? new Date(data.message.expiresAt).getTime()
                    : messageExpiresAt,
                }
              : m
          )
        );

        // Offline mock response fallback
        if (data.mode === "offline_mock") {
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          if (replyTimeoutRef.current) clearTimeout(replyTimeoutRef.current);

          const typingDelay = 1000 + Math.random() * 800;
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(true);

            const responseDelay = 1500 + Math.random() * 900;
            replyTimeoutRef.current = setTimeout(() => {
              setIsTyping(false);

              const responseText =
                INITIAL_PEER_RESPONSES[
                  peerResponseIndex.current % INITIAL_PEER_RESPONSES.length
                ];
              peerResponseIndex.current += 1;

              const peerMessage: Message = {
                id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                senderId: "user-peer",
                senderName: "Guest",
                isSelf: false,
                content: responseText,
                expiresAt: Date.now() + selectedTtl * 1000,
                ttlSeconds: selectedTtl,
                deliveryStatus: "delivered",
                timestamp: Date.now(),
              };

              setMessages((prev) => [...prev, peerMessage]);
              playReceiveMessageSound();
            }, responseDelay);
          }, typingDelay);
        }
      } catch {
        triggerToast("Failed to send message.", "warning");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId ? { ...m, deliveryStatus: "failed" } : m
          )
        );
      }
    },
    [session, sessionId, selectedTtl, triggerToast]
  );

  // Retry a failed message
  const retrySendMessage = useCallback(
    async (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg) return;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, deliveryStatus: "sending" } : m
        )
      );

      await sendMessage(msg.content, msg.replyTo);
    },
    [messages, sendMessage]
  );

  // Broadcast typing indicator
  const broadcastTyping = useCallback(
    (typing: boolean) => {
      if (!session || !realtimeChannelRef.current) return;
      realtimeChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { sessionId, isTyping: typing },
      });
    },
    [session, sessionId]
  );

  // Add Reaction
  const addReaction = useCallback(
    (messageId: string, emoji: string) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;

          const currentReactions = msg.reactions || [];
          const existingIdx = currentReactions.findIndex((r) => r.emoji === emoji);

          let updatedReactions;
          if (existingIdx >= 0) {
            const existing = currentReactions[existingIdx];
            const hasUser = existing.users.includes(sessionId || "user-self");
            if (hasUser) {
              const newUsers = existing.users.filter((u) => u !== (sessionId || "user-self"));
              if (newUsers.length === 0) {
                updatedReactions = currentReactions.filter((r) => r.emoji !== emoji);
              } else {
                updatedReactions = [...currentReactions];
                updatedReactions[existingIdx] = {
                  ...existing,
                  count: existing.count - 1,
                  users: newUsers,
                };
              }
            } else {
              updatedReactions = [...currentReactions];
              updatedReactions[existingIdx] = {
                ...existing,
                count: existing.count + 1,
                users: [...existing.users, sessionId || "user-self"],
              };
            }
          } else {
            updatedReactions = [
              ...currentReactions,
              {
                emoji,
                count: 1,
                users: [sessionId || "user-self"],
              },
            ];
          }

          return {
            ...msg,
            reactions: updatedReactions,
          };
        })
      );
      playSoftClick();
    },
    [sessionId]
  );

  // Leave room
  const leaveRoom = useCallback(() => {
    cleanupRealtime();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (replyTimeoutRef.current) clearTimeout(replyTimeoutRef.current);
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("5min_active_room");
    }
    setIsTyping(false);
    setScreen("landing");
    setSession(null);
    setMessages([]);
    setTimeRemaining(SESSION_DURATION);
    playSoftClick();
  }, [cleanupRealtime]);

  // Reset to home
  const resetToHome = useCallback(() => {
    cleanupRealtime();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (replyTimeoutRef.current) clearTimeout(replyTimeoutRef.current);
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("5min_active_room");
    }
    setIsTyping(false);
    setScreen("landing");
    setSession(null);
    setMessages([]);
    setTimeRemaining(SESSION_DURATION);
  }, [cleanupRealtime]);

  // Create another room
  const createAnotherRoom = useCallback(() => {
    cleanupRealtime();
    initiateCreateRoom();
  }, [cleanupRealtime, initiateCreateRoom]);

  // Copy Invite Link
  const copyInviteLink = useCallback(async () => {
    if (!session) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteUrl = `${origin}/?join=${session.roomCode}`;
    await copyToClipboard(inviteUrl, "Invite link copied to clipboard");
  }, [session, copyToClipboard]);

  // Delete own message
  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!session) return;
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current.send({
          type: "broadcast",
          event: "message_deleted",
          payload: { messageId },
        });
      }
      await fetch(
        `/api/rooms/${session.roomCode}/message/${messageId}?sessionId=${sessionId || "temp"}`,
        { method: "DELETE" }
      ).catch(() => {});
      triggerToast("Message deleted.", "info");
    },
    [session, sessionId, triggerToast]
  );

  // Mark View-Once Opened
  const markViewOnceOpened = useCallback(
    async (messageId: string) => {
      if (!session) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, viewedAt: Date.now(), imageUrl: null, content: "[Photo Disappeared]" }
            : m
        )
      );
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current.send({
          type: "broadcast",
          event: "view_once_opened",
          payload: { messageId },
        });
      }
      await fetch(`/api/rooms/${session.roomCode}/view-once`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, sessionId: sessionId || "temp" }),
      }).catch(() => {});
    },
    [session, sessionId]
  );

  // Update Room Privacy Settings
  const updateRoomSettings = useCallback(
    async (settings: {
      allowImages?: boolean;
      allowReactions?: boolean;
      allowReplies?: boolean;
      durationSeconds?: number;
    }) => {
      if (!session) return;
      setSession((prev) => (prev ? { ...prev, ...settings } : null));
      if (settings.durationSeconds) {
        updateRoomLifespan(settings.durationSeconds);
      }
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current.send({
          type: "broadcast",
          event: "settings_updated",
          payload: settings,
        });
      }
      await fetch(`/api/rooms/${session.roomCode}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId || "temp",
          ...settings,
        }),
      }).catch(() => {});
      triggerToast("Privacy settings updated.", "success");
    },
    [session, sessionId, updateRoomLifespan, triggerToast]
  );

  // Emergency Destroy Room
  const destroyRoom = useCallback(async () => {
    if (!session) return;
    try {
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current.send({
          type: "broadcast",
          event: "room_destroyed",
          payload: { roomCode: session.roomCode },
        });
      }
      await fetch(`/api/rooms/${session.roomCode}/destroy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId || "temp" }),
      });
    } finally {
      cleanupRealtime();
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("5min_active_room");
      }
      setMessages([]);
      setSession(null);
      setScreen("landing");
      triggerToast("Room permanently destroyed and all data purged.", "info");
    }
  }, [session, sessionId, cleanupRealtime, triggerToast]);

  // Supabase Realtime Subscription Setup (INSERT, DELETE, status updates)
  useEffect(() => {
    if (screen !== "chat" || !session) {
      cleanupRealtime();
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channelName = `room-${session.roomCode}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: false },
      },
    });

    // 1. Listen for new messages inserted in DB
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: session.roomId ? `room_id=eq.${session.roomId}` : undefined,
      },
      (payload: any) => {
        const newMsg = payload.new;
        if (!newMsg) return;

        // Ignore messages sent by self
        if (newMsg.sender_session_id === sessionId) return;

        const incomingMessage: Message = {
          id: newMsg.id,
          senderId: newMsg.sender_session_id,
          senderName: newMsg.sender_name || "Guest",
          isSelf: false,
          content: newMsg.content,
          imageUrl: newMsg.image_url,
          imagePath: newMsg.image_path,
          isViewOnce: Boolean(newMsg.is_view_once),
          viewedAt: newMsg.viewed_at ? new Date(newMsg.viewed_at).getTime() : null,
          ttlSeconds: newMsg.ttl_seconds,
          expiresAt: newMsg.expires_at ? new Date(newMsg.expires_at).getTime() : undefined,
          deliveryStatus: "delivered",
          timestamp: new Date(newMsg.created_at).getTime(),
          replyTo: newMsg.reply_to,
        };

        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, incomingMessage];
        });
        playReceiveMessageSound();
      }
    );

    // 2. Listen for deleted messages (Real-time expiration)
    channel.on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "messages",
        filter: session.roomId ? `room_id=eq.${session.roomId}` : undefined,
      },
      (payload: any) => {
        const oldId = payload.old?.id;
        if (oldId) {
          setMessages((prev) => prev.filter((m) => m.id !== oldId));
        }
      }
    );

    // 3. Listen for broadcast typing indicator
    channel.on("broadcast", { event: "typing" }, (payload: any) => {
      if (payload.payload?.sessionId !== sessionId) {
        setIsTyping(Boolean(payload.payload?.isTyping));
      }
    });

    // 4. Listen for emergency room destruction
    channel.on("broadcast", { event: "room_destroyed" }, () => {
      cleanupRealtime();
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("5min_active_room");
      }
      setMessages([]);
      setSession(null);
      setScreen("landing");
      triggerToast("This room was destroyed by the host.", "warning");
    });

    // 5. Listen for broadcast message deletion
    channel.on("broadcast", { event: "message_deleted" }, (payload: any) => {
      const { messageId } = payload.payload || {};
      if (messageId) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    });

    // 6. Listen for view-once opened
    channel.on("broadcast", { event: "view_once_opened" }, (payload: any) => {
      const { messageId } = payload.payload || {};
      if (messageId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, viewedAt: Date.now(), imageUrl: null, content: "[Photo Disappeared]" }
              : m
          )
        );
      }
    });

    // 7. Listen for settings updated
    channel.on("broadcast", { event: "settings_updated" }, (payload: any) => {
      const newSettings = payload.payload || {};
      setSession((prev) => (prev ? { ...prev, ...newSettings } : null));
    });

    // 8. Listen for room status updates (e.g. expired)
    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "rooms",
        filter: session.roomId ? `id=eq.${session.roomId}` : undefined,
      },
      (payload: any) => {
        if (payload.new?.status === "expired") {
          playExpiryChime();
          setMessages([]);
          setScreen("expired");
        }
      }
    );

    channel.subscribe();
    realtimeChannelRef.current = channel;

    return () => {
      cleanupRealtime();
    };
  }, [screen, session, sessionId, cleanupRealtime]);

  // Authoritative Room Countdown Timer System
  useEffect(() => {
    if (screen !== "chat" || !session) return;

    const timer = setInterval(() => {
      const nowServerEstimated = Date.now() - clockSkewRef.current;
      const remaining = Math.max(
        0,
        Math.floor((session.expiresAt - nowServerEstimated) / 1000)
      );

      setTimeRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        playExpiryChime();
        cleanupRealtime();
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.removeItem("5min_active_room");
        }
        setTimeout(() => {
          setMessages([]);
          setScreen("expired");
        }, 800);
      } else if (remaining === 60) {
        triggerToast("60 seconds remaining. Room will dissolve soon.", "warning");
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [screen, session, triggerToast, cleanupRealtime]);

  // Per-Message Disappearing Countdown Ticker
  useEffect(() => {
    if (screen !== "chat") return;

    const msgTimer = setInterval(() => {
      const now = Date.now() - clockSkewRef.current;
      setMessages((prev) => {
        const active = prev.filter((m) => !m.expiresAt || m.expiresAt > now);
        if (active.length !== prev.length) {
          return active;
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(msgTimer);
  }, [screen]);

  // Reconnection / Sync handling on tab focus or network recovery
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleSync = async () => {
      if (!session || screen !== "chat") return;
      try {
        const res = await fetch(`/api/rooms/${session.roomCode}/sync?sessionId=${sessionId}`);
        const data = await res.json();

        if (data.status === "expired" || data.timeRemainingSeconds <= 0) {
          playExpiryChime();
          cleanupRealtime();
          setMessages([]);
          setScreen("expired");
        } else if (data.timeRemainingSeconds) {
          setTimeRemaining(data.timeRemainingSeconds);
          if (data.serverTime) {
            clockSkewRef.current = Date.now() - new Date(data.serverTime).getTime();
          }
          if (data.messages && data.messages.length > 0) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const missing = data.messages.filter((m: Message) => !existingIds.has(m.id));
              return missing.length > 0 ? [...prev, ...missing] : prev;
            });
          }
        }
      } catch {
        // Ignore network errors gracefully
      }
    };

    window.addEventListener("focus", handleSync);
    window.addEventListener("online", handleSync);

    return () => {
      window.removeEventListener("focus", handleSync);
      window.removeEventListener("online", handleSync);
    };
  }, [session, screen, sessionId, cleanupRealtime]);

  // URL Auto-Join detection (?join=XXXX-XX or ?code=XXXX-XX)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get("join") || params.get("code");
    if (joinCode && screen === "landing") {
      const formatted = joinCode.trim().toUpperCase();
      if (isValidRoomCodeFormat(formatted)) {
        joinRoom(formatted);
      }
    }
  }, [joinRoom, screen]);

  return (
    <ChatContext.Provider
      value={{
        screen,
        session,
        timeRemaining,
        messages,
        isTyping,
        toasts,
        soundEnabled,
        isExpiringSoon,
        isCriticalExpiring,
        connectionState,
        isOwner,
        selfParticipant,
        peerParticipant,
        selectedTtl,
        setSelectedTtl,
        roomLifespan,
        setRoomLifespan,
        goToScreen,
        initiateCreateRoom,
        updateRoomLifespan,
        enterCreatedRoom,
        joinRoom,
        sendMessage,
        retrySendMessage,
        deleteMessage,
        markViewOnceOpened,
        updateRoomSettings,
        destroyRoom,
        copyInviteLink,
        addReaction,
        copyToClipboard,
        leaveRoom,
        resetToHome,
        createAnotherRoom,
        triggerToast,
        removeToast,
        toggleSound,
        broadcastTyping,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
