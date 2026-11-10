// AI crop valuation: the farmer photographs their field/crop; the AI reads land type,
// crop, growth stage and health from the photos, and the ₹ value is computed from
// regional yield × area × the AI's condition factor × mandi/MSP price.
import { HttpError, serve } from "../_shared/http.ts";
import { admin, assertOwnPath, downloadAsBase64, enforceLimit, requireUser } from "../_shared/supabase.ts";
import { advisorSystemPrompt, type AiPart, askAI, bool, languageOf, num, obj, str, strArray } from "../_shared/ai.ts";
import { type CropRow, hectares } from "../_shared/agro.ts";
import { recentMandiPrice, stateNameOf } from "../_shared/market.ts";

interface Body {
  image_paths?: string[];
  field_id?: string;
  crop_slug?: string;
  area_sq_m?: number;
  language?: string;
}

const STAGES = ["land_preparation", "seedling", "vegetative", "flowering", "fruiting", "maturity", "harvested", "unknown"];

interface Reading {
  is_farm_photo: boolean;
  land_type: string;
  crop_slug: string;
  crop_name_local: string;
  growth_stage: string;
  health: "good" | "fair" | "poor" | "unknown";
  yield_factor: number;
  confidence: number;
  observations: string[];
  advice: string[];
}

serve<Body>(async (req, body) => {
  const user = await requireUser(req);
  const paths = (body.image_paths ?? []).slice(0, 3).map((p) => assertOwnPath(user.id, p));
  if (!paths.length) throw new HttpError(400, "invalid_input", "At least one photo is required");
  await enforceLimit(user.id, "valuation", 15);
  const lang = languageOf(body.language);

  // Area and location come from the saved field when there is one.
  let field: { id: string; area_sq_m: number | null; state_code: string | null; district: string | null } | null = null;
  if (body.field_id) {
    const { data } = await admin.from("fields").select("id, area_sq_m, state_code, district").eq("id", body.field_id).eq("user_id", user.id).maybeSingle();
    field = data;
  }
  const areaSqM = field?.area_sq_m ?? (body.area_sq_m && body.area_sq_m > 0 ? body.area_sq_m : 4046.86);

  const { data: cropRows, error } = await admin.from("crops").select("*").eq("is_active", true);
  if (error) throw error;
  const crops = cropRows as CropRow[];
  const slugs = crops.map((c) => c.slug);

  const images: AiPart[] = await Promise.all(paths.map(async (p) => {
    const img = await downloadAsBase64(p);
    return { type: "image" as const, mediaType: img.mediaType, data: img.data };
  }));

  const { json: r } = await askAI<Reading>({
    system: advisorSystemPrompt(lang),
    effort: "medium",
    maxTokens: 8000,
    schema: obj({
      is_farm_photo: bool,
      land_type: str,
      crop_slug: { type: "string", enum: [...slugs, "unknown"] },
      crop_name_local: str,
      growth_stage: { type: "string", enum: STAGES },
      health: { type: "string", enum: ["good", "fair", "poor", "unknown"] },
      yield_factor: num,
      confidence: num,
      observations: strArray,
      advice: strArray,
    }),
    messages: [{
      role: "user",
      content: [
        ...images,
        {
          type: "text",
          text:
            `These are photos of a farmer's field in ${field?.district ?? "India"}.` +
            (body.crop_slug ? ` The farmer says the crop is "${body.crop_slug}".` : "") +
            `\n- is_farm_photo=false if the photos do not show farmland or crops.` +
            `\n- land_type: one short line describing soil colour/type (e.g. black cotton soil, red laterite, alluvial), terrain and any visible irrigation.` +
            `\n- crop_slug: the crop you see (or the farmer's crop), from the allowed list; "unknown" if no crop is visible.` +
            `\n- yield_factor: expected yield relative to a typical healthy crop of this region, between 0.3 and 1.3, judged from stand density, colour, pests, weeds and stress. Use 1.0 if unsure.` +
            `\n- confidence 0..1, honest. observations: 2-4 things you see. advice: 2-3 actions to protect or improve the yield.` +
            `\n- land_type, crop_name_local, observations and advice must be in the farmer's language.`,
        },
      ],
    }],
  });

  if (!r.is_farm_photo) throw new HttpError(422, "not_farm_photo", "Photos do not show farmland or a crop");

  const slug = body.crop_slug && slugs.includes(body.crop_slug) ? body.crop_slug : r.crop_slug;
  const crop = crops.find((c) => c.slug === slug) ?? null;
  const factor = Math.max(0.3, Math.min(1.3, Number.isFinite(r.yield_factor) ? r.yield_factor : 1));
  const areaHa = hectares(areaSqM);

  let economics: { expected_yield_q: number; price_inr_q: number; price_source: string; value_low_inr: number; value_high_inr: number } | null = null;
  if (crop && !["land_preparation", "harvested"].includes(r.growth_stage)) {
    const mandi = await recentMandiPrice(crop.agmarknet_commodity, await stateNameOf(field?.state_code ?? null));
    const price = mandi ?? crop.msp_inr_q ?? crop.default_price_inr_q;
    const expected = crop.avg_yield_q_ha * areaHa * factor;
    // Wider band when the AI is less sure of what it sees.
    const spread = 0.1 + 0.2 * (1 - Math.max(0, Math.min(1, r.confidence)));
    economics = {
      expected_yield_q: Math.round(expected * 10) / 10,
      price_inr_q: Math.round(price),
      price_source: mandi ? "mandi" : crop.msp_inr_q ? "msp" : "estimate",
      value_low_inr: Math.round(expected * (1 - spread) * price),
      value_high_inr: Math.round(expected * (1 + spread) * price),
    };
  }

  const { data, error: insErr } = await admin
    .from("crop_valuations")
    .insert({
      user_id: user.id,
      field_id: field?.id ?? null,
      crop_slug: crop?.slug ?? null,
      image_paths: paths,
      area_sq_m: areaSqM,
      land_type: r.land_type,
      growth_stage: r.growth_stage,
      health: r.health,
      expected_yield_q: economics?.expected_yield_q ?? null,
      value_low_inr: economics?.value_low_inr ?? null,
      value_high_inr: economics?.value_high_inr ?? null,
      price_inr_q: economics?.price_inr_q ?? null,
      price_source: economics?.price_source ?? null,
      result: { ...r, yield_factor: factor, crop_emoji: crop?.emoji ?? "🌱" },
      language_code: lang,
    })
    .select()
    .single();
  if (insErr) throw insErr;
  return data;
});
