// Fetches and caches soil (SoilGrids) and weather/climate (Open-Meteo) for a field.
// Both data sources are free and need no API key.
import { fetchJson } from "./http.ts";
import { admin, type Field } from "./supabase.ts";
import { monthlyClimate, textureClass, type MonthlyClimate } from "./agro.ts";

const WEATHER_TTL_MS = 60 * 60 * 1000;

export interface SoilProfile {
  id: string;
  source: string;
  n_kg_ha: number | null;
  p_kg_ha: number | null;
  k_kg_ha: number | null;
  ph: number | null;
  organic_carbon_pct: number | null;
  sand_pct: number | null;
  silt_pct: number | null;
  clay_pct: number | null;
  cec: number | null;
  texture: string | null;
  created_at: string;
}

export interface DailyForecast {
  date: string;
  weather_code: number;
  temp_max: number;
  temp_min: number;
  rain_mm: number;
  rain_probability: number | null;
  wind_max_kmh: number;
}

export interface WeatherSnapshot {
  id: string;
  current: {
    time: string;
    temperature: number;
    humidity: number;
    precipitation: number;
    weather_code: number;
    wind_kmh: number;
  };
  daily: DailyForecast[];
  climate: { monthly: MonthlyClimate[]; elevation_m: number | null };
  fetched_at: string;
}

// ---------------------------------------------------------------------------
// Soil
// ---------------------------------------------------------------------------
interface SoilGridsResponse {
  properties: {
    layers: {
      name: string;
      unit_measure: { d_factor: number };
      depths: { label: string; values: { mean: number | null } }[];
    }[];
  };
}

const DEPTH_WEIGHTS: Record<string, number> = { "0-5cm": 5, "5-15cm": 10, "15-30cm": 15 };

