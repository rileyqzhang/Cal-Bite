import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth/request";
import { findFavoriteMatches } from "@/lib/favorites/match";
import { downloadMenuJson } from "@/lib/supabase/server";
import type { MenuOutput } from "@berkeley-dining/shared";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ date: string }> },
) {
  const { date } = await context.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  const { user, supabase, error } = await getAuthUser(request);
  if (!user || !supabase) return unauthorized(error ?? undefined);

  const menuRaw = await downloadMenuJson(date);
  if (!menuRaw) {
    return NextResponse.json({ error: "Menu not found" }, { status: 404 });
  }
  const menu = menuRaw as MenuOutput;

  const { data: favorites, error: favError } = await supabase
    .from("favorite_foods")
    .select("display_name, food_name")
    .eq("user_id", user.id);

  if (favError) {
    return NextResponse.json({ error: favError.message }, { status: 500 });
  }

  const favoriteNames = (favorites ?? []).map(
    (f) => f.display_name || f.food_name,
  );
  const matches = findFavoriteMatches(menu, favoriteNames);

  return NextResponse.json({
    date,
    matches,
    favorite_count: favoriteNames.length,
  });
}
