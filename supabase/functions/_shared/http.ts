export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Wraps a handler with CORS preflight, JSON body parsing and uniform error responses. */
export function serve<T>(handler: (req: Request, body: T) => Promise<unknown>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    try {
      const body = req.method === "POST" ? ((await req.json().catch(() => ({}))) as T) : ({} as T);
      return json({ data: await handler(req, body) });
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ error: { code: err.code, message: err.message } }, err.status);
      }
      console.error(err);
      return json({ error: { code: "internal", message: "Something went wrong" } }, 500);
    }
  });
}

export function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, "invalid_input", `${name} is required`);
  }
  return value.trim();
}

export async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 15000): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${url.split("?")[0]} -> ${res.status} ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}
