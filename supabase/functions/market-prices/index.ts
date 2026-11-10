// Mandi prices from Agmarknet (data.gov.in). Results are cached for 6 hours and
// accumulated in market_prices so the recommendation engine can use recent prices.
import { fetchJson, HttpError, requireString, serve } from "../_shared/http.ts";
import { admin, requireUser } from "../_shared/supabase.ts";

const RESOURCE = "9ef84268-d588-465a-a308-a864a43d0070"; // "Current daily price of various commodities"
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface AgmarkRecord {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  arrival_date: string; // dd/mm/yyyy
  min_price: string | number;
  max_price: string | number;
  modal_price: string | number;
}

serve<{ commodity?: string; state?: string }>(async (req, body) => {
  await requireUser(req);
  const commodity = requireString(body.commodity, "commodity");
  const state = body.state?.trim() || null;

  const cacheKey = `agmarknet:${commodity}:${state ?? "all"}`;
  const { data: cached } = await admin.from("api_cache").select("expires_at").eq("key", cacheKey).maybeSingle();
  const apiKey = Deno.env.get("DATA_GOV_IN_API_KEY");
  let source: "live" | "cache" = "cache";

  if (apiKey && (!cached || new Date(cached.expires_at).getTime() < Date.now())) {
    try {
      const params = new URLSearchParams({ "api-key": apiKey, format: "json", limit: "500", "filters[commodity]": commodity });
      if (state) params.set("filters[state.keyword]", state);
      const res = await fetchJson<{ records?: AgmarkRecord[] }>(`https://api.data.gov.in/resource/${RESOURCE}?${params}`, undefined, 20000);
      const rows = (res.records ?? []).map((r) => {
        const [d, m, y] = r.arrival_date.split("/");
        return {
          state: r.state,
          district: r.district,
          market: r.market,
          commodity: r.commodity,
          variety: r.variety ?? "",
          arrival_date: `${y}-${m}-${d}`,
          min_price: Number(r.min_price) || null,
          max_price: Number(r.max_price) || null,
          modal_price: Number(r.modal_price) || null,
        };
      });
      if (rows.length) {
        const { error } = await admin.from("market_prices").upsert(rows, { onConflict: "market,commodity,variety,arrival_date" });
        if (error) throw error;
      }
      await admin.from("api_cache").upsert({ key: cacheKey, value: { count: rows.length }, expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString() });
      source = "live";
    } catch (err) {
      console.warn("Agmarknet fetch failed; serving stored prices", err);
    }
  }

  const { data, error } = await admin.rpc("latest_prices", { p_commodity: commodity, p_state: state, p_limit: 50 });
  if (error) throw new HttpError(500, "db_error", error.message);
  const prices = (data ?? []).sort((a: { arrival_date: string }, b: { arrival_date: string }) => b.arrival_date.localeCompare(a.arrival_date));
  return { source, configured: Boolean(apiKey), prices };
});
