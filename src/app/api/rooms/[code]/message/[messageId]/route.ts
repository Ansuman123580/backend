import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { code: string; messageId: string } }
) {
  try {
    const { code, messageId } = params;
    const sessionId = req.nextUrl.searchParams.get("sessionId");

    if (!code || !messageId || !sessionId) {
      return NextResponse.json(
        { success: false, error: "INVALID_REQUEST", message: "Missing required parameters." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({
        success: true,
        messageId,
        mode: "offline_mock",
      });
    }

    const normalizedCode = code.trim().toUpperCase();

    // 1. Verify room
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("id, creator_session_id")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (roomErr || !room) {
      return NextResponse.json(
        { success: false, error: "ROOM_NOT_FOUND", message: "Room not found." },
        { status: 404 }
      );
    }

    // 2. Fetch message and verify ownership
    const { data: message, error: msgErr } = await supabase
      .from("messages")
      .select("id, sender_session_id, image_path")
      .eq("id", messageId)
      .eq("room_id", room.id)
      .maybeSingle();

    if (msgErr || !message) {
      return NextResponse.json(
        { success: false, error: "MESSAGE_NOT_FOUND", message: "Message not found." },
        { status: 404 }
      );
    }

    const isSender = message.sender_session_id === sessionId;
    const isOwner = room.creator_session_id === sessionId;

    if (!isSender && !isOwner) {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN", message: "You are not authorized to delete this message." },
        { status: 403 }
      );
    }

    // 3. If there is an image, remove from storage
    if (message.image_path) {
      await supabase.storage.from("room-attachments").remove([message.image_path]).catch(() => {});
    }

    // 4. Soft-delete or delete message
    await supabase.from("messages").delete().eq("id", messageId);

    return NextResponse.json({
      success: true,
      messageId,
      mode: "supabase",
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to delete message." },
      { status: 500 }
    );
  }
}
