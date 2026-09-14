import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const body = await req.json().catch(() => ({}));
    const { messageId, sessionId } = body;

    if (!code || !messageId || !sessionId) {
      return NextResponse.json(
        { success: false, error: "INVALID_REQUEST", message: "Message ID, room code, and session ID are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({
        success: true,
        messageId,
        viewedAt: new Date().toISOString(),
        mode: "offline_mock",
      });
    }

    const normalizedCode = code.trim().toUpperCase();

    // 1. Verify room
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("id, status")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (roomErr || !room) {
      return NextResponse.json(
        { success: false, error: "ROOM_NOT_FOUND", message: "Room not found." },
        { status: 404 }
      );
    }

    // 2. Fetch message
    const { data: message, error: msgErr } = await supabase
      .from("messages")
      .select("id, image_path, is_view_once, viewed_at")
      .eq("id", messageId)
      .eq("room_id", room.id)
      .maybeSingle();

    if (msgErr || !message) {
      return NextResponse.json(
        { success: false, error: "MESSAGE_NOT_FOUND", message: "Message not found." },
        { status: 404 }
      );
    }

    const viewedAt = new Date().toISOString();

    // 3. Mark message as viewed and burn the image
    await supabase
      .from("messages")
      .update({
        viewed_at: viewedAt,
        image_url: null,
        content: "[Photo Disappeared]",
      })
      .eq("id", messageId);

    // 4. Delete file from storage if present
    if (message.image_path) {
      await supabase.storage.from("room-attachments").remove([message.image_path]).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      messageId,
      viewedAt,
      mode: "supabase",
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to mark view-once." },
      { status: 500 }
    );
  }
}

