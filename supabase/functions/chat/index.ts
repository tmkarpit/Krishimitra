// Farm-aware AI assistant (text + optional photo). Stores the conversation.
import { HttpError, serve } from "../_shared/http.ts";
import { admin, assertOwnPath, downloadAsBase64, enforceLimit, getProfile, requireUser } from "../_shared/supabase.ts";
import { advisorSystemPrompt, type AiMessage, type AiPart, askAI, languageOf } from "../_shared/ai.ts";

interface Body {
  session_id?: string;
  message?: string;
  image_path?: string;
  field_id?: string;
  language?: string;
}

const HISTORY_LIMIT = 16;

serve<Body>(async (req, body) => {
  const user = await requireUser(req);
  const text = (body.message ?? "").trim().slice(0, 4000);
  const imagePath = body.image_path ? assertOwnPath(user.id, body.image_path) : null;
  if (!text && !imagePath) throw new HttpError(400, "invalid_input", "message or image_path is required");
  await enforceLimit(user.id, "chat", 80);
  const lang = languageOf(body.language);

  // Session --------------------------------------------------------------
  let sessionId = body.session_id ?? null;
  let sessionFieldId = body.field_id ?? null;
  if (sessionId) {
    const { data: s } = await admin.from("chat_sessions").select("id, field_id").eq("id", sessionId).eq("user_id", user.id).maybeSingle();
    if (!s) throw new HttpError(404, "not_found", "Chat not found");
    sessionFieldId = sessionFieldId ?? s.field_id;
  } else {
    const { data: s, error } = await admin
      .from("chat_sessions")
      .insert({ user_id: user.id, field_id: sessionFieldId, title: (text || "📷").slice(0, 60), language_code: lang })
      .select("id")
      .single();
    if (error) throw error;
    sessionId = s.id;
  }

  // Context + history ----------------------------------------------------
  const [context, { data: history }] = await Promise.all([
    farmContext(user.id, sessionFieldId),
    admin
      .from("chat_messages")
      .select("role, content, image_path")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);

  const messages: AiMessage[] = (history ?? [])
    .reverse()
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.image_path ? `[farmer attached a photo]\n${m.content}` : m.content,
    }));

  const content: AiPart[] = [];
  if (imagePath) {
    const img = await downloadAsBase64(imagePath);
    content.push({ type: "image", mediaType: img.mediaType, data: img.data });
  }
  content.push({
    type: "text",
    text: `<farm_context>\n${JSON.stringify(context)}\n</farm_context>\n\n${text || "Please look at this photo and tell me what you see and what I should do."}`,
  });
  messages.push({ role: "user", content });

  const { text: reply, usage } = await askAI({
    system: advisorSystemPrompt(lang) +
      "\n\nThis is a chat. Answers are often read aloud, so keep them short (under 150 words unless the farmer asks for detail), " +
      "use plain sentences or a short numbered list, and avoid tables and markdown headings.",
    messages,
    effort: "low",
    maxTokens: 4000,
  });

  const { data: saved, error } = await admin
    .from("chat_messages")
    .insert([
      { user_id: user.id, session_id: sessionId, role: "user", content: text, image_path: imagePath },
      { user_id: user.id, session_id: sessionId, role: "assistant", content: reply, tokens_in: usage.input_tokens, tokens_out: usage.output_tokens },
    ])
    .select();
  if (error) throw error;
  await admin.from("chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId);

  return { session_id: sessionId, messages: saved };
});

async function farmContext(userId: string, fieldId: string | null) {
  const profile = await getProfile(userId);
  let fieldQuery = admin
    .from("fields")
    .select("id, name, district, village, state_code, area_sq_m, irrigation, previous_crop_slug")
    .eq("user_id", userId)
    .eq("is_active", true);
  fieldQuery = fieldId ? fieldQuery.eq("id", fieldId) : fieldQuery.order("created_at").limit(1);
  const { data: field } = await fieldQuery.maybeSingle();

  if (!field) {
    return { farmer: { name: profile?.full_name, state: profile?.state_code, district: profile?.district }, field: null, today: today() };
  }

  const [{ data: soil }, { data: weather }, { data: plans }] = await Promise.all([
    admin.from("soil_profiles").select("ph, texture, n_kg_ha, p_kg_ha, k_kg_ha, organic_carbon_pct, source")
      .eq("field_id", field.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("weather_snapshots").select("current, daily")
      .eq("field_id", field.id).order("fetched_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("crop_plans").select("sowing_date, expected_harvest_date, crops(slug)")
      .eq("field_id", field.id).eq("status", "active"),
  ]);

  return {
    today: today(),
    farmer: { name: profile?.full_name, state: profile?.state_code, district: profile?.district, land_unit: profile?.land_unit },
    field: { ...field, area_acre: field.area_sq_m ? Math.round((field.area_sq_m / 4046.86) * 100) / 100 : null },
    soil,
    weather_now: weather?.current ?? null,
    forecast_3_days: (weather?.daily as unknown[] | undefined)?.slice(0, 3) ?? null,
    active_crops: plans ?? [],
  };
}

const today = () => new Date().toISOString().slice(0, 10);
