import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ success: true, message: "No database configured.", count: 0 });
    }

    // Call cleanup stored procedure
    const { data, error } = await supabase.rpc("cleanup_expired_rooms");

    if (error) {
      // Fallback manual cleanup queries
      await supabase
        .from("rooms")
        .update({ status: "expired" })
        .eq("status", "active")
        .lte("expires_at", new Date().toISOString());

      await supabase
        .from("messages")
        .delete()
        .lte("expires_at", new Date().toISOString());

      return NextResponse.json({ success: true, fallback: true });
    }

    return NextResponse.json({ success: true, cleanedCount: data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "CLEANUP_FAILED" },
      { status: 500 }
    );
  }
}

