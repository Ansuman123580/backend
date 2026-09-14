import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isValidRoomCodeFormat } from "@/lib/roomCode";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { code, sessionId, nickname } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { success: false, error: "INVALID_CODE", message: "A room code is required." },
        { status: 400 }
      );
    }

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { success: false, error: "INVALID_SESSION", message: "A valid session identifier is required." },
        { status: 400 }
      );
    }

    const normalizedCode = code.trim().toUpperCase();
    if (!isValidRoomCodeFormat(normalizedCode)) {
      return NextResponse.json(
        { success: false, error: "ROOM_NOT_FOUND", message: "This room could not be found." },
        { status: 404 }
      );
    }

    // Rate limiting: 15 joins per minute per IP/sessionId
    const ip = req.headers.get("x-forwarded-for") || sessionId;
    const rateLimit = checkRateLimit(ip, "join_room", 15, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "RATE_LIMITED",
          message: "Too many join attempts. Please slow down.",
          retryAfterMs: rateLimit.retryAfterMs,
        },
        { status: 429 }
      );
    }

    const supabase = getSupabaseAdmin();
    const serverTime = new Date();

    // If Supabase is not yet configured, allow local validation for preview mode
    if (!supabase) {
      return NextResponse.json({
        success: true,
        status: "JOIN_SUCCESS",
        roomId: `mock-${Date.now()}`,
        code: normalizedCode,
        createdAt: serverTime.toISOString(),
        expiresAt: new Date(serverTime.getTime() + 5 * 60 * 1000).toISOString(),
        participantCount: 2,
        serverTime: serverTime.toISOString(),
        mode: "offline_mock",
      });
    }

    // Call atomic PostgreSQL stored procedure (handles row lock, max 2 participants & race condition)
    const { data, error } = await supabase.rpc("join_room", {
      p_code: normalizedCode,
      p_session_id: sessionId,
      p_nickname: (nickname || "Guest").slice(0, 30),
    });

    if (error) {
      if (error.code === "PGRST202" || error.code === "PGRST205") {
        return NextResponse.json({
          success: true,
          status: "JOIN_SUCCESS",
          roomId: `mock-${Date.now()}`,
          code: normalizedCode,
          createdAt: serverTime.toISOString(),
          expiresAt: new Date(serverTime.getTime() + 5 * 60 * 1000).toISOString(),
          participantCount: 2,
          serverTime: serverTime.toISOString(),
          mode: "offline_mock",
        });
      }
      return NextResponse.json(
        { success: false, error: "DATABASE_ERROR", message: "Something went wrong while joining the room." },
        { status: 500 }
      );
    }

    if (!data.success) {
      const statusCode =
        data.error === "ROOM_NOT_FOUND"
          ? 404
          : data.error === "ROOM_EXPIRED"
          ? 410
          : data.error === "ROOM_FULL"
          ? 409
          : 400;

      return NextResponse.json(
        {
          success: false,
          error: data.error,
          message: data.message || "Failed to join room.",
        },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      status: data.status,
      roomId: data.room_id,
      code: data.code,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      participantCount: data.participant_count,
      serverTime: data.server_time || serverTime.toISOString(),
      mode: "supabase",
    });
  } catch (err: any) {
    if (err?.message?.includes("fetch failed") || err?.code === "ENOTFOUND" || err?.cause?.code === "ENOTFOUND") {
      const serverTime = new Date();
      return NextResponse.json({
        success: true,
        status: "JOIN_SUCCESS",
        roomId: `mock-${Date.now()}`,
        code: (req as any).body?.code || "7K4X-92",
        createdAt: serverTime.toISOString(),
        expiresAt: new Date(serverTime.getTime() + 5 * 60 * 1000).toISOString(),
        participantCount: 2,
        serverTime: serverTime.toISOString(),
        mode: "offline_mock",
      });
    }
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

