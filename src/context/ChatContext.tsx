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

const SESSION_DURATION = 300; // 5 minutes in seconds

const INITIAL_PEER_RESPONSES = [
  "Connected. This room disappears in 5 minutes.",
  "Quick question: are we aligned on the private release date?",
  "Understood. Let's keep this completely off-the-record.",
  "Perfect. I'll delete my local notes too once this expires.",
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
  selfParticipant: Participant;
  peerParticipant: Participant;
  goToScreen: (screen: ScreenState) => void;
  initiateCreateRoom: () => Promise<string>;
  enterCreatedRoom: () => void;
  joinRoom: (code: string) => Promise<boolean>;
  sendMessage: (content: string, replyTo?: Message["replyTo"]) => Promise<void>;
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

  // Clock skew tracking (server time vs client local time)
  const clockSkewRef = useRef<number>(0);
  const peerResponseIndex = useRef<number>(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const replyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeChannelRef = useRef<any>(null);

  const isExpiringSoon = timeRemaining <= 60 && timeRemaining > 0;
  const isCriticalExpiring = timeRemaining <= 10 && timeRemaining > 0;

  // Initialize or restore client session identifier
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      let stored = localStorage.getItem("5min_session_id");
      if (!stored) {
        stored = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `sess_${Date.now()}_${Math.random()}`;
        localStorage.setItem("5min_session_id", stored);
      }
      setSessionId(stored);
    } catch {
      setSessionId(`sess_${Date.now()}`);
    }
  }, []);

  const selfParticipant: Participant = {
    id: sessionId || "user-self",
    name: "You",
    isSelf: true,
    joinedAt: session?.createdAt || Date.now(),
  };

  const peerParticipant: Participant = {
    id: "user-peer",
    name: "Guest",
    isSelf: false,
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
  const initiateCreateRoom = useCallback(async (): Promise<string> => {
    playSoftClick();
    const currentSessionId =
      sessionId ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("5min_session_id") || "temp"
        : "temp");

    try {
      const res = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSessionId, nickname: "Host" }),
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
      const remaining = Math.max(
        0,
        Math.floor((expiresAtMs - (Date.now() - clockSkewRef.current)) / 1000)
      );

      const newSession: RoomSession = {
        roomId: data.roomId,
        roomCode: data.roomCode,
        createdAt: createdAtMs,
        durationSeconds: SESSION_DURATION,
        expiresAt: expiresAtMs,
        participants: [selfParticipant, peerParticipant],
        participantCount: data.participantCount || 1,
        status: "active",
      };

      setSession(newSession);
      setTimeRemaining(remaining || SESSION_DURATION);
      setMessages([]);
      setScreen("created");

      // Save to sessionStorage for refresh resilience
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("5min_active_room", data.roomCode);
      }

      return data.roomCode;
    } catch {
      triggerToast("Network error. Please try again.", "warning");
      return "";
    }
  }, [sessionId, triggerToast]);

  // Enter room after viewing created code
  const enterCreatedRoom = useCallback(() => {
    if (!session) {
      initiateCreateRoom();
    }
    setScreen("chat");
    playSoftClick();

    // Initial greeting
    setMessages([
      {
        id: `sys-${Date.now()}`,
        senderId: "system",
        senderName: "5MIN",
        isSelf: false,
        content: "Room activated. All messages disappear when the 5-minute timer expires.",
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

        // Server clock skew
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
            content: `Connected to room ${formatted}. Session active for 5 minutes.`,
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

  // Send Message (Authoritative Backend & Realtime)
  const sendMessage = useCallback(
    async (content: string, replyTo?: Message["replyTo"]) => {
      const trimmed = content.trim();
      if (!trimmed || !session) return;

      const currentSessionId = sessionId || "user-self";
      const optimisticId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const userMessage: Message = {
        id: optimisticId,
        senderId: currentSessionId,
        senderName: "You",
        isSelf: true,
        content: trimmed,
        timestamp: Date.now(),
        replyTo,
      };

      // Optimistic append
      setMessages((prev) => [...prev, userMessage]);
      playSendMessageSound();

      try {
        const res = await fetch(`/api/rooms/${session.roomCode}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: currentSessionId,
            senderName: "You",
            content: trimmed,
            replyTo,
          }),
        });

        const data = await res.json();
        if (!data.success) {
          if (data.error === "ROOM_EXPIRED") {
            triggerToast("Room has expired. Message could not be sent.", "warning");
            setScreen("expired");
          } else {
            triggerToast(data.message || "Failed to send message.", "warning");
          }
          return;
        }

        // If in offline mock mode (no Supabase configured), simulate peer response as fallback
        if (data.mode === "offline_mock") {
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          if (replyTimeoutRef.current) clearTimeout(replyTimeoutRef.current);

          const typingDelay = 1200 + Math.random() * 1000;
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(true);

            const responseDelay = 1800 + Math.random() * 1000;
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
                timestamp: Date.now(),
              };

              setMessages((prev) => [...prev, peerMessage]);
              playReceiveMessageSound();
            }, responseDelay);
          }, typingDelay);
        }
      } catch {
        triggerToast("Failed to send message.", "warning");
      }
    },
    [session, sessionId, triggerToast]
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
  const addReaction = useCallback((messageId: string, emoji: string) => {
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
  }, [sessionId]);

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

  // Supabase Realtime Subscription Setup
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

        const isFromSelf = newMsg.sender_session_id === sessionId;
        if (isFromSelf) return; // already added optimistically

        const incomingMessage: Message = {
          id: newMsg.id,
          senderId: newMsg.sender_session_id,
          senderName: newMsg.sender_name || "Guest",
          isSelf: false,
          content: newMsg.content,
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

    // 2. Listen for broadcast typing indicator
    channel.on("broadcast", { event: "typing" }, (payload: any) => {
      if (payload.payload?.sessionId !== sessionId) {
        setIsTyping(Boolean(payload.payload?.isTyping));
      }
    });

    // 3. Listen for room status updates (e.g. expired)
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

  // Authoritative Countdown Timer System
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
        selfParticipant,
        peerParticipant,
        goToScreen,
        initiateCreateRoom,
        enterCreatedRoom,
        joinRoom,
        sendMessage,
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
