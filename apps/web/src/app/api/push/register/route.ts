import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth/request";

export async function POST(request: NextRequest) {
  const { user, supabase, error } = await getAuthUser(request);
  if (!user || !supabase) return unauthorized(error ?? undefined);

  const body = await request.json().catch(() => null);
  const token = typeof body?.expo_push_token === "string" ? body.expo_push_token : "";
  if (!token) {
    return NextResponse.json({ error: "expo_push_token is required" }, { status: 400 });
  }

  const { error: dbError } = await supabase.from("push_tokens").upsert(
    {
      user_id: user.id,
      expo_push_token: token,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "expo_push_token" },
  );

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
