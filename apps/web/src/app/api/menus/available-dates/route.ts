import { NextResponse } from "next/server";
import { listStoredMenuDates } from "@/lib/supabase/server";
import { todayLocal, isoDateString } from "@/lib/scraper/fetch";

export async function GET() {
  try {
    const dates = await listStoredMenuDates();
    const today = isoDateString(todayLocal());
    const available = dates.filter((d) => d >= today);
    return NextResponse.json({ dates: available.length ? available : dates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list dates" },
      { status: 500 },
    );
  }
}
