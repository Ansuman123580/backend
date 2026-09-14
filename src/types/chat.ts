export type ScreenState =
  | "landing"
  | "create"
  | "created"
  | "join"
  | "chat"
  | "expired"
  | "invalid";

export type ConnectionState = "connected" | "reconnecting" | "offline";

export interface Participant {
  id: string;
  name: string;
  isSelf: boolean;
  isOwner?: boolean;
  avatarSeed?: string;
  joinedAt: number;
  status?: "online" | "offline";
  sessionId?: string;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[]; // participant ids / session ids
}

export type DeliveryStatus = "sending" | "sent" | "delivered" | "seen" | "failed";

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  isSelf: boolean;
  content: string;
  timestamp: number;
  imageUrl?: string | null;
  imagePath?: string | null;
  isViewOnce?: boolean;
  viewedAt?: number | null;
  seenAt?: number | null;
  deliveredAt?: number | null;
  isDeleted?: boolean;
  expiresAt?: number;
  ttlSeconds?: number;
  deliveryStatus?: DeliveryStatus;
  uploadProgress?: number;
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
  } | null;
  reactions?: MessageReaction[];
}

export interface CreateRoomOptions {
  durationSeconds: number;
  defaultMessageTtl?: number | null;
  defaultPhotoTtl?: number | null;
  allowImages?: boolean;
  allowReactions?: boolean;
  allowReplies?: boolean;
  allowViewOnce?: boolean;
  maxParticipants?: number;
  nickname?: string;
}

export interface RoomSession {
  roomId?: string;
  roomCode: string;
  createdAt: number;
  durationSeconds: number;
  expiresAt: number;
  participants: Participant[];
  participantCount?: number;
  status: "active" | "expiring" | "expired";
  isOwner?: boolean;
  creatorSessionId?: string;
  allowImages?: boolean;
  allowReactions?: boolean;
  allowReplies?: boolean;
  allowViewOnce?: boolean;
  maxParticipants?: number;
  defaultMessageTtl?: number | null;
  defaultPhotoTtl?: number | null;
  isInviteRevoked?: boolean;
}

export interface ToastMessage {
  id: string;
  text: string;
  type?: "info" | "success" | "warning";
}
