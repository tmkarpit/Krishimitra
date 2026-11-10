// Scheduled job (pg_cron, every 3 hours): scans forecasts for every active field
// and records weather alerts. Alert text is rendered on the device from `type` + `data`
// so it appears in each farmer's own language.
import { HttpError, serve } from "../_shared/http.ts";
import { admin } from "../_shared/supabase.ts";
import { type DailyForecast, fetchForecast } from "../_shared/fieldData.ts";

interface Alert {
  type: "heavy_rain" | "rain" | "heat" | "cold" | "frost" | "wind";
  severity: "info" | "warning" | "severe";
  data: Record<string, number | string>;
}

export function alertsFor(day: DailyForecast): Alert[] {
  const out: Alert[] = [];
  const base = { date: day.date };
  if (day.rain_mm >= 64.5) out.push({ type: "heavy_rain", severity: "severe", data: { ...base, mm: Math.round(day.rain_mm) } });
  else if (day.rain_mm >= 15) out.push({ type: "rain", severity: "warning", data: { ...base, mm: Math.round(day.rain_mm) } });
  if (day.temp_max >= 42) out.push({ type: "heat", severity: day.temp_max >= 45 ? "severe" : "warning", data: { ...base, temp: Math.round(day.temp_max) } });
  if (day.temp_min <= 2) out.push({ type: "frost", severity: "severe", data: { ...base, temp: Math.round(day.temp_min) } });
  else if (day.temp_min <= 6) out.push({ type: "cold", severity: "warning", data: { ...base, temp: Math.round(day.temp_min) } });
  if (day.wind_max_kmh >= 40) out.push({ type: "wind", severity: day.wind_max_kmh >= 60 ? "severe" : "warning", data: { ...base, kmh: Math.round(day.wind_max_kmh) } });
  return out;
}

serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) throw new HttpError(401, "unauthorized");

  const { data: fields, error } = await admin.from("fields").select("id, user_id, lat, lng").eq("is_active", true);
  if (error) throw error;

  // Fields within ~10 km share one forecast request.
  const groups = new Map<string, typeof fields>();
  for (const f of fields ?? []) {
    const key = `${f.lat.toFixed(1)},${f.lng.toFixed(1)}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }

  let created = 0;
  for (const [key, group] of groups) {
    const [lat, lng] = key.split(",").map(Number);
    try {
      const forecast = await fetchForecast(lat, lng);
      const rows = forecast.daily.slice(0, 3).flatMap((day) =>
        alertsFor(day).flatMap((a) =>
          group.map((f) => ({ user_id: f.user_id, field_id: f.id, type: a.type, severity: a.severity, data: a.data, valid_on: day.date }))
        )
      );
      if (rows.length) {
        const { error: insErr, count } = await admin
          .from("alerts")
          .upsert(rows, { onConflict: "field_id,type,valid_on", ignoreDuplicates: true, count: "exact" });
        if (insErr) throw insErr;
        created += count ?? 0;
      }
    } catch (err) {
      console.error("forecast failed for", key, err);
    }
  }

  // Drop alerts older than a week.
  await admin.from("alerts").delete().lt("valid_on", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  return { fields: fields?.length ?? 0, locations: groups.size, alerts_created: created };
});
