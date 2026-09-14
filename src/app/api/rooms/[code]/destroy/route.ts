import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const body = await req.json().catch(() => ({}));
    const { sessionId } = body;

    if (!code || !sessionId) {
      return NextResponse.json(
        { success: false, error: "INVALID_REQUEST", message: "Room code and session ID are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const normalizedCode = code.trim().toUpperCase();

    if (!supabase) {
      return NextResponse.json({
        success: true,
        message: "Room destroyed (mock).",
        mode: "offline_mock",
      });
    }

    // 1. Fetch room & verify owner
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("id, code, creator_session_id")
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
        { success: false, error: "UNAUTHORIZED", message: "Only the room owner can destroy this room." },
        { status: 403 }
      );
    }

    // 2. Fetch all image paths in room to clean up Supabase storage
    const { data: messageFiles } = await supabase
      .from("messages")
      .select("image_path")
      .eq("room_id", room.id)
      .not("image_path", "is", null);

    if (messageFiles && messageFiles.length > 0) {
      const pathsToDelete = messageFiles
        .map((m) => m.image_path)
        .filter((p): p is string => Boolean(p));

      if (pathsToDelete.length > 0) {
        await supabase.storage.from("room-attachments").remove(pathsToDelete).catch(() => {});
      }
    }

    // 3. Delete messages
    await supabase.from("messages").delete().eq("room_id", room.id);

    // 4. Delete participants
    await supabase.from("participants").delete().eq("room_id", room.id);

    // 5. Mark room as permanently expired
    await supabase
      .from("rooms")
      .update({
        status: "expired",
        expires_at: new Date().toISOString(),
      })
      .eq("id", room.id);

    return NextResponse.json({
      success: true,
      roomId: room.id,
      code: room.code,
      message: "Room permanently destroyed and all data purged.",
      mode: "supabase",
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to destroy room." },
      { status: 500 }
    );
  }
}
