import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const body = await req.json().catch(() => ({}));
    const { sessionId, durationSeconds } = body;

    if (!code) {
      return NextResponse.json(
        { success: false, error: "INVALID_CODE", message: "Missing room code." },
        { status: 400 }
      );
    }

    const validSeconds =
      typeof durationSeconds === "number" && durationSeconds > 0 && durationSeconds <= 86400
        ? durationSeconds
        : 300;

    const supabase = getSupabaseAdmin();
    const serverTime = new Date();

    if (!supabase) {
      return NextResponse.json({
        success: true,
        code,
        durationSeconds: validSeconds,
        expiresAt: new Date(serverTime.getTime() + validSeconds * 1000).toISOString(),
        mode: "offline_mock",
      });
    }

    const normalizedCode = code.trim().toUpperCase();

    // 1. Fetch room
    const { data: room, error: fetchErr } = await supabase
      .from("rooms")
      .select("id, code, created_at, status")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (fetchErr || !room) {
      return NextResponse.json(
        { success: false, error: "ROOM_NOT_FOUND", message: "Room not found." },
        { status: 404 }
      );
    }

    // 2. Compute new expiration based on creation timestamp
    const createdAtTime = new Date(room.created_at).getTime();
    const newExpiresAt = new Date(createdAtTime + validSeconds * 1000);

    // 3. Update room expiration in database
    const { error: updateErr } = await supabase
      .from("rooms")
      .update({
        expires_at: newExpiresAt.toISOString(),
        status: serverTime >= newExpiresAt ? "expired" : "active",
      })
      .eq("id", room.id);

    if (updateErr) {
      return NextResponse.json(
        { success: false, error: "DATABASE_ERROR", message: "Failed to update lifespan." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      code: room.code,
      durationSeconds: validSeconds,
      expiresAt: newExpiresAt.toISOString(),
      mode: "supabase",
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Something went wrong." },
      { status: 500 }
    );
  }
}
