import { admin } from "./supabase.ts";

export async function stateNameOf(code: string | null): Promise<string | null> {
  if (!code) return null;
  const { data } = await admin.from("states").select("name").eq("code", code).maybeSingle();
  return data?.name ?? null;
}

/** Median modal price (₹/quintal) over the last 30 days in the state, falling back to all-India. */
export async function recentMandiPrice(commodity: string | null, state: string | null): Promise<number | null> {
  if (!commodity) return null;
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  for (const s of state ? [state, null] : [null]) {
    let q = admin.from("market_prices").select("modal_price").eq("commodity", commodity).gte("arrival_date", since).limit(200);
    if (s) q = q.eq("state", s);
    const { data } = await q;
    const prices = (data ?? []).map((r) => Number(r.modal_price)).filter((p) => p > 0).sort((a, b) => a - b);
    if (prices.length) return prices[Math.floor(prices.length / 2)];
  }
  return null;
}
