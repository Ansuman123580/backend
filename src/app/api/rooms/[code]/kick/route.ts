import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const body = await req.json().catch(() => ({}));
    const { ownerSessionId, targetSessionId } = body;

    if (!ownerSessionId || !targetSessionId) {
      return NextResponse.json(
        { success: false, error: "INVALID_REQUEST", message: "Owner and target session IDs required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ success: true, kicked: targetSessionId, mode: "offline_mock" });
    }

    const normalizedCode = code.trim().toUpperCase();

    // Verify room and owner
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("id, creator_session_id, participant_count")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (roomErr || !room) {
      return NextResponse.json(
        { success: false, error: "ROOM_NOT_FOUND", message: "Room not found." },
        { status: 404 }
      );
    }

    if (room.creator_session_id !== ownerSessionId) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Only the room owner can remove participants." },
        { status: 403 }
      );
    }

    // Call stored procedure or direct delete
    const { data: rpcData, error: rpcErr } = await supabase.rpc("kick_participant", {
      p_room_id: room.id,
      p_owner_session_id: ownerSessionId,
      p_target_session_id: targetSessionId,
    });

    if (rpcErr) {
      // Fallback to direct delete
      await supabase
        .from("participants")
        .delete()
        .eq("room_id", room.id)
        .eq("session_id", targetSessionId);

      await supabase
        .from("rooms")
        .update({ participant_count: Math.max(1, room.participant_count - 1) })
        .eq("id", room.id);
    }

    return NextResponse.json({
      success: true,
      kickedSessionId: targetSessionId,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to remove participant." },
      { status: 500 }
    );
  }
}
