// Reads a government Soil Health Card photo and stores the values as the field's soil profile.
import { HttpError, serve } from "../_shared/http.ts";
import { admin, assertOwnPath, downloadAsBase64, enforceLimit, requireOwnedField, requireUser } from "../_shared/supabase.ts";
import { askAI, bool, nullable, num, obj, str } from "../_shared/ai.ts";

interface CardValues {
  is_soil_health_card: boolean;
  n_kg_ha: number | null;
  p_kg_ha: number | null;
  k_kg_ha: number | null;
  ph: number | null;
  ec: number | null;
  organic_carbon_pct: number | null;
  micronutrients: { s: number | null; zn: number | null; fe: number | null; cu: number | null; mn: number | null; b: number | null };
  notes: string;
}

const n = nullable(num);
const SCHEMA = obj({
  is_soil_health_card: bool,
  n_kg_ha: n,
  p_kg_ha: n,
  k_kg_ha: n,
  ph: n,
  ec: n,
  organic_carbon_pct: n,
  micronutrients: obj({ s: n, zn: n, fe: n, cu: n, mn: n, b: n }),
  notes: str,
});

serve<{ image_path?: string; field_id?: string }>(async (req, body) => {
  const user = await requireUser(req);
  const field = await requireOwnedField(user.id, body.field_id);
  const imagePath = assertOwnPath(user.id, body.image_path);
  await enforceLimit(user.id, "soil_card", 10);

  const img = await downloadAsBase64(imagePath);
  const { json: v } = await askAI<CardValues>({
    system: "You extract numbers from Indian Soil Health Cards (मृदा स्वास्थ्य कार्ड) accurately. Never guess a value you cannot read; use null.",
    effort: "medium",
    maxTokens: 4000,
    schema: SCHEMA,
    messages: [{
      role: "user",
      content: [
        { type: "image", mediaType: img.mediaType, data: img.data },
        {
          type: "text",
          text:
            "Read the soil test results. Return available nitrogen, phosphorus and potassium in kg/ha " +
            "(if P is given as P2O5 keep it as printed and mention it in notes), pH, EC (dS/m), organic carbon (%), " +
            "and micronutrients in ppm. notes: one short English line about anything unclear.",
        },
      ],
    }],
  });

  if (!v.is_soil_health_card) {
    throw new HttpError(422, "not_soil_card", "This does not look like a Soil Health Card");
  }

  // Keep texture from the satellite estimate; the card does not report it.
  const { data: previous } = await admin
    .from("soil_profiles")
    .select("texture, sand_pct, silt_pct, clay_pct")
    .eq("field_id", field.id)
    .not("texture", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await admin
    .from("soil_profiles")
    .insert({
      user_id: user.id,
      field_id: field.id,
      source: "soil_health_card",
      n_kg_ha: v.n_kg_ha,
      p_kg_ha: v.p_kg_ha,
      k_kg_ha: v.k_kg_ha,
      ph: v.ph,
      ec: v.ec,
      organic_carbon_pct: v.organic_carbon_pct,
      micronutrients: v.micronutrients,
      texture: previous?.texture ?? null,
      sand_pct: previous?.sand_pct ?? null,
      silt_pct: previous?.silt_pct ?? null,
      clay_pct: previous?.clay_pct ?? null,
      card_image_path: imagePath,
      raw: v,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
});