async function fetchSoilGrids(lat: number, lng: number) {
  const props = ["phh2o", "soc", "nitrogen", "clay", "sand", "silt", "cec"];
  const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lng}&lat=${lat}` +
    props.map((p) => `&property=${p}`).join("") +
    "&depth=0-5cm&depth=5-15cm&depth=15-30cm&value=mean";
  const res = await fetchJson<SoilGridsResponse>(url, undefined, 20000);

  // Depth-weighted mean over the top 30 cm, converted to conventional units via d_factor.
  const values: Record<string, number | null> = {};
  for (const layer of res.properties.layers) {
    let total = 0;
    let weight = 0;
    for (const d of layer.depths) {
      const w = DEPTH_WEIGHTS[d.label];
      if (w && d.values.mean != null) {
        total += (d.values.mean / layer.unit_measure.d_factor) * w;
        weight += w;
      }
    }
    values[layer.name] = weight ? total / weight : null;
  }
  return { values, raw: res };
}

export async function ensureSoil(field: Field): Promise<SoilProfile | null> {
  const { data: existing } = await admin
    .from("soil_profiles")
    .select("*")
    .eq("field_id", field.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing as SoilProfile;

  let v: Record<string, number | null> = {};
  try {
    v = (await fetchSoilGrids(field.lat, field.lng)).values;
  } catch (err) {
    console.warn("SoilGrids unavailable", err);
  }

  let row;
  if (v.phh2o != null) {
    const sand = v.sand, silt = v.silt, clay = v.clay;
    row = {
      source: "soilgrids",
      ph: round(v.phh2o, 1),
      organic_carbon_pct: v.soc != null ? round(v.soc / 10, 2) : null, // g/kg -> %
      // Rough available-N estimate from total N (g/kg) for the plough layer; SoilGrids has no P/K.
      n_kg_ha: v.nitrogen != null ? Math.round(v.nitrogen * 224) : null,
      sand_pct: round(sand, 1),
      silt_pct: round(silt, 1),
      clay_pct: round(clay, 1),
      cec: round(v.cec, 1),
      texture: textureClass(sand, silt, clay),
      raw: v,
    };
  } else {
    // SoilGrids has no coverage for much of India; fall back to the state's dominant soil.
    if (!field.state_code) return null;
    const { data: state } = await admin
      .from("states")
      .select("soil_texture, soil_ph, soil_group")
      .eq("code", field.state_code)
      .maybeSingle();
    if (!state?.soil_ph) return null;
    row = { source: "regional", ph: state.soil_ph, texture: state.soil_texture, raw: { soil_group: state.soil_group } };
  }

  const { data, error } = await admin
    .from("soil_profiles")
    .insert({ ...row, user_id: field.user_id, field_id: field.id })
    .select()
    .single();
  if (error) throw error;
  return data as SoilProfile;
}

// ---------------------------------------------------------------------------
// Weather & climate
// ---------------------------------------------------------------------------
interface ForecastResponse {
  elevation: number;
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: (number | null)[];
    wind_speed_10m_max: number[];
  };
}

export async function fetchForecast(lat: number, lng: number) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    "&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max" +
    "&timezone=Asia%2FKolkata&forecast_days=7";
  const f = await fetchJson<ForecastResponse>(url);
  const daily: DailyForecast[] = f.daily.time.map((date, i) => ({
    date,
    weather_code: f.daily.weather_code[i],
    temp_max: f.daily.temperature_2m_max[i],
    temp_min: f.daily.temperature_2m_min[i],
    rain_mm: f.daily.precipitation_sum[i],
    rain_probability: f.daily.precipitation_probability_max[i],
    wind_max_kmh: f.daily.wind_speed_10m_max[i],
  }));
  return {
    elevation: f.elevation,
    current: {
      time: f.current.time,
      temperature: f.current.temperature_2m,
      humidity: f.current.relative_humidity_2m,
      precipitation: f.current.precipitation,
      weather_code: f.current.weather_code,
      wind_kmh: f.current.wind_speed_10m,
    },
    daily,
  };
}

async function fetchClimate(lat: number, lng: number): Promise<MonthlyClimate[]> {
  // Archive data lags ~5 days; take the 365 days ending a week ago.
  const end = new Date(Date.now() - 7 * 86400000);
  const start = new Date(end.getTime() - 364 * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}` +
    `&start_date=${iso(start)}&end_date=${iso(end)}` +
    "&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean" +
    "&timezone=Asia%2FKolkata";
  const res = await fetchJson<{ daily: Parameters<typeof monthlyClimate>[0] }>(url, undefined, 25000);
  return monthlyClimate(res.daily);
}

export async function ensureWeather(field: Field, force = false): Promise<WeatherSnapshot> {
  const { data: latest } = await admin
    .from("weather_snapshots")
    .select("*")
    .eq("field_id", field.id)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fresh = latest && Date.now() - new Date(latest.fetched_at).getTime() < WEATHER_TTL_MS;
  if (latest && fresh && !force) return latest as WeatherSnapshot;

  const forecast = await fetchForecast(field.lat, field.lng);
  // Climate normals change slowly; reuse the previous year's aggregate when we have one.
  const monthly: MonthlyClimate[] = latest?.climate?.monthly?.length === 12
    ? latest.climate.monthly
    : await fetchClimate(field.lat, field.lng);

  const { data, error } = await admin
    .from("weather_snapshots")
    .insert({
      user_id: field.user_id,
      field_id: field.id,
      current: forecast.current,
      daily: forecast.daily,
      climate: { monthly, elevation_m: forecast.elevation ?? null },
    })
    .select()
    .single();
  if (error) throw error;

  await admin.from("weather_snapshots").delete().eq("field_id", field.id).lt("fetched_at", data.fetched_at);
  if (forecast.elevation != null && field.elevation_m == null) {
    await admin.from("fields").update({ elevation_m: forecast.elevation }).eq("id", field.id);
  }
  return data as WeatherSnapshot;
}

function round(x: number | null | undefined, d: number): number | null {
  return x == null ? null : Math.round(x * 10 ** d) / 10 ** d;
}
