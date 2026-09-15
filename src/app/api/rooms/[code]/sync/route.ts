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
        participants: [
          { id: "user-1", name: "Host", isSelf: true, isOwner: true, joinedAt: Date.now() },
          { id: "user-2", name: "Guest", isSelf: false, isOwner: false, joinedAt: Date.now() },
        ],
        mode: "offline_mock",
      });
    }

    const normalizedCode = code.trim().toUpperCase();

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

    const expiresAtDate = new Date(room.expires_at);
    const isExpired = room.status === "expired" || serverTime >= expiresAtDate;

    if (isExpired) {
      try {
        await supabase.from("rooms").update({ status: "expired" }).eq("id", room.id);
      } catch {}
      return NextResponse.json({
        success: true,
        status: "expired",
        code: room.code,
        serverTime: serverTime.toISOString(),
        expiresAt: room.expires_at,
        timeRemainingSeconds: 0,
        participantCount: room.participant_count,
        messages: [],
        participants: [],
      });
    }

    const remainingSeconds = Math.max(
      0,
      Math.floor((expiresAtDate.getTime() - serverTime.getTime()) / 1000)
    );

    // Fetch participants list
    const { data: participantsList } = await supabase
      .from("participants")
      .select("id, session_id, nickname, joined_at, last_seen_at")
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true });

    const formattedParticipants = (participantsList || []).map((p) => ({
      id: p.id,
      sessionId: p.session_id,
      name: p.nickname || (p.session_id === room.creator_session_id ? "Host" : "Guest"),
      isSelf: sessionId ? p.session_id === sessionId : false,
      isOwner: p.session_id === room.creator_session_id,
      joinedAt: new Date(p.joined_at).getTime(),
      status: "online" as const,
    }));

    // Fetch active messages that haven't expired and aren't deleted
    const { data: rawMessages } = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", room.id)
      .gt("expires_at", serverTime.toISOString())
      .order("created_at", { ascending: true })
      .limit(100);

    const messageList = (rawMessages || []).filter((m: any) => !m.is_deleted);

    // Refresh signed URLs on demand for active images
    const refreshedMessages = await Promise.all(
      messageList.map(async (m) => {
        let freshUrl = m.image_url;
        if (m.image_path && !m.viewed_at && !m.is_deleted) {
          try {
            const { data: signed } = await supabase.storage
              .from("room-attachments")
              .createSignedUrl(m.image_path, Math.max(60, remainingSeconds));
            if (signed?.signedUrl) {
              freshUrl = signed.signedUrl;
            }
          } catch {
            // retain existing freshUrl
          }
        }

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
          imageUrl: freshUrl || null,
          imagePath: m.image_path || null,
          isViewOnce: Boolean(m.is_view_once),
          viewedAt: m.viewed_at ? new Date(m.viewed_at).getTime() : null,
          seenAt: m.seen_at ? new Date(m.seen_at).getTime() : null,
          deliveredAt: m.delivered_at ? new Date(m.delivered_at).getTime() : null,
          isDeleted: Boolean(m.is_deleted),
          ttlSeconds: m.ttl_seconds || 300,
          expiresAt: expiresAtMs,
          timestamp: createdAtMs,
          replyTo: m.reply_to,
          reactions: m.reactions,
        };
      })
    );

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
      participants: formattedParticipants,
      settings: {
        allowImages: room.allow_images ?? true,
        allowReactions: room.allow_reactions ?? true,
        allowReplies: room.allow_replies ?? true,
        allowViewOnce: room.allow_view_once ?? true,
        maxParticipants: room.max_participants ?? 2,
        defaultMessageTtl: room.default_message_ttl,
        defaultPhotoTtl: room.default_photo_ttl,
      },
      messages: refreshedMessages,
      mode: "supabase",
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to sync room." },
      { status: 500 }
    );
  }
}
