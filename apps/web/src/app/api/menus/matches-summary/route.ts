import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth/request";
import {
  countGroupedFavoriteMatches,
  findFavoriteMatches,
} from "@/lib/favorites/match";
import { downloadMenuJson } from "@/lib/supabase/server";
import type { FavoriteMatch, MenuOutput } from "@berkeley-dining/shared";

function parseDates(raw: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const dates: string[] = [];
  for (const part of raw.split(",")) {
    const date = part.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || seen.has(date)) continue;
    seen.add(date);
    dates.push(date);
  }
  return dates;
}

export async function GET(request: NextRequest) {
  const { user, supabase, error } = await getAuthUser(request);
  if (!user || !supabase) return unauthorized(error ?? undefined);

  const dates = parseDates(request.nextUrl.searchParams.get("dates"));
  const detail = request.nextUrl.searchParams.get("detail")?.trim() ?? "";
  if (detail && !/^\d{4}-\d{2}-\d{2}$/.test(detail)) {
    return NextResponse.json({ error: "Invalid detail date" }, { status: 400 });
  }
  if (!dates.length && !detail) {
    return NextResponse.json(
      { error: "Provide dates and/or detail" },
      { status: 400 },
    );
  }

  const dateSet = new Set(dates);
  if (detail) dateSet.add(detail);
  const allDates = [...dateSet];

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

  const menuResults = await Promise.all(
    allDates.map(async (date) => {
      const menuRaw = await downloadMenuJson(date);
      return [date, menuRaw as MenuOutput | null] as const;
    }),
  );

  const counts: Record<string, number> = {};
  let detailMatches: FavoriteMatch[] = [];

  for (const [date, menu] of menuResults) {
    if (!menu) {
      counts[date] = 0;
      continue;
    }
    const matches = findFavoriteMatches(menu, favoriteNames);
    counts[date] = countGroupedFavoriteMatches(matches);
    if (detail === date) detailMatches = matches;
  }

  return NextResponse.json({
    counts,
    detail: detail || null,
    matches: detail ? detailMatches : [],
    favorite_count: favoriteNames.length,
  });
}
