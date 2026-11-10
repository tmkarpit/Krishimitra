// deno test supabase/functions/_shared/agro_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  type CropRow,
  currentSeason,
  estimateEconomics,
  fertilizerPlan,
  monthlyClimate,
  nutrientStatus,
  scoreCrop,
  seasonClimate,
  textureClass,
} from "./agro.ts";

const base: CropRow = {
  id: "1", slug: "rice", family: "poaceae", category: "cereal", seasons: ["kharif"],
  duration_days_min: 110, duration_days_max: 150, temp_min: 20, temp_max: 35,
  rainfall_min_mm: 1000, rainfall_max_mm: 2500, humidity_min: 60, humidity_max: 95,
  ph_min: 5, ph_max: 7.5, water_requirement: "high", soil_textures: ["clayey", "clay_loam"],
  n_req_kg_ha: 120, p_req_kg_ha: 60, k_req_kg_ha: 40, avg_yield_q_ha: 45, cost_per_ha_inr: 60000,
  default_price_inr_q: 2369, msp_inr_q: 2369, agmarknet_commodity: "Paddy(Dhan)(Common)", emoji: "🌾",
};
const chickpea: CropRow = {
  ...base, id: "2", slug: "chickpea", family: "fabaceae", seasons: ["rabi"], temp_min: 15, temp_max: 28,
  rainfall_min_mm: 250, rainfall_max_mm: 450, humidity_min: 15, humidity_max: 60, ph_min: 6, ph_max: 8,
  water_requirement: "low", soil_textures: ["loamy", "clay_loam"], n_req_kg_ha: 20, p_req_kg_ha: 50, k_req_kg_ha: 20,
};

const wetKharif = { temp_mean: 28, temp_max: 33, temp_min: 24, rain_mm: 1400, humidity: 82, annual_rain_mm: 1600 };
const dryRabi = { temp_mean: 21, temp_max: 29, temp_min: 13, rain_mm: 60, humidity: 50, annual_rain_mm: 900 };

Deno.test("season by month", () => {
  assertEquals(currentSeason(new Date("2026-07-01")), "kharif");
  assertEquals(currentSeason(new Date("2026-11-04")), "rabi");
  assertEquals(currentSeason(new Date("2026-03-10")), "zaid");
});

Deno.test("texture classes", () => {
  assertEquals(textureClass(20, 30, 50), "clayey");
  assertEquals(textureClass(80, 10, 10), "sandy");
  assertEquals(textureClass(40, 40, 20), "loamy");
  assertEquals(textureClass(null, 10, 10), null);
});

Deno.test("out-of-season crops are excluded", () => {
  const f = { season: "rabi" as const, climate: dryRabi, ph: 7, texture: "loamy", irrigation: "rainfed", previous_crop_slug: null, previous_crop_family: null };
  assertEquals(scoreCrop(base, f), null);
});

Deno.test("rice suits a wet kharif clay field; chickpea suits a dry rabi loam", () => {
  const rice = scoreCrop(base, { season: "kharif", climate: wetKharif, ph: 6.5, texture: "clayey", irrigation: "rainfed", previous_crop_slug: null, previous_crop_family: null })!;
  const gram = scoreCrop(chickpea, { season: "rabi", climate: dryRabi, ph: 7.2, texture: "loamy", irrigation: "well", previous_crop_slug: "rice", previous_crop_family: "poaceae" })!;
  assert(rice.score >= 85, `rice ${rice.score}`);
  assert(gram.score >= 85, `chickpea ${gram.score}`);
  assert(gram.breakdown.rotation > 0, "legume after cereal gets a rotation bonus");
});

Deno.test("irrigation rescues a dry season; repeating a crop is penalised", () => {
  const dry = { ...wetKharif, rain_mm: 400 };
  const rainfed = scoreCrop(base, { season: "kharif", climate: dry, ph: 6.5, texture: "clayey", irrigation: "rainfed", previous_crop_slug: null, previous_crop_family: null })!;
  const canal = scoreCrop(base, { season: "kharif", climate: dry, ph: 6.5, texture: "clayey", irrigation: "canal", previous_crop_slug: null, previous_crop_family: null })!;
  const repeat = scoreCrop(base, { season: "kharif", climate: dry, ph: 6.5, texture: "clayey", irrigation: "canal", previous_crop_slug: "rice", previous_crop_family: "poaceae" })!;
  assert(canal.score > rainfed.score + 15, `canal ${canal.score} vs rainfed ${rainfed.score}`);
  assert(repeat.score < canal.score);
});

Deno.test("fertilizer plan: DAP covers P, urea tops up N, legumes get all urea at sowing", () => {
  const plan = fertilizerPlan(base, { n_kg_ha: 300, p_kg_ha: 15, k_kg_ha: 200 }, 1, [
    { slug: "urea", name: "Urea", price_per_kg_inr: 5.36 },
    { slug: "dap", name: "DAP", price_per_kg_inr: 27 },
    { slug: "mop", name: "MOP", price_per_kg_inr: 34 },
  ]);
  const kg = (s: string) => plan.products.find((p) => p.slug === s)!.kg_per_ha;
  assertEquals(Math.round(kg("dap")), 130); // 60 / 0.46
  assertEquals(Math.round(kg("mop")), 67); // 40 / 0.60
  assertEquals(Math.round(kg("urea")), 210); // (120 - 130.4*0.18) / 0.46
  assertEquals(plan.schedule.length, 3);
  assert(plan.total_cost_inr > 0);

  const legume = fertilizerPlan(chickpea, null, 0.5, []);
  assertEquals(legume.schedule.length, 1);
  assertEquals(legume.soil_status.n, "unknown");
});

Deno.test("nutrient ratings", () => {
  assertEquals(nutrientStatus("n", 200), "low");
  assertEquals(nutrientStatus("p", 18), "medium");
  assertEquals(nutrientStatus("k", 300), "high");
});

Deno.test("economics scale with area and prefer mandi price", () => {
  const e = estimateEconomics(base, 100, 2, 2500);
  assertEquals(e.price_source, "mandi");
  assertEquals(e.expected_yield_q, 90);
  assertEquals(e.net_profit_inr, 90 * 2500 - 120000);
  assertEquals(estimateEconomics(base, 50, 1, null).price_source, "msp");
});

Deno.test("monthly climate aggregation", () => {
  const monthly = monthlyClimate({
    time: ["2026-01-01", "2026-01-02", "2026-07-01"],
    temperature_2m_mean: [15, 17, 30],
    temperature_2m_max: [22, 24, 34],
    temperature_2m_min: [8, 10, 26],
    precipitation_sum: [0, 2, 40],
    relative_humidity_2m_mean: [50, 60, 90],
  });
  assertEquals(monthly.length, 2);
  assertEquals(monthly[0], { month: 1, temp_mean: 16, temp_max: 23, temp_min: 9, rain_mm: 2, humidity: 55 });
  const kharif = seasonClimate(monthly, "kharif");
  assertEquals(kharif.rain_mm, 40);
  assertEquals(kharif.annual_rain_mm, 42);
});
