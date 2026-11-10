// Crop disease / pest diagnosis from a leaf or plant photo.
import { serve } from "../_shared/http.ts";
import { admin, assertOwnPath, downloadAsBase64, enforceLimit, requireUser } from "../_shared/supabase.ts";
import { advisorSystemPrompt, askAI, bool, languageOf, num, obj, str, strArray } from "../_shared/ai.ts";

interface Body {
  image_path?: string;
  field_id?: string;
  crop_hint?: string;
  language?: string;
}

interface Diagnosis {
  is_plant_image: boolean;
  crop_name: string;
  is_healthy: boolean;
  problem_name: string;
  problem_type: string;
  confidence: number;
  severity: string;
  symptoms_seen: string[];
  cause: string;
  organic_treatment: string[];
  chemical_treatment: string[];
  prevention: string[];
  consult_expert: boolean;
  retake_photo_tip: string;
}

const SCHEMA = obj({
  is_plant_image: bool,
  crop_name: str,
  is_healthy: bool,
  problem_name: str,
  problem_type: { type: "string", enum: ["fungal", "bacterial", "viral", "pest", "nutrient_deficiency", "abiotic_stress", "none", "unknown"] },
  confidence: num,
  severity: { type: "string", enum: ["none", "low", "medium", "high"] },
  symptoms_seen: strArray,
  cause: str,
  organic_treatment: strArray,
  chemical_treatment: strArray,
  prevention: strArray,
  consult_expert: bool,
  retake_photo_tip: str,
});

serve<Body>(async (req, body) => {
  const user = await requireUser(req);
  const imagePath = assertOwnPath(user.id, body.image_path);
  await enforceLimit(user.id, "diagnose", 25);
  const lang = languageOf(body.language);

  let fieldId: string | null = null;
  if (body.field_id) {
    const { data } = await admin.from("fields").select("id").eq("id", body.field_id).eq("user_id", user.id).maybeSingle();
    fieldId = data?.id ?? null;
  }

  const img = await downloadAsBase64(imagePath);
  const { json: d } = await askAI<Diagnosis>({
    system: advisorSystemPrompt(lang),
    effort: "medium",
    maxTokens: 8000,
    schema: SCHEMA,
    messages: [{
      role: "user",
      content: [
        { type: "image", mediaType: img.mediaType, data: img.data },
        {
          type: "text",
          text:
            `Diagnose this crop photo from an Indian farm.${body.crop_hint ? ` The farmer says the crop is: ${body.crop_hint.slice(0, 80)}.` : ""}\n` +
            `- If it is not a plant photo, set is_plant_image=false, confidence=0 and explain in retake_photo_tip.\n` +
            `- confidence is 0..1 and must be honest; below 0.6 set consult_expert=true and give a retake_photo_tip (closer, daylight, both leaf sides).\n` +
            `- chemical_treatment: India-approved products with dose per litre of water and safety notes. organic_treatment first-line options.\n` +
            `- All text in the farmer's language; crop_name and problem_name as commonly known locally.`,
        },
      ],
    }],
  });

  const { data, error } = await admin
    .from("disease_reports")
    .insert({
      user_id: user.id,
      field_id: fieldId,
      image_path: imagePath,
      crop_name: d.crop_name,
      disease_name: d.problem_name,
      is_healthy: d.is_healthy,
      confidence: Math.max(0, Math.min(1, d.confidence)),
      severity: d.severity,
      result: d,
      language_code: lang,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
});
