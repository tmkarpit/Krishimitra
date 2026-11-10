import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// Projects on the new API keys get SUPABASE_SECRET_KEYS (a JSON map); older ones get the legacy service_role key.
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  (JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>).default;

/** Service-role client: bypasses RLS. Only use after ownership has been checked. */
export const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function requireUser(req: Request): Promise<User> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "unauthorized", "Missing auth token");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "unauthorized", "Invalid session");
  return data.user;
}

export async function requireOwnedField(userId: string, fieldId: unknown) {
  if (typeof fieldId !== "string") throw new HttpError(400, "invalid_input", "field_id is required");
  const { data, error } = await admin.from("fields").select("*").eq("id", fieldId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "not_found", "Field not found");
  return data as Field;
}

/** Storage paths must live under the caller's folder: "<uid>/...". */
export function assertOwnPath(userId: string, path: unknown): string {
  if (typeof path !== "string" || !path.startsWith(`${userId}/`) || path.includes("..")) {
    throw new HttpError(403, "forbidden", "Invalid file path");
  }
  return path;
}

export async function downloadAsBase64(path: string): Promise<{ data: string; mediaType: string }> {
  const { data, error } = await admin.storage.from("uploads").download(path);
  if (error || !data) throw new HttpError(404, "not_found", "Upload not found");
  const bytes = new Uint8Array(await data.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return { data: btoa(binary), mediaType: data.type || "image/jpeg" };
}

export async function enforceLimit(userId: string, kind: string, limit: number) {
  const { data, error } = await admin.rpc("increment_usage", { p_user: userId, p_kind: kind, p_limit: limit });
  if (error) throw error;
  if (data === false) throw new HttpError(429, "daily_limit", `Daily limit reached for ${kind}`);
}

export async function getProfile(userId: string) {
  const { data } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
  return data as Profile | null;
}

export interface Field {
  id: string;
  user_id: string;
  name: string;
  lat: number;
  lng: number;
  area_sq_m: number | null;
  state_code: string | null;
  district: string | null;
  village: string | null;
  irrigation: string;
  previous_crop_slug: string | null;
  elevation_m: number | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  language_code: string;
  state_code: string | null;
  district: string | null;
  village: string | null;
  farmer_type: string | null;
  land_unit: string;
}
