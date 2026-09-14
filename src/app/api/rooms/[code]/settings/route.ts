import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const body = await req.json().catch(() => ({}));
    const { sessionId, allowImages, allowReactions, allowReplies } = body;

    if (!code || !sessionId) {
      return NextResponse.json(
        { success: false, error: "INVALID_REQUEST", message: "Room code and session ID are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({
        success: true,
        settings: { allowImages, allowReactions, allowReplies },
        mode: "offline_mock",
      });
    }

    const normalizedCode = code.trim().toUpperCase();

    // Verify room ownership
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

    if (room.creator_session_id !== sessionId) {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN", message: "Only the room owner can change settings." },
        { status: 403 }
      );
    }

    const updatePayload: Record<string, boolean> = {};
    if (typeof allowImages === "boolean") updatePayload.allow_images = allowImages;
    if (typeof allowReactions === "boolean") updatePayload.allow_reactions = allowReactions;
    if (typeof allowReplies === "boolean") updatePayload.allow_replies = allowReplies;

    await supabase.from("rooms").update(updatePayload).eq("id", room.id);

    return NextResponse.json({
      success: true,
      settings: updatePayload,
      mode: "supabase",
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to update settings." },
      { status: 500 }
    );
  }
}
