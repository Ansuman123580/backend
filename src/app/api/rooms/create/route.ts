import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateSecureRoomCode } from "@/lib/serverRoomCode";
import { checkRateLimit } from "@/lib/rateLimit";

const SESSION_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId, nickname } = body;

    if (!sessionId || typeof sessionId !== "string" || sessionId.length > 100) {
      return NextResponse.json(
        { success: false, error: "INVALID_SESSION", message: "A valid session identifier is required." },
        { status: 400 }
      );
    }

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
    const expiresAt = new Date(serverTime.getTime() + SESSION_DURATION_MS);

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
        mode: "offline_mock",
      });
    }

    // Check if table exists in Supabase
    const { error: tableCheckError } = await supabase
      .from("rooms")
      .select("id")
      .limit(1);

    if (tableCheckError && (tableCheckError.code === "PGRST205" || tableCheckError.code === "42P01")) {
      console.warn(
        "[5MIN] Table 'rooms' not yet found in Supabase. Run supabase/migrations/20260914000000_init_5min.sql in your Supabase SQL Editor. Running in local mode in the meantime."
      );
      const code = generateSecureRoomCode();
      return NextResponse.json({
        success: true,
        roomId: `mock-${Date.now()}`,
        roomCode: code,
        createdAt: serverTime.toISOString(),
        expiresAt: expiresAt.toISOString(),
        serverTime: serverTime.toISOString(),
        participantCount: 1,
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

    // Create room in database
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({
        code: roomCode,
        created_at: serverTime.toISOString(),
        expires_at: expiresAt.toISOString(),
        status: "active",
        participant_count: 1,
        creator_session_id: sessionId,
      })
      .select()
      .single();

    if (roomError || !room) {
      if (roomError?.code === "PGRST205") {
        console.warn(
          "[5MIN] Table 'rooms' not found in Supabase. Please run supabase/migrations/20260914000000_init_5min.sql in your Supabase SQL Editor. Falling back to local mode for now."
        );
        return NextResponse.json({
          success: true,
          roomId: `mock-${Date.now()}`,
          roomCode,
          createdAt: serverTime.toISOString(),
          expiresAt: expiresAt.toISOString(),
          serverTime: serverTime.toISOString(),
          participantCount: 1,
          mode: "offline_mock",
        });
      }
      return NextResponse.json(
        {
          success: false,
          error: "DATABASE_ERROR",
          message: roomError?.message || "Failed to create room.",
          code: roomError?.code,
          details: roomError?.details || null,
        },
        { status: 500 }
      );
    }

    // Add creator to participants
    await supabase.from("participants").insert({
      room_id: room.id,
      session_id: sessionId,
      nickname: (nickname || "Host").slice(0, 30),
      joined_at: serverTime.toISOString(),
      last_seen_at: serverTime.toISOString(),
    });

    return NextResponse.json({
      success: true,
      roomId: room.id,
      roomCode: room.code,
      createdAt: room.created_at,
      expiresAt: room.expires_at,
      serverTime: serverTime.toISOString(),
      participantCount: 1,
      mode: "supabase",
    });
  } catch (err: any) {
    if (err?.message?.includes("fetch failed") || err?.code === "ENOTFOUND" || err?.cause?.code === "ENOTFOUND") {
      console.warn("[5MIN] Supabase network unreachable. Running in local fallback mode.");
      const code = generateSecureRoomCode();
      const serverTime = new Date();
      return NextResponse.json({
        success: true,
        roomId: `mock-${Date.now()}`,
        roomCode: code,
        createdAt: serverTime.toISOString(),
        expiresAt: new Date(serverTime.getTime() + 5 * 60 * 1000).toISOString(),
        serverTime: serverTime.toISOString(),
        participantCount: 1,
        mode: "offline_mock",
      });
    }
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

