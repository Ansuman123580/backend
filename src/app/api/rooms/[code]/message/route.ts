import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rateLimit";

const MAX_MESSAGE_LENGTH = 2000;

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
          message: `Message exceeds the maximum limit of ${MAX_MESSAGE_LENGTH} characters.`,
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
    const selectedTtl = typeof ttlSeconds === "number" && ttlSeconds > 0 ? ttlSeconds : 300;
    const computedExpiresAt = new Date(serverTime.getTime() + selectedTtl * 1000);

    if (!supabase) {
      // Mock mode for local preview
      return NextResponse.json({
        success: true,
        message: {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          roomId: "mock-room",
          senderSessionId: sessionId,
          senderName: senderName || "You",
          content: trimmed,
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

    const normalizedCode = code.trim().toUpperCase();

    // 1. Fetch room & check active and expiry
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("id, status, expires_at, allow_images, allow_replies")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (roomErr || !room) {
      if (roomErr?.code === "PGRST205") {
        return NextResponse.json({
          success: true,
          message: {
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            roomId: "mock-room",
            senderSessionId: sessionId,
            senderName: senderName || "You",
            content: trimmed,
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
      return NextResponse.json(
        { success: false, error: "ROOM_NOT_FOUND", message: "Room not found." },
        { status: 404 }
      );
    }

    if (room.status === "expired" || serverTime >= new Date(room.expires_at)) {
      await supabase.from("rooms").update({ status: "expired" }).eq("id", room.id);
      return NextResponse.json(
        { success: false, error: "ROOM_EXPIRED", message: "This room has expired." },
        { status: 410 }
      );
    }

    if (imageUrl && room.allow_images === false) {
      return NextResponse.json(
        { success: false, error: "IMAGES_DISABLED", message: "The host has disabled image sharing in this room." },
        { status: 403 }
      );
    }

    if (replyTo && room.allow_replies === false) {
      return NextResponse.json(
        { success: false, error: "REPLIES_DISABLED", message: "The host has disabled replies in this room." },
        { status: 403 }
      );
    }

    // 2. Verify sender is a participant of this room
    const { data: participant, error: partErr } = await supabase
      .from("participants")
      .select("id, nickname")
      .eq("room_id", room.id)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (partErr || !participant) {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN", message: "You are not a participant in this room." },
        { status: 403 }
      );
    }

    // 3. Insert message into messages table
    let insertedMessage: any = null;

    const fullInsert = await supabase
      .from("messages")
      .insert({
        room_id: room.id,
        sender_session_id: sessionId,
        sender_name: participant.nickname || senderName || "Guest",
        content: trimmed || (imageUrl ? (isViewOnce ? "[View Once Photo]" : "[Photo]") : ""),
        image_url: imageUrl || null,
        image_path: imagePath || null,
        is_view_once: Boolean(isViewOnce),
        ttl_seconds: selectedTtl,
        reply_to: replyTo || null,
        created_at: serverTime.toISOString(),
        expires_at: computedExpiresAt.toISOString(),
      })
      .select()
      .single();

    if (fullInsert.error) {
      // Graceful fallback to base schema
      const fallbackInsert = await supabase
        .from("messages")
        .insert({
          room_id: room.id,
          sender_session_id: sessionId,
          sender_name: participant.nickname || senderName || "Guest",
          content: trimmed || (imageUrl ? "[Photo]" : ""),
          reply_to: replyTo || null,
          created_at: serverTime.toISOString(),
        })
        .select()
        .single();

      if (fallbackInsert.error || !fallbackInsert.data) {
        return NextResponse.json(
          { success: false, error: "DATABASE_ERROR", message: "Failed to store message." },
          { status: 500 }
        );
      }

      insertedMessage = {
        ...fallbackInsert.data,
        image_url: imageUrl || null,
        image_path: imagePath || null,
        is_view_once: Boolean(isViewOnce),
        ttl_seconds: selectedTtl,
        expires_at: computedExpiresAt.toISOString(),
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
  } catch (err: any) {
    if (err?.message?.includes("fetch failed") || err?.code === "ENOTFOUND" || err?.cause?.code === "ENOTFOUND") {
      const serverTime = new Date();
      return NextResponse.json({
        success: true,
        message: {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          roomId: "mock-room",
          senderSessionId: "offline-user",
          senderName: "You",
          content: "Message sent",
          imageUrl: null,
          imagePath: null,
          ttlSeconds: 300,
          replyTo: null,
          createdAt: serverTime.toISOString(),
          expiresAt: new Date(serverTime.getTime() + 5 * 60 * 1000).toISOString(),
        },
        mode: "offline_mock",
      });
    }
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
