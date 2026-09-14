export type ScreenState =
  | "landing"
  | "create"
  | "created"
  | "join"
  | "chat"
  | "expired"
  | "invalid";

export interface Participant {
  id: string;
  name: string;
  isSelf: boolean;
  avatarSeed?: string;
  joinedAt: number;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[]; // participant ids
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  isSelf: boolean;
  content: string;
  timestamp: number;
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
  };
  reactions?: MessageReaction[];
}

export interface RoomSession {
  roomId?: string;
  roomCode: string;
  createdAt: number;
  durationSeconds: number; // 300 seconds (5 minutes)
  expiresAt: number;
  participants: Participant[];
  participantCount?: number;
  status: "active" | "expiring" | "expired";
}

export interface ToastMessage {
  id: string;
  text: string;
  type?: "info" | "success" | "warning";
}

