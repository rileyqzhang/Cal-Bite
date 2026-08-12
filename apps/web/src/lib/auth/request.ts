import { NextRequest } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/server";

export async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { user: null, error: "Missing authorization header" };
  }
  const token = authHeader.slice("Bearer ".length);
  const supabase = createSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { user: null, error: error?.message ?? "Unauthorized" };
  }
  return { user: data.user, supabase, token };
}

export function unauthorized(message = "Unauthorized") {
  return Response.json({ error: message }, { status: 401 });
}
