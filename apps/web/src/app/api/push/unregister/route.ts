import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth/request";

export async function POST(request: NextRequest) {
  const { user, supabase, error } = await getAuthUser(request);
  if (!user || !supabase) return unauthorized(error ?? undefined);

  const body = await request.json().catch(() => null);
  const token =
    typeof body?.expo_push_token === "string" ? body.expo_push_token : "";

  let query = supabase.from("push_tokens").delete().eq("user_id", user.id);
  if (token) query = query.eq("expo_push_token", token);

  const { error: dbError } = await query;
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
