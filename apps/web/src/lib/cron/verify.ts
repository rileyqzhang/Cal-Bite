import { NextRequest } from "next/server";

export function verifyCron(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return process.env.NODE_ENV !== "production";
  return authHeader === `Bearer ${cronSecret}`;
}

export function shouldForceCron(request: NextRequest): boolean {
  return request.nextUrl.searchParams.get("force") === "1";
}
