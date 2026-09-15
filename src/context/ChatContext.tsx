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
  CreateRoomOptions,
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
  "Connected. This room disappears when timer runs out.",
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
  userNickname: string;
  setUserNickname: (name: string) => void;
  selfParticipant: Participant;
  peerParticipant: Participant;
  participants: Participant[];
  selectedTtl: number;
  setSelectedTtl: (seconds: number) => void;
  roomLifespan: number;
  setRoomLifespan: (seconds: number) => void;
  goToScreen: (screen: ScreenState) => void;
  initiateCreateRoom: (options?: number | CreateRoomOptions) => Promise<string>;
  updateRoomLifespan: (seconds: number) => Promise<void>;
  enterCreatedRoom: () => void;
  joinRoom: (code: string, nickname?: string) => Promise<boolean>;
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
    allowViewOnce?: boolean;
    durationSeconds?: number;
    maxParticipants?: number;
  }) => Promise<void>;
  kickParticipant: (targetSessionId: string) => Promise<void>;
  revokeInvite: () => Promise<void>;
  markMessagesAsSeen: () => void;
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
  const [userNickname, setUserNickname] = useState<string>("Host");
  const [participants, setParticipants] = useState<Participant[]>([]);
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
    const handleOnline = () => setConnectionState("connected");
    const handleOffline = () => setConnectionState("offline");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Initialize or restore anonymous session identity
  useEffect(() => {
    try {
      let stored = localStorage.getItem("5min_session_id");
      if (!stored) {
        stored = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
    sessionId: sessionId || "user-self",
    name: userNickname || "You",
    isSelf: true,
    isOwner: isOwner,
    status: connectionState === "offline" ? "offline" : "online",
    joinedAt: session?.createdAt || Date.now(),
  };

  const peerParticipant: Participant = {
    id: "user-peer",
    sessionId: "user-peer",
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
    async (options?: number | CreateRoomOptions): Promise<string> => {
      playSoftClick();

      let duration = roomLifespan || 300;
      let payloadOptions: any = {};

      if (typeof options === "number") {
        duration = options;
      } else if (typeof options === "object" && options !== null) {
        duration = options.durationSeconds || duration;
        payloadOptions = options;
      }

      const currentSessionId =
        sessionId ||
        (typeof localStorage !== "undefined"
          ? localStorage.getItem("5min_session_id") || "temp"
          : "temp");

      const hostName = payloadOptions.nickname || userNickname || "Host";
      setUserNickname(hostName);

      try {
        const res = await fetch("/api/rooms/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: currentSessionId,
            nickname: hostName,
            durationSeconds: duration,
            defaultMessageTtl: payloadOptions.defaultMessageTtl,
            defaultPhotoTtl: payloadOptions.defaultPhotoTtl,
            allowImages: payloadOptions.allowImages,
            allowReactions: payloadOptions.allowReactions,
            allowReplies: payloadOptions.allowReplies,
            allowViewOnce: payloadOptions.allowViewOnce,
            maxParticipants: payloadOptions.maxParticipants,
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
          participants: [
            {
              id: currentSessionId,
              sessionId: currentSessionId,
              name: hostName,
              isSelf: true,
              isOwner: true,
              joinedAt: createdAtMs,
              status: "online",
            },
          ],
          participantCount: data.participantCount || 1,
          maxParticipants: data.maxParticipants || 2,
          allowImages: data.allowImages ?? true,
          allowReactions: data.allowReactions ?? true,
          allowReplies: data.allowReplies ?? true,
          allowViewOnce: data.allowViewOnce ?? true,
          defaultMessageTtl: data.defaultMessageTtl,
          defaultPhotoTtl: data.defaultPhotoTtl,
          status: "active",
          isOwner: true,
          creatorSessionId: currentSessionId,
        };

        setSession(newSession);
        setTimeRemaining(remaining || actualDuration);
        setRoomLifespan(actualDuration);
        if (data.defaultMessageTtl) {
          setSelectedTtl(data.defaultMessageTtl);
        }
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
    [sessionId, triggerToast, roomLifespan, userNickname]
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
            sessionId,
            durationSeconds: seconds,
          }),
        });
      } catch {
        // Keep optimistic state
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
        content: "Room activated. Content auto-dissolves upon expiration.",
        timestamp: Date.now(),
      },
    ]);
  }, [session, initiateCreateRoom]);

  // Join Room (Authoritative Backend)
  const joinRoom = useCallback(
    async (code: string, nickname?: string): Promise<boolean> => {
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

      const joinNickname = nickname || userNickname || "Guest";
      setUserNickname(joinNickname);

      try {
        const res = await fetch("/api/rooms/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: formatted,
            sessionId: currentSessionId,
            nickname: joinNickname,
          }),
        });

        const data = await res.json();

        if (!data.success) {
          if (data.error === "ROOM_NOT_FOUND") {
            setScreen("invalid");
          } else if (data.error === "ROOM_EXPIRED") {
            triggerToast("This room has already expired.", "warning");
            setScreen("expired");
          } else if (data.error === "INVITE_REVOKED") {
            triggerToast("This room invitation has been revoked by the owner.", "warning");
          } else if (data.error === "ROOM_FULL") {
            triggerToast(data.message || "This private room has reached maximum capacity.", "warning");
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

        const newSession: RoomSession = {
          roomId: data.roomId,
          roomCode: data.code,
          createdAt: createdAtMs,
          durationSeconds: Math.floor((expiresAtMs - createdAtMs) / 1000) || 300,
          expiresAt: expiresAtMs,
          participants: [
            {
              id: currentSessionId,
              sessionId: currentSessionId,
              name: joinNickname,
              isSelf: true,
              isOwner: false,
              joinedAt: Date.now(),
              status: "online",
            },
          ],
          participantCount: data.participantCount || 2,
          maxParticipants: data.maxParticipants || 2,
          allowImages: data.allowImages ?? true,
          allowReactions: data.allowReactions ?? true,
          allowReplies: data.allowReplies ?? true,
          allowViewOnce: data.allowViewOnce ?? true,
          defaultMessageTtl: data.defaultMessageTtl,
          defaultPhotoTtl: data.defaultPhotoTtl,
          status: "active",
          isOwner: false,
        };

        setSession(newSession);
        setTimeRemaining(remaining);
        if (data.defaultMessageTtl) {
          setSelectedTtl(data.defaultMessageTtl);
        }
        setMessages([
          {
            id: `sys-${Date.now()}`,
            senderId: "system",
            senderName: "5MIN",
            isSelf: false,
            content: `Connected as ${joinNickname}. Private channel with end-of-session auto-dissolve.`,
            timestamp: Date.now(),
          },
        ]);
        setScreen("chat");

        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem("5min_active_room", data.code);
        }

        return true;
      } catch {
        triggerToast("Failed to connect to room server.", "warning");
        return false;
      }
    },
    [sessionId, userNickname, triggerToast]
  );

  // Send Message (Authoritative Backend)
  const sendMessage = useCallback(
    async (
      content: string,
      replyTo?: Message["replyTo"],
      imageFile?: File,
      isViewOnce?: boolean
    ) => {
      if (!session) return;
      if (!content.trim() && !imageFile) return;

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const serverEstimatedTime = Date.now() - clockSkewRef.current;
      const ttlSec = selectedTtl || 300;
      const expiresAt = serverEstimatedTime + ttlSec * 1000;

      let optimisticImageUrl: string | null = null;
      if (imageFile) {
        optimisticImageUrl = URL.createObjectURL(imageFile);
      }

      // Optimistic message entry
      const optimisticMessage: Message = {
        id: tempId,
        senderId: sessionId || "temp",
        senderName: userNickname || "You",
        isSelf: true,
        content: content.trim(),
        imageUrl: optimisticImageUrl,
        isViewOnce: Boolean(isViewOnce),
        ttlSeconds: ttlSec,
        expiresAt: expiresAt,
        deliveryStatus: "sending",
        timestamp: serverEstimatedTime,
        replyTo: replyTo || null,
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      playSendMessageSound();

      try {
        const currentSessionId =
          sessionId ||
          (typeof window !== "undefined" ? localStorage.getItem("5min_session_id") : null) ||
          session.creatorSessionId ||
          "temp";

        let uploadedImageUrl = null;
        let uploadedImagePath = null;

        // 1. Upload photo if present
        if (imageFile) {
          const compressed = await compressImage(imageFile);

          const formData = new FormData();
          formData.append("file", compressed.file);
          formData.append("sessionId", currentSessionId);

          const uploadRes = await fetch(`/api/rooms/${session.roomCode}/upload`, {
            method: "POST",
            body: formData,
          });

          const uploadData = await uploadRes.json();
          if (!uploadData.success) {
            setMessages((prev) =>
              prev.map((m) => (m.id === tempId ? { ...m, deliveryStatus: "failed" } : m))
            );
            triggerToast(uploadData.message || "Failed to upload image.", "warning");
            return;
          }

          uploadedImageUrl = uploadData.imageUrl;
          uploadedImagePath = uploadData.imagePath;
        }

        // 2. Post message to backend
        const res = await fetch(`/api/rooms/${session.roomCode}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: currentSessionId,
            senderName: userNickname || "You",
            content: content.trim(),
            imageUrl: uploadedImageUrl,
            imagePath: uploadedImagePath,
            isViewOnce: Boolean(isViewOnce),
            ttlSeconds: ttlSec,
            replyTo: replyTo || null,
          }),
        });

        const data = await res.json();
        if (!data.success) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, deliveryStatus: "failed" } : m))
          );
          triggerToast(data.message || "Message failed to send.", "warning");
          return;
        }

        // Update optimistic message with authoritative backend record
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  id: data.message.id,
                  deliveryStatus: "sent",
                  imageUrl: data.message.imageUrl || m.imageUrl,
                  imagePath: data.message.imagePath || m.imagePath,
                  expiresAt: data.message.expiresAt
                    ? new Date(data.message.expiresAt).getTime()
                    : m.expiresAt,
                }
              : m
          )
        );
      } catch (err) {
        console.error("[sendMessage error]", err);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, deliveryStatus: "failed" } : m))
        );
        triggerToast("Failed to send message. Please check connection.", "warning");
      }
    },
    [session, sessionId, selectedTtl, userNickname, triggerToast]
  );

  // Retry sending failed message
  const retrySendMessage = useCallback(
    async (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg || !session) return;

      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, deliveryStatus: "sending" } : m))
      );

      try {
        const currentSessionId =
          sessionId ||
          (typeof window !== "undefined" ? localStorage.getItem("5min_session_id") : null) ||
          session.creatorSessionId ||
          "temp";

        const res = await fetch(`/api/rooms/${session.roomCode}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: currentSessionId,
            senderName: userNickname || "You",
            content: msg.content,
            imageUrl: msg.imageUrl,
            imagePath: msg.imagePath,
            isViewOnce: msg.isViewOnce,
            ttlSeconds: msg.ttlSeconds,
            replyTo: msg.replyTo,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    id: data.message.id,
                    deliveryStatus: "sent",
                  }
                : m
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, deliveryStatus: "failed" } : m))
          );
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, deliveryStatus: "failed" } : m))
        );
      }
    },
    [messages, session, sessionId, userNickname]
  );

  // Delete message permanently
  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!session) return;
      setMessages((prev) => prev.filter((m) => m.id !== messageId));

      try {
        if (realtimeChannelRef.current) {
          realtimeChannelRef.current.send({
            type: "broadcast",
            event: "message_deleted",
            payload: { messageId },
          });
        }
        await fetch(`/api/rooms/${session.roomCode}/message/${messageId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionId || "temp" }),
        });
        triggerToast("Message deleted", "info");
      } catch {
        // Deletion optimistic
      }
    },
    [session, sessionId, triggerToast]
  );

  // Mark View-Once Photo Opened & Burned
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

      try {
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
          body: JSON.stringify({
            sessionId: sessionId || "temp",
            messageId,
          }),
        });
      } catch {
        // Burn state preserved locally
      }
    },
    [session, sessionId]
  );

  // Add / Toggle Reaction
  const addReaction = useCallback(
    (messageId: string, emoji: string) => {
      let updatedReactions: any[] = [];

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;

          const currentReactions = msg.reactions || [];
          const existingIdx = currentReactions.findIndex((r) => r.emoji === emoji);

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

      if (session) {
        fetch(`/api/rooms/${session.roomCode}/reaction`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, messageId, emoji }),
        }).catch(() => {});

        if (realtimeChannelRef.current) {
          realtimeChannelRef.current.send({
            type: "broadcast",
            event: "reaction_updated",
            payload: { messageId, reactions: updatedReactions },
          });
        }
      }
    },
    [sessionId, session]
  );

  // Broadcast Typing Indicator
  const broadcastTyping = useCallback(
    (typing: boolean) => {
      if (!session || !realtimeChannelRef.current) return;
      try {
        realtimeChannelRef.current.send({
          type: "broadcast",
          event: "typing",
          payload: { sessionId, isTyping: typing },
        });
      } catch {
        // Ignore broadcast failure
      }
    },
    [session, sessionId]
  );

  // Mark Messages as Seen
  const markMessagesAsSeen = useCallback(() => {
    if (!session || screen !== "chat" || !realtimeChannelRef.current) return;
    try {
      realtimeChannelRef.current.send({
        type: "broadcast",
        event: "messages_seen",
        payload: { seenBySessionId: sessionId },
      });
    } catch {}
  }, [session, screen, sessionId]);

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
    setScreen("create");
  }, [cleanupRealtime]);

  // Copy Invite Link
  const copyInviteLink = useCallback(async () => {
    if (!session) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteUrl = `${origin}/?join=${session.roomCode}`;
    await copyToClipboard(inviteUrl, "Direct invite link copied to clipboard");
  }, [session, copyToClipboard]);

  // Host Kick Participant
  const kickParticipant = useCallback(
    async (targetSessionId: string) => {
      if (!session || !isOwner) return;
      try {
        if (realtimeChannelRef.current) {
          realtimeChannelRef.current.send({
            type: "broadcast",
            event: "participant_kicked",
            payload: { targetSessionId },
          });
        }
        await fetch(`/api/rooms/${session.roomCode}/kick`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerSessionId: sessionId,
            targetSessionId,
          }),
        });
        setParticipants((prev) => prev.filter((p) => p.sessionId !== targetSessionId));
        triggerToast("Participant removed from room.", "info");
      } catch {
        triggerToast("Failed to remove participant.", "warning");
      }
    },
    [session, isOwner, sessionId, triggerToast]
  );

  // Host Revoke Invite Code
  const revokeInvite = useCallback(async () => {
    if (!session || !isOwner) return;
    try {
      await fetch(`/api/rooms/${session.roomCode}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          isInviteRevoked: true,
        }),
      });
      setSession((prev) => (prev ? { ...prev, isInviteRevoked: true } : null));
      triggerToast("Room invitation revoked. New participants cannot join.", "info");
    } catch {
      triggerToast("Failed to revoke invite.", "warning");
    }
  }, [session, isOwner, sessionId, triggerToast]);

  // Update Room Settings
  const updateRoomSettings = useCallback(
    async (settings: {
      allowImages?: boolean;
      allowReactions?: boolean;
      allowReplies?: boolean;
      allowViewOnce?: boolean;
      durationSeconds?: number;
      maxParticipants?: number;
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

  // Supabase Realtime Subscription Setup (Presence, Broadcast, Postgres Changes)
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
        presence: { key: sessionId || "user" },
      },
    });

    // 1. Presence synchronization
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const onlineUsers: Participant[] = [];
      Object.keys(state).forEach((key) => {
        const pList: any = state[key];
        if (pList && pList[0]) {
          onlineUsers.push({
            id: key,
            sessionId: key,
            name: pList[0].name || "Guest",
            isSelf: key === sessionId,
            isOwner: Boolean(pList[0].isOwner),
            joinedAt: pList[0].joinedAt || Date.now(),
            status: "online",
          });
        }
      });
      if (onlineUsers.length > 0) {
        setParticipants(onlineUsers);
        // Mark own sending messages as delivered if peer present
        if (onlineUsers.length > 1) {
          setMessages((prev) =>
            prev.map((m) =>
              m.isSelf && m.deliveryStatus === "sent" ? { ...m, deliveryStatus: "delivered" } : m
            )
          );
        }
      }
    });

    // 2. Listen for new messages inserted in DB
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

        // Broadcast seen receipt if user is actively on chat screen
        channel.send({
          type: "broadcast",
          event: "messages_seen",
          payload: { seenBySessionId: sessionId },
        });
      }
    );

    // 3. Listen for deleted messages
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

    // 4. Listen for typing indicator
    channel.on("broadcast", { event: "typing" }, (payload: any) => {
      if (payload.payload?.sessionId !== sessionId) {
        setIsTyping(Boolean(payload.payload?.isTyping));
      }
    });

    // 5. Listen for emergency room destruction
    channel.on("broadcast", { event: "room_destroyed" }, () => {
      cleanupRealtime();
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("5min_active_room");
      }
      setMessages([]);
      setSession(null);
      setScreen("landing");
      triggerToast("This room was permanently destroyed by the host.", "warning");
    });

    // 6. Listen for broadcast message deletion
    channel.on("broadcast", { event: "message_deleted" }, (payload: any) => {
      const { messageId } = payload.payload || {};
      if (messageId) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    });

    // 7. Listen for view-once opened
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

    // 8. Listen for reaction updates
    channel.on("broadcast", { event: "reaction_updated" }, (payload: any) => {
      const { messageId, reactions } = payload.payload || {};
      if (messageId && reactions) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
        );
      }
    });

    // 9. Listen for messages seen receipt
    channel.on("broadcast", { event: "messages_seen" }, (payload: any) => {
      const { seenBySessionId } = payload.payload || {};
      if (seenBySessionId && seenBySessionId !== sessionId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.isSelf ? { ...m, deliveryStatus: "seen", seenAt: Date.now() } : m
          )
        );
      }
    });

    // 10. Listen for participant kick
    channel.on("broadcast", { event: "participant_kicked" }, (payload: any) => {
      const { targetSessionId } = payload.payload || {};
      if (targetSessionId === sessionId) {
        cleanupRealtime();
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.removeItem("5min_active_room");
        }
        setSession(null);
        setMessages([]);
        setScreen("landing");
        triggerToast("You were removed from this room by the host.", "warning");
      } else if (targetSessionId) {
        setParticipants((prev) => prev.filter((p) => p.sessionId !== targetSessionId));
      }
    });

    // 11. Listen for settings updated
    channel.on("broadcast", { event: "settings_updated" }, (payload: any) => {
      const newSettings = payload.payload || {};
      setSession((prev) => (prev ? { ...prev, ...newSettings } : null));
    });

    // 12. Subscribe and track presence
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setConnectionState("connected");
        await channel.track({
          name: userNickname,
          isOwner,
          joinedAt: Date.now(),
        });
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setConnectionState("reconnecting");
      } else if (status === "CLOSED") {
        setConnectionState("offline");
      }
    });

    realtimeChannelRef.current = channel;

    return () => {
      cleanupRealtime();
    };
  }, [screen, session, sessionId, userNickname, isOwner, cleanupRealtime, triggerToast]);

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
          if (data.participants) {
            setParticipants(data.participants);
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
        userNickname,
        setUserNickname,
        selfParticipant,
        peerParticipant,
        participants,
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
        kickParticipant,
        revokeInvite,
        markMessagesAsSeen,
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
