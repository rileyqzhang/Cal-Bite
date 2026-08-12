import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth/request";
import { normalizeFoodName } from "@berkeley-dining/shared";

export async function GET(request: NextRequest) {
  const { user, supabase, error } = await getAuthUser(request);
  if (!user || !supabase) return unauthorized(error ?? undefined);

  const { data, error: dbError } = await supabase
    .from("favorite_foods")
    .select("id, user_id, food_name, display_name, created_at")
    .eq("user_id", user.id)
    .order("display_name", { ascending: true });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  return NextResponse.json({ favorites: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user, supabase, error } = await getAuthUser(request);
  if (!user || !supabase) return unauthorized(error ?? undefined);

  const body = await request.json().catch(() => null);
  const foodName = typeof body?.food_name === "string" ? body.food_name.trim() : "";
  if (!foodName) {
    return NextResponse.json({ error: "food_name is required" }, { status: 400 });
  }

  const normalized = normalizeFoodName(foodName);
  const { data, error: dbError } = await supabase
    .from("favorite_foods")
    .insert({
      user_id: user.id,
      food_name: normalized,
      display_name: foodName,
    })
    .select("id, user_id, food_name, display_name, created_at")
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 400 });
  }
  return NextResponse.json({ favorite: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { user, supabase, error } = await getAuthUser(request);
  if (!user || !supabase) return unauthorized(error ?? undefined);

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error: dbError } = await supabase
    .from("favorite_foods")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
