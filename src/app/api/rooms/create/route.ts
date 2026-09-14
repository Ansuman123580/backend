import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateSecureRoomCode } from "@/lib/serverRoomCode";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      sessionId,
      nickname,
      durationSeconds,
      defaultMessageTtl,
      defaultPhotoTtl,
      allowImages,
      allowReactions,
      allowReplies,
      allowViewOnce,
      maxParticipants,
    } = body;

    if (!sessionId || typeof sessionId !== "string" || sessionId.length > 100) {
      return NextResponse.json(
        { success: false, error: "INVALID_SESSION", message: "A valid session identifier is required." },
        { status: 400 }
      );
    }

    const validDurationSeconds =
      typeof durationSeconds === "number" && durationSeconds >= 10 && durationSeconds <= 86400
        ? durationSeconds
        : 300;
    const durationMs = validDurationSeconds * 1000;

    // Rate limiting: 5 creations per minute per session/IP
    const ip = req.headers.get("x-forwarded-for") || sessionId;
    const rateLimit = checkRateLimit(ip, "create_room", 5, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "RATE_LIMITED",
          message: "Too many rooms created recently. Please wait a moment.",
          retryAfterMs: rateLimit.retryAfterMs,
        },
        { status: 429 }
      );
    }

    const supabase = getSupabaseAdmin();
    const serverTime = new Date();
    const expiresAt = new Date(serverTime.getTime() + durationMs);
    const sanitizedNickname = (typeof nickname === "string" ? nickname.trim().slice(0, 30) : "") || "Host";

    const configData = {
      durationSeconds: validDurationSeconds,
      defaultMessageTtl: defaultMessageTtl !== undefined ? defaultMessageTtl : 300,
      defaultPhotoTtl: defaultPhotoTtl !== undefined ? defaultPhotoTtl : 300,
      allowImages: allowImages ?? true,
      allowReactions: allowReactions ?? true,
      allowReplies: allowReplies ?? true,
      allowViewOnce: allowViewOnce ?? true,
      maxParticipants: Math.min(50, Math.max(2, typeof maxParticipants === "number" ? maxParticipants : 2)),
    };

    // If Supabase is not yet configured, provide mock server response for instant preview
    if (!supabase) {
      const code = generateSecureRoomCode();
      return NextResponse.json({
        success: true,
        roomId: `mock-${Date.now()}`,
        roomCode: code,
        createdAt: serverTime.toISOString(),
        expiresAt: expiresAt.toISOString(),
        serverTime: serverTime.toISOString(),
        participantCount: 1,
        isOwner: true,
        ...configData,
        mode: "offline_mock",
      });
    }

    // Check if table exists in Supabase
    const { error: tableCheckError } = await supabase
      .from("rooms")
      .select("id")
      .limit(1);

    if (tableCheckError && (tableCheckError.code === "PGRST205" || tableCheckError.code === "42P01")) {
      const code = generateSecureRoomCode();
      return NextResponse.json({
        success: true,
        roomId: `mock-${Date.now()}`,
        roomCode: code,
        createdAt: serverTime.toISOString(),
        expiresAt: expiresAt.toISOString(),
        serverTime: serverTime.toISOString(),
        participantCount: 1,
        isOwner: true,
        ...configData,
        mode: "offline_mock",
      });
    }

    // Collision-resistant loop
    let roomCode = "";
    let attempts = 0;
    while (attempts < 5) {
      const candidate = generateSecureRoomCode();
      const { data: existing } = await supabase
        .from("rooms")
        .select("id")
        .eq("code", candidate)
        .maybeSingle();

      if (!existing) {
        roomCode = candidate;
        break;
      }
      attempts++;
    }

    if (!roomCode) {
      return NextResponse.json(
        { success: false, error: "COLLISION_ERROR", message: "Failed to generate a unique room code. Try again." },
        { status: 500 }
      );
    }

    // Attempt full insert with all privacy options
    const fullPayload = {
      code: roomCode,
      created_at: serverTime.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: "active",
      participant_count: 1,
      creator_session_id: sessionId,
      allow_images: configData.allowImages,
      allow_reactions: configData.allowReactions,
      allow_replies: configData.allowReplies,
      allow_view_once: configData.allowViewOnce,
      max_participants: configData.maxParticipants,
      default_message_ttl: configData.defaultMessageTtl,
      default_photo_ttl: configData.defaultPhotoTtl,
      is_invite_revoked: false,
    };

    let createdRoom: any = null;
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert(fullPayload)
      .select()
      .single();

    if (roomError) {
      // Fallback in case columns from newer migration are not yet applied
      const fallbackPayload = {
        code: roomCode,
        created_at: serverTime.toISOString(),
        expires_at: expiresAt.toISOString(),
        status: "active",
        participant_count: 1,
        creator_session_id: sessionId,
      };

      const { data: fbRoom, error: fbError } = await supabase
        .from("rooms")
        .insert(fallbackPayload)
        .select()
        .single();

      if (fbError || !fbRoom) {
        return NextResponse.json(
          {
            success: false,
            error: "DATABASE_ERROR",
            message: fbError?.message || roomError.message || "Failed to create room.",
          },
          { status: 500 }
        );
      }
      createdRoom = fbRoom;
    } else {
      createdRoom = room;
    }

    // Add creator to participants
    await supabase.from("participants").insert({
      room_id: createdRoom.id,
      session_id: sessionId,
      nickname: sanitizedNickname,
      joined_at: serverTime.toISOString(),
      last_seen_at: serverTime.toISOString(),
    });

    return NextResponse.json({
      success: true,
      roomId: createdRoom.id,
      roomCode: createdRoom.code,
      createdAt: createdRoom.created_at,
      expiresAt: createdRoom.expires_at,
      serverTime: serverTime.toISOString(),
      participantCount: 1,
      isOwner: true,
      ...configData,
      mode: "supabase",
    });
  } catch (err: any) {
    if (err?.message?.includes("fetch failed") || err?.code === "ENOTFOUND") {
      const code = generateSecureRoomCode();
      const serverTime = new Date();
      return NextResponse.json({
        success: true,
        roomId: `mock-${Date.now()}`,
        roomCode: code,
        createdAt: serverTime.toISOString(),
        expiresAt: new Date(serverTime.getTime() + 300000).toISOString(),
        serverTime: serverTime.toISOString(),
        participantCount: 1,
        isOwner: true,
        durationSeconds: 300,
        mode: "offline_mock",
      });
    }
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
