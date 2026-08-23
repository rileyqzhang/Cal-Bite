import { NextRequest, NextResponse } from "next/server";
import { scrapeAvailableMenusFromToday } from "@/lib/scraper/fetch";
import { verifyCron } from "@/lib/cron/verify";
import { uploadMenuJson } from "@/lib/supabase/server";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {
    scraped_dates: [] as string[],
  };

  try {
    const menus = await scrapeAvailableMenusFromToday({ includeNutrition: true });
    for (const menu of menus) {
      await uploadMenuJson(menu.date, menu);
      (results.scraped_dates as string[]).push(menu.date);
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
