// Creates a season plan for one crop on one field: deterministic fertilizer
// schedule + AI-written cultivation guidance + dated task list.
import { HttpError, requireString, serve } from "../_shared/http.ts";
import { admin, enforceLimit, requireOwnedField, requireUser } from "../_shared/supabase.ts";
import { ensureSoil, ensureWeather } from "../_shared/fieldData.ts";
import { type CropRow, currentSeason, fertilizerPlan, type FertilizerPrice, hectares, type Season } from "../_shared/agro.ts";
import { advisorSystemPrompt, askAI, int, languageOf, obj, str, strArray } from "../_shared/ai.ts";

interface Body {
  field_id?: string;
  crop_slug?: string;
  sowing_date?: string;
  language?: string;
  recommendation_id?: string;
  season?: Season;
}

interface Guidance {
  crop_local_name: string;
  overview: string;
  land_preparation: string;
  seed: { varieties: string[]; seed_rate: string; spacing: string; seed_treatment: string };
  irrigation: string;
  fertilizer_tips: string;
  organic_options: string[];
  pest_watch: { name: string; signs: string; action: string }[];
  harvest: string;
  tasks: { day_offset: number; stage: string; title: string; description: string }[];
}

const GUIDANCE_SCHEMA = obj({
  crop_local_name: str,
  overview: str,
  land_preparation: str,
  seed: obj({ varieties: strArray, seed_rate: str, spacing: str, seed_treatment: str }),
  irrigation: str,
  fertilizer_tips: str,
  organic_options: strArray,
  pest_watch: { type: "array", items: obj({ name: str, signs: str, action: str }) },
  harvest: str,
  tasks: { type: "array", items: obj({ day_offset: int, stage: str, title: str, description: str }) },
});

serve<Body>(async (req, body) => {
  const user = await requireUser(req);
  const field = await requireOwnedField(user.id, body.field_id);
  const cropSlug = requireString(body.crop_slug, "crop_slug");
  const sowingDate = requireString(body.sowing_date, "sowing_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sowingDate) || isNaN(Date.parse(sowingDate))) {
    throw new HttpError(400, "invalid_input", "sowing_date must be YYYY-MM-DD");
  }
  await enforceLimit(user.id, "plan", 10);
  const lang = languageOf(body.language);

  const [{ data: crop }, { data: fertilizers }, soil, weather] = await Promise.all([
    admin.from("crops").select("*").eq("slug", cropSlug).maybeSingle(),
    admin.from("fertilizers").select("slug, name, price_per_kg_inr"),
    ensureSoil(field),
    ensureWeather(field),
  ]);
  if (!crop) throw new HttpError(404, "not_found", "Unknown crop");
  const c = crop as CropRow;

  const areaHa = hectares(field.area_sq_m);
  const fertilizer = fertilizerPlan(c, soil, areaHa, (fertilizers ?? []) as FertilizerPrice[]);
  const season: Season = body.season ?? (c.seasons.includes(currentSeason()) ? currentSeason() : c.seasons[0]);

  const { json: guidance } = await askAI<Guidance>({
    system: advisorSystemPrompt(lang),
    effort: "medium",
    schema: GUIDANCE_SCHEMA,
    messages: [{
      role: "user",
      content:
        `Write a complete cultivation plan for this farmer.\n\n<plan_input>\n${JSON.stringify({
          crop: { slug: c.slug, duration_days: [c.duration_days_min, c.duration_days_max], water_requirement: c.water_requirement },
          season,
          sowing_date: sowingDate,
          field: { district: field.district, state_code: field.state_code, area_hectare: Math.round(areaHa * 100) / 100, irrigation: field.irrigation },
          soil: soil ? { ph: soil.ph, texture: soil.texture, organic_carbon_pct: soil.organic_carbon_pct } : null,
          next_7_days_weather: weather.daily.map((d) => ({ date: d.date, rain_mm: d.rain_mm, tmax: d.temp_max })),
          fertilizer_plan_already_calculated: fertilizer,
        }, null, 2)}\n</plan_input>\n\n` +
        `Rules:\n- Varieties: suggest 2-3 popular, regionally suitable varieties for this state.\n` +
        `- fertilizer_tips: how to apply the given fertilizer schedule; do NOT change the quantities.\n` +
        `- pest_watch: the 3-4 most common pests/diseases for this crop in this region.\n` +
        `- tasks: 8-14 dated tasks covering land preparation (negative day_offset allowed, down to -15), sowing (day 0), ` +
        `each fertilizer application from the schedule, irrigations at critical stages, weeding, pest scouting and harvest. ` +
        `day_offset is days after sowing. stage is one of: preparation, sowing, vegetative, flowering, fruiting, maturity, harvest. ` +
        `Titles must be short (max 6 words).`,
    }],
  });

  const sowing = new Date(`${sowingDate}T00:00:00Z`);
  const addDays = (n: number) => new Date(sowing.getTime() + n * 86400000).toISOString().slice(0, 10);

  const { data: plan, error } = await admin
    .from("crop_plans")
    .insert({
      user_id: user.id,
      field_id: field.id,
      crop_id: c.id,
      recommendation_id: body.recommendation_id ?? null,
      season,
      sowing_date: sowingDate,
      expected_harvest_date: addDays(c.duration_days_max),
      status: "active",
      fertilizer_plan: fertilizer,
      guidance,
      language_code: lang,
    })
    .select()
    .single();
  if (error) throw error;

  const tasks = guidance.tasks
    .filter((t) => Number.isFinite(t.day_offset))
    .map((t) => ({
      user_id: user.id,
      plan_id: plan.id,
      stage: t.stage,
      title: t.title,
      description: t.description,
      due_date: addDays(Math.max(-30, Math.min(t.day_offset, c.duration_days_max + 30))),
    }));
  if (tasks.length) {
    const { error: taskErr } = await admin.from("crop_plan_tasks").insert(tasks);
    if (taskErr) throw taskErr;
  }

  // Remember the crop for future rotation advice.
  await admin.from("fields").update({ previous_crop_slug: c.slug }).eq("id", field.id);
  await admin.from("field_crop_history").insert({
    user_id: user.id,
    field_id: field.id,
    crop_slug: c.slug,
    season,
    year: sowing.getUTCFullYear(),
  });

  return plan;
});
