// AI crop recommendation: rule-based suitability (+ optional XGBoost service),
// economics from mandi prices, and a farmer-friendly explanation from Claude.
import { HttpError, serve } from "../_shared/http.ts";
import { admin, enforceLimit, requireOwnedField, requireUser } from "../_shared/supabase.ts";
import { ensureSoil, ensureWeather } from "../_shared/fieldData.ts";
import {
  blendWithModel,
  type CropRow,
  currentSeason,
  estimateEconomics,
  hectares,
  riskLevel,
  type Season,
  seasonClimate,
  scoreCrop,
} from "../_shared/agro.ts";
import { advisorSystemPrompt, askAI, languageOf, modelLabel, obj, str, strArray } from "../_shared/ai.ts";
import { recentMandiPrice, stateNameOf } from "../_shared/market.ts";

const SEASONS: Season[] = ["kharif", "rabi", "zaid"];
const TOP_N = 5;

interface Body {
  field_id?: string;
  season?: Season;
  language?: string;
}

interface Explanation {
  summary: string;
  crops: { slug: string; local_name: string; why: string; risks: string; sowing_window: string; key_tips: string[] }[];
}

const EXPLANATION_SCHEMA = obj({
  summary: str,
  crops: {
    type: "array",
    items: obj({ slug: str, local_name: str, why: str, risks: str, sowing_window: str, key_tips: strArray }),
  },
});

serve<Body>(async (req, body) => {
  const user = await requireUser(req);
  const field = await requireOwnedField(user.id, body.field_id);
  await enforceLimit(user.id, "recommend", 20);

  const lang = languageOf(body.language);
  const season: Season = body.season && SEASONS.includes(body.season) ? body.season : currentSeason();
  const year = new Date().getFullYear();

  const [soil, weather, cropsRes] = await Promise.all([
    ensureSoil(field),
    ensureWeather(field),
    admin.from("crops").select("*").eq("is_active", true),
  ]);
  if (cropsRes.error) throw cropsRes.error;
  const crops = cropsRes.data as CropRow[];

  const climate = seasonClimate(weather.climate.monthly, season);
  const previous = crops.find((c) => c.slug === field.previous_crop_slug) ?? null;
  const conditions = {
    season,
    climate,
    ph: soil?.ph ?? 7,
    texture: soil?.texture ?? null,
    irrigation: field.irrigation,
    previous_crop_slug: field.previous_crop_slug,
    previous_crop_family: previous?.family ?? null,
  };

  const model = await predictWithModel({
    N: soil?.n_kg_ha != null ? Math.min(140, soil.n_kg_ha / 4) : 50,
    P: soil?.p_kg_ha ?? 50,
    K: soil?.k_kg_ha ?? 50,
    temperature: climate.temp_mean,
    humidity: climate.humidity,
    ph: conditions.ph,
    rainfall: climate.rain_mm / Math.max(1, SEASONS_LENGTH[season]),
  });
  const maxProb = model ? Math.max(...Object.values(model.probabilities)) : 0;

  const ranked = crops
    .map((crop) => {
      const s = scoreCrop(crop, conditions);
      if (!s) return null;
      const score = blendWithModel(s.score, model?.probabilities[crop.slug], maxProb);
      return { crop, score, breakdown: s.breakdown };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && x.score >= 35)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N);

  if (!ranked.length) throw new HttpError(422, "no_suitable_crops", "No suitable crops found for this season");

  const areaHa = hectares(field.area_sq_m);
  const stateName = await stateNameOf(field.state_code);
  const results = await Promise.all(
    ranked.map(async ({ crop, score, breakdown }) => {
      const mandiPrice = await recentMandiPrice(crop.agmarknet_commodity, stateName);
      return {
        crop_id: crop.id,
        slug: crop.slug,
        emoji: crop.emoji,
        score,
        risk: riskLevel(score),
        breakdown,
        water_requirement: crop.water_requirement,
        duration_days: [crop.duration_days_min, crop.duration_days_max],
        economics: estimateEconomics(crop, score, areaHa, mandiPrice),
      };
    }),
  );

  const context = {
    location: { state: stateName, district: field.district, village: field.village },
    area_hectare: Math.round(areaHa * 100) / 100,
    season,
    irrigation: field.irrigation,
    previous_crop: field.previous_crop_slug,
    soil: soil
      ? { ph: soil.ph, texture: soil.texture, organic_carbon_pct: soil.organic_carbon_pct, source: soil.source }
      : { note: "No soil data; assumed neutral pH loam" },
    season_climate_last_year: climate,
    next_7_days: weather.daily.map((d) => ({ date: d.date, rain_mm: d.rain_mm, tmax: d.temp_max, tmin: d.temp_min })),
    ranked_crops: results.map((r) => ({
      slug: r.slug,
      suitability_score: r.score,
      risk: r.risk,
      fit: r.breakdown,
      duration_days: r.duration_days,
      expected_yield_quintal: r.economics.expected_yield_q,
      price_per_quintal: r.economics.price_inr_q,
      estimated_net_profit_inr: r.economics.net_profit_inr,
    })),
  };

  const { json: explanation } = await askAI<Explanation>({
    system: advisorSystemPrompt(lang),
    effort: "medium",
    schema: EXPLANATION_SCHEMA,
    messages: [{
      role: "user",
      content:
        `Our scoring model ranked these crops for a farmer's field. Explain the recommendation to the farmer.\n\n` +
        `<field_analysis>\n${JSON.stringify(context, null, 2)}\n</field_analysis>\n\n` +
        `For each crop (same slugs, same order) give: local_name (the crop's common name in the farmer's language), ` +
        `why it suits this field (1-2 sentences, mention soil/rain/temperature/price where relevant), main risks, ` +
        `the best sowing window for this region and season, and 2-3 short practical tips. ` +
        `summary: 2-3 sentences comparing the top choices, including the profit estimate in rupees. ` +
        `Profit numbers are estimates; say so once in the summary.`,
    }],
  });

  const merged = results.map((r) => {
    const e = explanation.crops.find((c) => c.slug === r.slug);
    return { ...r, local_name: e?.local_name ?? r.slug, why: e?.why ?? "", risks: e?.risks ?? "", sowing_window: e?.sowing_window ?? "", key_tips: e?.key_tips ?? [] };
  });

  const { data, error } = await admin
    .from("recommendations")
    .insert({
      user_id: user.id,
      field_id: field.id,
      season,
      year,
      input_features: { ...conditions, soil_source: soil?.source ?? null, ml_model: model?.version ?? null },
      results: merged,
      summary: explanation.summary,
      language_code: lang,
      model_version: `rules-v1${model ? `+${model.version}` : ""}|${modelLabel()}`,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
});

const SEASONS_LENGTH: Record<Season, number> = { kharif: 5, rabi: 5, zaid: 4, perennial: 12 };

/** Optional XGBoost service (ml-service/). Returns null when not configured or unreachable. */
async function predictWithModel(features: Record<string, number>) {
  const url = Deno.env.get("ML_SERVICE_URL");
  if (!url) return null;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/predict/crop`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("ML_SERVICE_TOKEN") ?? ""}` },
      body: JSON.stringify(features),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`ML service ${res.status}`);
    const body = (await res.json()) as { predictions: { crop: string; probability: number }[]; model_version: string };
    return {
      version: body.model_version,
      probabilities: Object.fromEntries(body.predictions.map((p) => [p.crop, p.probability])) as Record<string, number>,
    };
  } catch (err) {
    console.warn("ML service unavailable, using rules only", err);
    return null;
  }
}
