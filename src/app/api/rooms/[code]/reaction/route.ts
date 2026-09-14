import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const ALLOWED_EMOJIS = ["❤️", "😂", "👍", "🔥", "😮", "😢"];

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const body = await req.json().catch(() => ({}));
    const { sessionId, messageId, emoji } = body;

    if (!sessionId || !messageId || !emoji) {
      return NextResponse.json(
        { success: false, error: "INVALID_REQUEST", message: "Missing required fields." },
        { status: 400 }
      );
    }

    if (!ALLOWED_EMOJIS.includes(emoji)) {
      return NextResponse.json(
        { success: false, error: "INVALID_EMOJI", message: "Unsupported emoji." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ success: true, mode: "offline_mock" });
    }

    const normalizedCode = code.trim().toUpperCase();

    // 1. Verify active room & check allow_reactions
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (roomErr || !room) {
      return NextResponse.json(
        { success: false, error: "ROOM_NOT_FOUND", message: "Room not found." },
        { status: 404 }
      );
    }

    if (room.status === "expired" || new Date() >= new Date(room.expires_at)) {
      return NextResponse.json(
        { success: false, error: "ROOM_EXPIRED", message: "This room has expired." },
        { status: 410 }
      );
    }

    if (room.allow_reactions === false) {
      return NextResponse.json(
        { success: false, error: "REACTIONS_DISABLED", message: "Reactions are disabled in this room." },
        { status: 403 }
      );
    }

    // 2. Fetch message reactions
    const { data: msg, error: msgErr } = await supabase
      .from("messages")
      .select("id, reactions")
      .eq("id", messageId)
      .eq("room_id", room.id)
      .maybeSingle();

    if (msgErr || !msg) {
      return NextResponse.json(
        { success: false, error: "MESSAGE_NOT_FOUND", message: "Message not found." },
        { status: 404 }
      );
    }

    let reactions: any[] = Array.isArray(msg.reactions) ? [...msg.reactions] : [];
    const existingIndex = reactions.findIndex((r) => r.emoji === emoji);

    if (existingIndex > -1) {
      const userList = reactions[existingIndex].users || [];
      const hasReacted = userList.includes(sessionId);

      if (hasReacted) {
        // Toggle OFF
        const updatedUsers = userList.filter((u: string) => u !== sessionId);
        if (updatedUsers.length === 0) {
          reactions.splice(existingIndex, 1);
        } else {
          reactions[existingIndex] = {
            emoji,
            count: updatedUsers.length,
            users: updatedUsers,
          };
        }
      } else {
        // Toggle ON
        const updatedUsers = [...userList, sessionId];
        reactions[existingIndex] = {
          emoji,
          count: updatedUsers.length,
          users: updatedUsers,
        };
      }
    } else {
      // Add new reaction entry
      reactions.push({
        emoji,
        count: 1,
        users: [sessionId],
      });
    }

    await supabase
      .from("messages")
      .update({ reactions })
      .eq("id", messageId);

    return NextResponse.json({
      success: true,
      messageId,
      reactions,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to update reaction." },
      { status: 500 }
    );
  }
}
