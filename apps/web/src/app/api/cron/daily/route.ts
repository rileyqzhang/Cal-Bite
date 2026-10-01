import { NextRequest, NextResponse } from "next/server";
import { runDailyScrape } from "@/lib/cron/jobs";
import { verifyCron } from "@/lib/cron/verify";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDailyScrape();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
