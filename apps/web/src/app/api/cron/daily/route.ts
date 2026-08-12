import { NextRequest, NextResponse } from "next/server";
import {
  isoDateString,
  scrapeAvailableMenusFromToday,
  todayLocal,
} from "@/lib/scraper/fetch";
import { findFavoriteMatches, formatMatchesForPush } from "@/lib/favorites/match";
import { sendDailyDigestNotifications } from "@/lib/push/expo";
import {
  downloadMenuJson,
  getSupabaseAdmin,
  uploadMenuJson,
} from "@/lib/supabase/server";
import type { MenuOutput } from "@berkeley-dining/shared";

export const maxDuration = 300;

function verifyCron(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return process.env.NODE_ENV !== "production";
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {
    scraped_dates: [] as string[],
    notifications: { sent: 0, failed: 0, skipped: 0 },
  };

  try {
    const menus = await scrapeAvailableMenusFromToday({ includeNutrition: true });
    for (const menu of menus) {
      await uploadMenuJson(menu.date, menu);
      (results.scraped_dates as string[]).push(menu.date);
    }

    const today = isoDateString(todayLocal());
    let todayMenu = menus.find((m) => m.date === today) ?? null;
    if (!todayMenu) {
      const stored = await downloadMenuJson(today);
      todayMenu = stored as MenuOutput | null;
    }

    if (todayMenu) {
      const supabase = getSupabaseAdmin();
      const { data: tokens, error: tokenError } = await supabase
        .from("push_tokens")
        .select("user_id, expo_push_token");

      if (tokenError) throw new Error(tokenError.message);

      const userIds = [...new Set((tokens ?? []).map((t) => t.user_id))];
      const favoritesByUser = new Map<string, string[]>();

      if (userIds.length) {
        const { data: favorites, error: favError } = await supabase
          .from("favorite_foods")
          .select("user_id, display_name, food_name")
          .in("user_id", userIds);

        if (favError) throw new Error(favError.message);

        for (const fav of favorites ?? []) {
          const list = favoritesByUser.get(fav.user_id) ?? [];
          list.push(fav.display_name || fav.food_name);
          favoritesByUser.set(fav.user_id, list);
        }
      }

      const recipients: Array<{ userId: string; token: string; body: string }> = [];
      for (const row of tokens ?? []) {
        const favoriteNames = favoritesByUser.get(row.user_id) ?? [];
        if (!favoriteNames.length) {
          (results.notifications as { skipped: number }).skipped += 1;
          continue;
        }
        const matches = findFavoriteMatches(todayMenu, favoriteNames);
        const body = formatMatchesForPush(matches);
        if (!body) {
          (results.notifications as { skipped: number }).skipped += 1;
          continue;
        }
        recipients.push({
          userId: row.user_id,
          token: row.expo_push_token,
          body,
        });
      }

      const pushResult = await sendDailyDigestNotifications(recipients);
      results.notifications = {
        ...pushResult,
        skipped: (results.notifications as { skipped: number }).skipped,
      };
    }

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Cron job failed",
        ...results,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
