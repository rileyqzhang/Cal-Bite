import { createClient, SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

export function createSupabaseClient(accessToken?: string): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  return createClient(url, anonKey, {
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });
}

export const MENUS_BUCKET = "menus";

export async function uploadMenuJson(
  menuDate: string,
  data: unknown,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const path = `${menuDate}.json`;
  const body = JSON.stringify(data, null, 2);
  const { error } = await supabase.storage
    .from(MENUS_BUCKET)
    .upload(path, body, {
      contentType: "application/json",
      upsert: true,
    });
  if (error) throw new Error(`Failed to upload menu ${menuDate}: ${error.message}`);
}

export async function downloadMenuJson(menuDate: string): Promise<unknown | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(MENUS_BUCKET)
    .download(`${menuDate}.json`);
  if (error || !data) return null;
  const text = await data.text();
  return JSON.parse(text);
}

export async function listStoredMenuDates(): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(MENUS_BUCKET).list("", {
    limit: 100,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw new Error(`Failed to list menus: ${error.message}`);
  return (data ?? [])
    .map((file) => file.name.replace(/\.json$/, ""))
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .sort();
}
