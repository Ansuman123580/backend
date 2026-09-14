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
      .select("id, code, status, expires_at, participant_count, creator_session_id, allow_images, allow_reactions, allow_replies, max_participants")
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

    // Fetch recent active messages for this room that have not passed their expires_at and are not deleted
    let messageList: any[] = [];
    const fullMsgResult = await supabase
      .from("messages")
      .select("id, room_id, sender_session_id, sender_name, content, image_url, image_path, is_view_once, viewed_at, is_deleted, ttl_seconds, reply_to, reactions, created_at, expires_at")
      .eq("room_id", room.id)
      .gt("expires_at", serverTime.toISOString())
      .order("created_at", { ascending: true })
      .limit(100);

    if (fullMsgResult.error) {
      // Fallback to base columns if migration has not run yet in Supabase
      const baseResult = await supabase
        .from("messages")
        .select("id, room_id, sender_session_id, sender_name, content, reply_to, reactions, created_at")
        .eq("room_id", room.id)
        .order("created_at", { ascending: true })
        .limit(100);
      messageList = baseResult.data || [];
    } else {
      messageList = (fullMsgResult.data || []).filter((m) => !m.is_deleted);
    }

    const isOwner = sessionId ? room.creator_session_id === sessionId : false;

    return NextResponse.json({
      success: true,
      status: "active",
      roomId: room.id,
      code: room.code,
      serverTime: serverTime.toISOString(),
      expiresAt: room.expires_at,
      timeRemainingSeconds: remainingSeconds,
      participantCount: room.participant_count,
      isOwner,
      settings: {
        allowImages: room.allow_images ?? true,
        allowReactions: room.allow_reactions ?? true,
        allowReplies: room.allow_replies ?? true,
        maxParticipants: room.max_participants ?? 2,
      },
      messages: messageList.map((m) => {
        const createdAtMs = new Date(m.created_at).getTime();
        const expiresAtMs = m.expires_at
          ? new Date(m.expires_at).getTime()
          : createdAtMs + (m.ttl_seconds ? m.ttl_seconds * 1000 : 300000);
        return {
          id: m.id,
          senderId: m.sender_session_id,
          senderName: m.sender_name,
          isSelf: sessionId ? m.sender_session_id === sessionId : false,
          content: m.content,
          imageUrl: m.image_url || null,
          imagePath: m.image_path || null,
          isViewOnce: Boolean(m.is_view_once),
          viewedAt: m.viewed_at ? new Date(m.viewed_at).getTime() : null,
          isDeleted: Boolean(m.is_deleted),
          ttlSeconds: m.ttl_seconds || 300,
          expiresAt: expiresAtMs,
          timestamp: createdAtMs,
          replyTo: m.reply_to,
          reactions: m.reactions,
        };
      }),
      mode: "supabase",
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to sync room." },
      { status: 500 }
    );
  }
}

