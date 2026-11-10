// Pure agronomy logic: seasons, climate aggregation, crop suitability scoring,
// economics and fertilizer dosing. No I/O here so it can be unit tested.

export type Season = "kharif" | "rabi" | "zaid" | "perennial";

export const SEASON_MONTHS: Record<Season, number[]> = {
  kharif: [6, 7, 8, 9, 10],
  rabi: [11, 12, 1, 2, 3],
  zaid: [3, 4, 5, 6],
  perennial: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

/** The season a farmer would be planning to sow now. */
export function currentSeason(date = new Date()): Season {
  const m = date.getUTCMonth() + 1;
  if (m >= 5 && m <= 8) return "kharif";
  if (m >= 9 || m === 1) return "rabi";
  return "zaid";
}

export interface MonthlyClimate {
  month: number; // 1-12
  temp_mean: number;
  temp_max: number;
  temp_min: number;
  rain_mm: number;
  humidity: number | null;
}

export interface SeasonClimate {
  temp_mean: number;
  temp_max: number;
  temp_min: number;
  rain_mm: number;
  humidity: number;
  annual_rain_mm: number;
}

interface DailyArchive {
  time: string[];
  temperature_2m_mean: (number | null)[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_sum: (number | null)[];
  relative_humidity_2m_mean?: (number | null)[];
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

/** Collapse a year of daily Open-Meteo archive data into 12 monthly rows. */
export function monthlyClimate(daily: DailyArchive): MonthlyClimate[] {
  const buckets = new Map<number, { t: number[]; tx: number[]; tn: number[]; r: number[]; h: number[] }>();
  daily.time.forEach((day, i) => {
    const m = Number(day.slice(5, 7));
    const b = buckets.get(m) ?? { t: [], tx: [], tn: [], r: [], h: [] };
    const push = (arr: number[], v: number | null | undefined) => v != null && arr.push(v);
    push(b.t, daily.temperature_2m_mean[i]);
    push(b.tx, daily.temperature_2m_max[i]);
    push(b.tn, daily.temperature_2m_min[i]);
    push(b.r, daily.precipitation_sum[i]);
    push(b.h, daily.relative_humidity_2m_mean?.[i]);
    buckets.set(m, b);
  });
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([month, b]) => ({
      month,
      temp_mean: round(avg(b.t)),
      temp_max: round(avg(b.tx)),
      temp_min: round(avg(b.tn)),
      rain_mm: round(sum(b.r)),
      humidity: b.h.length ? round(avg(b.h)) : null,
    }));
}

export function seasonClimate(monthly: MonthlyClimate[], season: Season): SeasonClimate {
  const months = monthly.filter((m) => SEASON_MONTHS[season].includes(m.month));
  const rows = months.length ? months : monthly;
  const humidities = rows.map((m) => m.humidity).filter((h): h is number => h != null);
  return {
    temp_mean: round(avg(rows.map((m) => m.temp_mean))),
    temp_max: round(avg(rows.map((m) => m.temp_max))),
    temp_min: round(avg(rows.map((m) => m.temp_min))),
    rain_mm: round(sum(rows.map((m) => m.rain_mm))),
    humidity: humidities.length ? round(avg(humidities)) : 65,
    annual_rain_mm: round(sum(monthly.map((m) => m.rain_mm))),
  };
}

/** Simplified USDA texture triangle -> the texture classes used in the crops table. */
export function textureClass(sand: number | null, silt: number | null, clay: number | null): string | null {
  if (sand == null || silt == null || clay == null) return null;
  if (clay >= 40) return "clayey";
  if (clay >= 27) return "clay_loam";
  if (sand >= 70 && clay < 15) return "sandy";
  if (sand >= 50) return "sandy_loam";
  if (silt >= 50) return "silty";
  return "loamy";
}

// ---------------------------------------------------------------------------
// Suitability scoring
// ---------------------------------------------------------------------------
export interface CropRow {
  id: string;
  slug: string;
  family: string;
  category: string;
  seasons: Season[];
  duration_days_min: number;
  duration_days_max: number;
  temp_min: number;
  temp_max: number;
  rainfall_min_mm: number;
  rainfall_max_mm: number;
  humidity_min: number;
  humidity_max: number;
  ph_min: number;
  ph_max: number;
  water_requirement: "low" | "medium" | "high";
  soil_textures: string[];
  n_req_kg_ha: number;
  p_req_kg_ha: number;
  k_req_kg_ha: number;
  avg_yield_q_ha: number;
  cost_per_ha_inr: number;
  default_price_inr_q: number;
  msp_inr_q: number | null;
  agmarknet_commodity: string | null;
  emoji: string;
}

export interface FieldConditions {
  season: Season;
  climate: SeasonClimate;
  ph: number;
  texture: string | null;
  irrigation: string;
  previous_crop_slug: string | null;
  previous_crop_family: string | null;
}

/** Extra water (mm/season) a farmer can supply from each irrigation source. */
const IRRIGATION_WATER: Record<string, number> = {
  rainfed: 0,
  pond: 300,
  well: 450,
  canal: 600,
  borewell: 600,
  sprinkler: 600,
  drip: 600,
};

/**
 * 1 at the centre of [min, max], easing to `1 - centrePull` at the edges, then falling
 * linearly to 0 over `tolerance` outside the range. The gentle in-range slope keeps crops
 * with wide ranges from all tying at 100.
 */
function rangeFit(value: number, min: number, max: number, tolerance: number, centrePull = 0): number {
  if (value >= min && value <= max) {
    const half = (max - min) / 2 || 1;
    return 1 - centrePull * ((value - (min + max) / 2) / half) ** 2;
  }
  const distance = value < min ? min - value : value - max;
  return Math.max(0, (1 - centrePull) * (1 - distance / tolerance));
}

/** Plant-available water (mm) that deep black/clay soils hold after the monsoon for rabi crops. */
const RESIDUAL_MOISTURE_MM = 200;
/** Orchards are long-term investments; rank them below crops that fit this season. */
const PERENNIAL_FACTOR = 0.8;

export interface ScoreBreakdown {
  temperature: number;
  water: number;
  ph: number;
  humidity: number;
  soil: number;
  rotation: number;
}

export function scoreCrop(crop: CropRow, f: FieldConditions): { score: number; breakdown: ScoreBreakdown } | null {
  const inSeason = crop.seasons.includes(f.season) || crop.seasons.includes("perennial");
  if (!inSeason) return null;

  const c = f.climate;
  // Perennials are judged on the whole year; seasonal crops on the season window.
  const perennialOnly = !crop.seasons.includes(f.season);
  const rain = perennialOnly ? c.annual_rain_mm : c.rain_mm;
  const irrigationWater = IRRIGATION_WATER[f.irrigation] ?? 0;
  const residual = f.season === "rabi" && (f.texture === "clayey" || f.texture === "clay_loam") ? RESIDUAL_MOISTURE_MM : 0;

  const temperature = rangeFit(c.temp_mean, crop.temp_min, crop.temp_max, 6, 0.25);
  // Shortfall can be covered by irrigation; excess rain cannot be removed.
  const waterAvailable = rain + irrigationWater + residual;
  const water = waterAvailable < crop.rainfall_min_mm
    ? rangeFit(waterAvailable, crop.rainfall_min_mm, crop.rainfall_max_mm, crop.rainfall_min_mm * 0.6)
    : rangeFit(rain, 0, crop.rainfall_max_mm, crop.rainfall_max_mm * 0.6);
  const ph = rangeFit(f.ph, crop.ph_min, crop.ph_max, 1.2, 0.1);
  const humidity = rangeFit(c.humidity, crop.humidity_min, crop.humidity_max, 20, 0.2);
  const soil = f.texture == null ? 0.7 : crop.soil_textures.includes(f.texture) ? 1 : f.texture === "loamy" ? 0.6 : 0.35;

  let rotation = 0;
  if (f.previous_crop_slug === crop.slug) rotation -= 0.12;
  else if (f.previous_crop_family && f.previous_crop_family === crop.family) rotation -= 0.06;
  if (crop.family === "fabaceae" && f.previous_crop_family && f.previous_crop_family !== "fabaceae") rotation += 0.05;

  const weighted = 0.27 * temperature + 0.27 * water + 0.16 * ph + 0.1 * humidity + 0.2 * soil + rotation;
  // Any single hard failure (e.g. far too cold) should sink the crop, not be averaged away.
  const limiting = Math.min(temperature, water, ph);
  const factor = (0.6 + 0.4 * limiting) * (perennialOnly ? PERENNIAL_FACTOR : 1);
  const score = Math.round(Math.max(0, Math.min(1, weighted * factor)) * 100);

  return {
    score,
    breakdown: {
      temperature: round(temperature, 2),
      water: round(water, 2),
      ph: round(ph, 2),
      humidity: round(humidity, 2),
      soil: round(soil, 2),
      rotation: round(rotation, 2),
    },
  };
}

export function blendWithModel(ruleScore: number, modelProbability: number | undefined, maxProbability: number): number {
  if (modelProbability == null || maxProbability <= 0) return ruleScore;
  return Math.round(0.6 * ruleScore + 0.4 * (modelProbability / maxProbability) * 100);
}

export interface Economics {
  area_ha: number;
  expected_yield_q: number;
  price_inr_q: number;
  price_source: "mandi" | "msp" | "estimate";
  gross_income_inr: number;
  cost_inr: number;
  net_profit_inr: number;
}

export function estimateEconomics(crop: CropRow, score: number, areaHa: number, mandiPrice: number | null): Economics {
  const yieldPerHa = crop.avg_yield_q_ha * (0.55 + 0.45 * (score / 100));
  const price = mandiPrice ?? crop.msp_inr_q ?? crop.default_price_inr_q;
  const priceSource = mandiPrice ? "mandi" : crop.msp_inr_q ? "msp" : "estimate";
  const expectedYield = yieldPerHa * areaHa;
  const gross = expectedYield * price;
  const cost = crop.cost_per_ha_inr * areaHa;
  return {
    area_ha: round(areaHa, 3),
    expected_yield_q: round(expectedYield, 1),
    price_inr_q: Math.round(price),
    price_source: priceSource,
    gross_income_inr: Math.round(gross),
    cost_inr: Math.round(cost),
    net_profit_inr: Math.round(gross - cost),
  };
}

export function riskLevel(score: number): "low" | "medium" | "high" {
  return score >= 75 ? "low" : score >= 55 ? "medium" : "high";
}

// ---------------------------------------------------------------------------
// Fertilizer calculator (deterministic, never delegated to the LLM)
// ---------------------------------------------------------------------------
type Status = "low" | "medium" | "high" | "unknown";

// Indian soil-test ratings for available nutrients (kg/ha).
export function nutrientStatus(kind: "n" | "p" | "k", value: number | null | undefined): Status {
  if (value == null) return "unknown";
  const [low, high] = kind === "n" ? [280, 560] : kind === "p" ? [10, 25] : [120, 280];
  return value < low ? "low" : value > high ? "high" : "medium";
}

const STATUS_FACTOR: Record<Status, number> = { low: 1.25, medium: 1, high: 0.75, unknown: 1 };

export interface FertilizerPlan {
  area_ha: number;
  soil_status: { n: Status; p: Status; k: Status };
  nutrients_kg_ha: { n: number; p2o5: number; k2o: number };
  products: { slug: string; name: string; kg_per_ha: number; kg_total: number; bags_50kg: number; cost_inr: number }[];
  schedule: { stage: string; day_offset: number; items: { slug: string; kg_total: number }[] }[];
  total_cost_inr: number;
}

export interface FertilizerPrice {
  slug: string;
  name: string;
  price_per_kg_inr: number;
}

export function fertilizerPlan(
  crop: Pick<CropRow, "n_req_kg_ha" | "p_req_kg_ha" | "k_req_kg_ha" | "family" | "duration_days_max">,
  soil: { n_kg_ha?: number | null; p_kg_ha?: number | null; k_kg_ha?: number | null } | null,
  areaHa: number,
  prices: FertilizerPrice[],
): FertilizerPlan {
  const status = {
    n: nutrientStatus("n", soil?.n_kg_ha),
    p: nutrientStatus("p", soil?.p_kg_ha),
    k: nutrientStatus("k", soil?.k_kg_ha),
  };
  const n = crop.n_req_kg_ha * STATUS_FACTOR[status.n];
  const p2o5 = crop.p_req_kg_ha * STATUS_FACTOR[status.p];
  const k2o = crop.k_req_kg_ha * STATUS_FACTOR[status.k];

  // DAP covers all phosphorus (and some N), MOP covers potash, urea tops up nitrogen.
  const dap = p2o5 / 0.46;
  const mop = k2o / 0.6;
  const urea = Math.max(0, n - dap * 0.18) / 0.46;

  const price = (slug: string) => prices.find((p) => p.slug === slug);
  const products = [
    { slug: "dap", perHa: dap },
    { slug: "mop", perHa: mop },
    { slug: "urea", perHa: urea },
  ]
    .filter((p) => p.perHa > 0.5)
    .map(({ slug, perHa }) => {
      const total = perHa * areaHa;
      const info = price(slug);
      return {
        slug,
        name: info?.name ?? slug.toUpperCase(),
        kg_per_ha: round(perHa, 1),
        kg_total: round(total, 1),
        bags_50kg: round(total / 50, 1),
        cost_inr: Math.round(total * (info?.price_per_kg_inr ?? 0)),
      };
    });

  const total = (slug: string) => products.find((p) => p.slug === slug)?.kg_total ?? 0;
  const isLegume = crop.family === "fabaceae";
  const ureaTotal = total("urea");
  // Legumes fix their own N: all urea at sowing. Others: 1/3 basal + two top dressings.
  const schedule = isLegume
    ? [{ stage: "basal", day_offset: 0, items: [{ slug: "dap", kg_total: total("dap") }, { slug: "mop", kg_total: total("mop") }, { slug: "urea", kg_total: ureaTotal }] }]
    : [
      { stage: "basal", day_offset: 0, items: [{ slug: "dap", kg_total: total("dap") }, { slug: "mop", kg_total: total("mop") }, { slug: "urea", kg_total: round(ureaTotal / 3) }] },
      { stage: "top_dressing_1", day_offset: Math.round(crop.duration_days_max * 0.22), items: [{ slug: "urea", kg_total: round(ureaTotal / 3) }] },
      { stage: "top_dressing_2", day_offset: Math.round(crop.duration_days_max * 0.42), items: [{ slug: "urea", kg_total: round(ureaTotal / 3) }] },
    ];

  return {
    area_ha: round(areaHa, 3),
    soil_status: status,
    nutrients_kg_ha: { n: Math.round(n), p2o5: Math.round(p2o5), k2o: Math.round(k2o) },
    products,
    schedule: schedule.map((s) => ({ ...s, items: s.items.filter((i) => i.kg_total > 0) })),
    total_cost_inr: products.reduce((a, p) => a + p.cost_inr, 0),
  };
}

export function hectares(areaSqM: number | null | undefined): number {
  // Pin-only fields default to one acre.
  return areaSqM && areaSqM > 0 ? areaSqM / 10000 : 0.4047;
}
