import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rateLimit";
import crypto from "crypto";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

function validateImageMagicBytes(buffer: Buffer): { valid: boolean; detectedExt: string } {
  if (buffer.length < 12) return { valid: false, detectedExt: "" };

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, detectedExt: "jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, detectedExt: "png" };
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { valid: true, detectedExt: "webp" };
  }

  return { valid: false, detectedExt: "" };
}

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
          message: "Image exceeds 10MB limit.",
        },
        { status: 413 }
      );
    }

    // Rate limiting: 20 uploads per minute per session
    const rateLimit = checkRateLimit(sessionId, "send_message", 20, 60000);
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

    const buffer = Buffer.from(await file.arrayBuffer());

    // Deep inspect magic bytes to prevent polyglot / script injection
    const magic = validateImageMagicBytes(buffer);
    if (!magic.valid) {
      return NextResponse.json(
        {
          success: false,
          error: "CORRUPTED_OR_INVALID_IMAGE",
          message: "The uploaded file is not a valid image.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const serverTime = new Date();

    // Offline / Local mock fallback
    if (!supabase) {
      const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;
      return NextResponse.json({
        success: true,
        imageUrl: base64,
        imagePath: `mock/${Date.now()}-${file.name}`,
        mode: "offline_mock",
      });
    }

    const normalizedCode = code.trim().toUpperCase();

    // 1. Verify active room & expiration with fallback
    let room: any = null;
    const { data: fullRoom, error: roomErr } = await supabase
      .from("rooms")
      .select("id, status, expires_at, allow_images, default_photo_ttl")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (roomErr || !fullRoom) {
      const { data: baseRoom, error: baseErr } = await supabase
        .from("rooms")
        .select("id, status, expires_at, allow_images")
        .eq("code", normalizedCode)
        .maybeSingle();

      if (baseErr || !baseRoom) {
        return NextResponse.json(
          { success: false, error: "ROOM_NOT_FOUND", message: "Room not found." },
          { status: 404 }
        );
      }
      room = baseRoom;
    } else {
      room = fullRoom;
    }

    if (room.status === "expired" || serverTime >= new Date(room.expires_at)) {
      return NextResponse.json(
        { success: false, error: "ROOM_EXPIRED", message: "This room has expired." },
        { status: 410 }
      );
    }

    if (room.allow_images === false) {
      return NextResponse.json(
        { success: false, error: "PHOTOS_DISABLED", message: "Photo sharing is disabled in this room." },
        { status: 403 }
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

    // 3. Upload file to Supabase Storage with cryptographic random filename and detected extension
    const ext = magic.detectedExt;
    const objectPath = `rooms/${room.id}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("room-attachments")
      .upload(objectPath, buffer, {
        contentType: file.type || `image/${ext}`,
        upsert: false,
      });

    if (uploadErr) {
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
