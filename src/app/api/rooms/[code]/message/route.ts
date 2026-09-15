import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rateLimit";

const MAX_MESSAGE_LENGTH = 2000;

function sanitizeText(str: string): string {
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const body = await req.json().catch(() => ({}));
    const { sessionId, senderName, content, replyTo, imageUrl, imagePath, ttlSeconds, isViewOnce } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Missing session identity." },
        { status: 401 }
      );
    }

    const trimmed = typeof content === "string" ? content.trim() : "";

    if (!trimmed && !imageUrl) {
      return NextResponse.json(
        { success: false, error: "EMPTY_MESSAGE", message: "Message content or photo is required." },
        { status: 400 }
      );
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: "MESSAGE_TOO_LONG",
          message: `Message exceeds maximum limit of ${MAX_MESSAGE_LENGTH} characters.`,
        },
        { status: 400 }
      );
    }

    // Rate limiting: 60 messages per minute per session
    const rateLimit = checkRateLimit(sessionId, "send_message", 60, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "RATE_LIMITED",
          message: "You are sending messages too quickly. Please wait a moment.",
          retryAfterMs: rateLimit.retryAfterMs,
        },
        { status: 429 }
      );
    }

    const supabase = getSupabaseAdmin();
    const serverTime = new Date();
    const cleanContent = sanitizeText(trimmed);

    const normalizedCode = code.trim().toUpperCase();

    if (!supabase) {
      // Mock mode for local preview
      const selectedTtl = typeof ttlSeconds === "number" ? ttlSeconds : 300;
      const computedExpiresAt = new Date(serverTime.getTime() + (selectedTtl || 300) * 1000);
      return NextResponse.json({
        success: true,
        message: {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          roomId: "mock-room",
          senderSessionId: sessionId,
          senderName: senderName || "You",
          content: cleanContent,
          imageUrl: imageUrl || null,
          imagePath: imagePath || null,
          isViewOnce: Boolean(isViewOnce),
          ttlSeconds: selectedTtl,
          replyTo: replyTo || null,
          createdAt: serverTime.toISOString(),
          expiresAt: computedExpiresAt.toISOString(),
        },
        mode: "offline_mock",
      });
    }

    // 1. Fetch room & check active and expiry
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

    const roomExpiresAtDate = new Date(room.expires_at);
    if (room.status === "expired" || serverTime >= roomExpiresAtDate) {
      await supabase.from("rooms").update({ status: "expired" }).eq("id", room.id);
      return NextResponse.json(
        { success: false, error: "ROOM_EXPIRED", message: "This room has expired." },
        { status: 410 }
      );
    }

    if (imageUrl && room.allow_images === false) {
      return NextResponse.json(
        { success: false, error: "IMAGES_DISABLED", message: "Photo sharing is disabled in this room." },
        { status: 403 }
      );
    }

    if (replyTo && room.allow_replies === false) {
      return NextResponse.json(
        { success: false, error: "REPLIES_DISABLED", message: "Quoted replies are disabled in this room." },
        { status: 403 }
      );
    }

    if (isViewOnce && room.allow_view_once === false) {
      return NextResponse.json(
        { success: false, error: "VIEW_ONCE_DISABLED", message: "View-once photos are disabled in this room." },
        { status: 403 }
      );
    }

    // 2. Verify sender is an active participant or room creator
    const isCreator = room.creator_session_id === sessionId;
    const { data: participant } = await supabase
      .from("participants")
      .select("id, nickname")
      .eq("room_id", room.id)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (!participant && !isCreator) {
      // Auto-register session if room has capacity
      const maxCap = room.max_participants || 2;
      const currentCount = room.participant_count || 1;
      if (currentCount <= maxCap) {
        try {
          await supabase.from("participants").insert({
            room_id: room.id,
            session_id: sessionId,
            nickname: senderName || "Guest",
            joined_at: serverTime.toISOString(),
            last_seen_at: serverTime.toISOString(),
          });
        } catch {}
      } else {
        return NextResponse.json(
          { success: false, error: "FORBIDDEN", message: "You are not a member of this room." },
          { status: 403 }
        );
      }
    }

    if (isCreator && !participant) {
      try {
        await supabase.from("participants").insert({
          room_id: room.id,
          session_id: sessionId,
          nickname: senderName || "Host",
          joined_at: serverTime.toISOString(),
          last_seen_at: serverTime.toISOString(),
        });
      } catch {}
    }

    // Calculate authoritative expires_at
    let effectiveTtl: number;
    if (imageUrl) {
      effectiveTtl = typeof ttlSeconds === "number" ? ttlSeconds : (room.default_photo_ttl ?? 300);
    } else {
      effectiveTtl = typeof ttlSeconds === "number" ? ttlSeconds : (room.default_message_ttl ?? 300);
    }

    let computedExpiresAt: Date;
    if (!effectiveTtl || effectiveTtl <= 0) {
      computedExpiresAt = roomExpiresAtDate;
    } else {
      const candidate = new Date(serverTime.getTime() + effectiveTtl * 1000);
      computedExpiresAt = candidate < roomExpiresAtDate ? candidate : roomExpiresAtDate;
    }

    // 3. Insert message
    let insertedMessage: any = null;

    const fullInsert = await supabase
      .from("messages")
      .insert({
        room_id: room.id,
        sender_session_id: sessionId,
        sender_name: participant?.nickname || senderName || (isCreator ? "Host" : "Guest"),
        content: cleanContent || (imageUrl ? (isViewOnce ? "[View Once Photo]" : "[Photo]") : ""),
        image_url: imageUrl || null,
        image_path: imagePath || null,
        is_view_once: Boolean(isViewOnce),
        ttl_seconds: effectiveTtl || null,
        reply_to: replyTo || null,
        created_at: serverTime.toISOString(),
        expires_at: computedExpiresAt.toISOString(),
      })
      .select()
      .single();

    if (fullInsert.error) {
      const fallbackInsert = await supabase
        .from("messages")
        .insert({
          room_id: room.id,
          sender_session_id: sessionId,
          sender_name: participant?.nickname || senderName || (isCreator ? "Host" : "Guest"),
          content: cleanContent || (imageUrl ? "[Photo]" : ""),
          image_url: imageUrl || null,
          image_path: imagePath || null,
          ttl_seconds: effectiveTtl || 300,
          reply_to: replyTo || null,
          created_at: serverTime.toISOString(),
          expires_at: computedExpiresAt.toISOString(),
        })
        .select()
        .single();

      if (fallbackInsert.error || !fallbackInsert.data) {
        return NextResponse.json(
          {
            success: false,
            error: "DATABASE_ERROR",
            message: fallbackInsert.error?.message || fullInsert.error?.message || "Failed to store message.",
          },
          { status: 500 }
        );
      }

      insertedMessage = {
        ...fallbackInsert.data,
        is_view_once: Boolean(isViewOnce),
      };
    } else {
      insertedMessage = fullInsert.data;
    }

    return NextResponse.json({
      success: true,
      message: {
        id: insertedMessage.id,
        roomId: insertedMessage.room_id,
        senderSessionId: insertedMessage.sender_session_id,
        senderName: insertedMessage.sender_name,
        content: insertedMessage.content,
        imageUrl: insertedMessage.image_url,
        imagePath: insertedMessage.image_path,
        isViewOnce: Boolean(insertedMessage.is_view_once),
        ttlSeconds: insertedMessage.ttl_seconds,
        replyTo: insertedMessage.reply_to,
        createdAt: insertedMessage.created_at,
        expiresAt: insertedMessage.expires_at,
      },
      mode: "supabase",
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
