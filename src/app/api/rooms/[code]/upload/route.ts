import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rateLimit";
import crypto from "crypto";

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const formData = await req.formData().catch(() => null);

    if (!formData) {
      return NextResponse.json(
        { success: false, error: "INVALID_REQUEST", message: "Form data expected." },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File | null;
    const sessionId = formData.get("sessionId") as string | null;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Missing session identity." },
        { status: 401 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { success: false, error: "MISSING_FILE", message: "No image file provided." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        {
          success: false,
          error: "UNSUPPORTED_MEDIA_TYPE",
          message: "Unsupported image format. Use JPG, PNG, or WEBP.",
        },
        { status: 415 }
      );
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "FILE_TOO_LARGE",
          message: "Image exceeds 5MB limit.",
        },
        { status: 413 }
      );
    }

    // Rate limiting: 15 uploads per minute per session
    const rateLimit = checkRateLimit(sessionId, "send_message", 15, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "RATE_LIMITED",
          message: "Too many image uploads. Please wait a moment.",
          retryAfterMs: rateLimit.retryAfterMs,
        },
        { status: 429 }
      );
    }

    const supabase = getSupabaseAdmin();
    const serverTime = new Date();

    // Offline / Local mock fallback
    if (!supabase) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;
      return NextResponse.json({
        success: true,
        imageUrl: base64,
        imagePath: `mock/${Date.now()}-${file.name}`,
        mode: "offline_mock",
      });
    }

    const normalizedCode = code.trim().toUpperCase();

    // 1. Verify active room & expiration
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("id, status, expires_at")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (roomErr || !room) {
      return NextResponse.json(
        { success: false, error: "ROOM_NOT_FOUND", message: "Room not found." },
        { status: 404 }
      );
    }

    if (room.status === "expired" || serverTime >= new Date(room.expires_at)) {
      return NextResponse.json(
        { success: false, error: "ROOM_EXPIRED", message: "This room has expired." },
        { status: 410 }
      );
    }

    // 2. Verify sender is a participant
    const { data: participant, error: partErr } = await supabase
      .from("participants")
      .select("id")
      .eq("room_id", room.id)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (partErr || !participant) {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN", message: "You are not a member of this room." },
        { status: 403 }
      );
    }

    // 3. Upload file to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
    const objectPath = `rooms/${room.id}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("room-attachments")
      .upload(objectPath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      // If bucket doesn't exist yet, fallback gracefully to base64 so client never crashes
      console.warn("[5MIN] Supabase storage upload warning:", uploadErr.message);
      const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;
      return NextResponse.json({
        success: true,
        imageUrl: base64,
        imagePath: objectPath,
        fallback: true,
      });
    }

    // 4. Generate signed URL matching room expiration
    const remainingSeconds = Math.max(
      60,
      Math.floor((new Date(room.expires_at).getTime() - serverTime.getTime()) / 1000)
    );

    const { data: signedData, error: signErr } = await supabase.storage
      .from("room-attachments")
      .createSignedUrl(objectPath, remainingSeconds);

    if (signErr || !signedData?.signedUrl) {
      const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;
      return NextResponse.json({
        success: true,
        imageUrl: base64,
        imagePath: objectPath,
      });
    }

    return NextResponse.json({
      success: true,
      imageUrl: signedData.signedUrl,
      imagePath: objectPath,
      mode: "supabase",
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "UPLOAD_ERROR", message: "Failed to upload image. Please try again." },
      { status: 500 }
    );
  }
}
