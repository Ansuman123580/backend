import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const sessionId = req.nextUrl.searchParams.get("sessionId");

    if (!code) {
      return NextResponse.json(
        { success: false, error: "INVALID_CODE", message: "Missing room code." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const serverTime = new Date();

    if (!supabase) {
      return NextResponse.json({
        success: true,
        status: "active",
        code,
        serverTime: serverTime.toISOString(),
        expiresAt: new Date(serverTime.getTime() + 300000).toISOString(),
        timeRemainingSeconds: 300,
        participantCount: 2,
        messages: [],
        mode: "offline_mock",
      });
    }

    const normalizedCode = code.trim().toUpperCase();

    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("id, code, status, expires_at, participant_count")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (roomErr || !room) {
      return NextResponse.json(
        { success: false, error: "ROOM_NOT_FOUND", message: "Room not found." },
        { status: 404 }
      );
    }

    const expiresAtDate = new Date(room.expires_at);
    const isExpired = room.status === "expired" || serverTime >= expiresAtDate;

    if (isExpired) {
      // Mark as expired in DB
      await supabase.from("rooms").update({ status: "expired" }).eq("id", room.id);
      return NextResponse.json({
        success: true,
        status: "expired",
        code: room.code,
        serverTime: serverTime.toISOString(),
        expiresAt: room.expires_at,
        timeRemainingSeconds: 0,
        participantCount: room.participant_count,
        messages: [],
      });
    }

    const remainingSeconds = Math.max(
      0,
      Math.floor((expiresAtDate.getTime() - serverTime.getTime()) / 1000)
    );

    // Fetch recent messages for this room
    const { data: messages } = await supabase
      .from("messages")
      .select("id, room_id, sender_session_id, sender_name, content, reply_to, reactions, created_at, expires_at")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .limit(100);

    return NextResponse.json({
      success: true,
      status: "active",
      roomId: room.id,
      code: room.code,
      serverTime: serverTime.toISOString(),
      expiresAt: room.expires_at,
      timeRemainingSeconds: remainingSeconds,
      participantCount: room.participant_count,
      messages: (messages || []).map((m) => ({
        id: m.id,
        senderId: m.sender_session_id,
        senderName: m.sender_name,
        isSelf: sessionId ? m.sender_session_id === sessionId : false,
        content: m.content,
        timestamp: new Date(m.created_at).getTime(),
        replyTo: m.reply_to,
        reactions: m.reactions,
      })),
      mode: "supabase",
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to sync room." },
      { status: 500 }
    );
  }
}

