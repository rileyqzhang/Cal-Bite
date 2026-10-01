import { NextRequest, NextResponse } from "next/server";
import { runDailyNotify } from "@/lib/cron/jobs";
import { shouldForceCron, verifyCron } from "@/lib/cron/verify";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDailyNotify({ force: shouldForceCron(request) });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
