import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth/request";
import type { NotificationMode } from "@/lib/push/copy";

const MODES = new Set<NotificationMode>(["favorites_only", "always"]);

async function loadOrCreateProfile(
  supabase: NonNullable<Awaited<ReturnType<typeof getAuthUser>>["supabase"]>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("notifications_enabled, notification_mode")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) return data;

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({ id: userId })
    .select("notifications_enabled, notification_mode")
    .single();

  if (insertError) throw new Error(insertError.message);
  return created;
}

export async function GET(request: NextRequest) {
  const { user, supabase, error } = await getAuthUser(request);
  if (!user || !supabase) return unauthorized(error ?? undefined);

  try {
    const profile = await loadOrCreateProfile(supabase, user.id);
    return NextResponse.json({
      notifications_enabled: Boolean(profile.notifications_enabled),
      notification_mode: MODES.has(profile.notification_mode)
        ? profile.notification_mode
        : "favorites_only",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load settings" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const { user, supabase, error } = await getAuthUser(request);
  if (!user || !supabase) return unauthorized(error ?? undefined);

  const body = await request.json().catch(() => null);
  const updates: {
    notifications_enabled?: boolean;
    notification_mode?: NotificationMode;
  } = {};

  if (typeof body?.notifications_enabled === "boolean") {
    updates.notifications_enabled = body.notifications_enabled;
  }
  if (typeof body?.notification_mode === "string" && MODES.has(body.notification_mode)) {
    updates.notification_mode = body.notification_mode;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json(
      { error: "notifications_enabled or notification_mode is required" },
      { status: 400 },
    );
  }

  await loadOrCreateProfile(supabase, user.id);

  const { data, error: dbError } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("notifications_enabled, notification_mode")
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  if (updates.notifications_enabled === false) {
    const { error: tokenError } = await supabase
      .from("push_tokens")
      .delete()
      .eq("user_id", user.id);
    if (tokenError) {
      return NextResponse.json({ error: tokenError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    notifications_enabled: Boolean(data?.notifications_enabled),
    notification_mode: MODES.has(data?.notification_mode)
      ? data.notification_mode
      : "favorites_only",
  });
}
