// Speech-to-text and text-to-speech for Indian languages.
// STT: Sarvam AI when SARVAM_API_KEY is set, otherwise Gemini (free tier).
// TTS: Sarvam only. The app uses the phone's own voice first and calls `tts` only when
// the phone has no voice for the language; without Sarvam it falls back to the phone anyway.
import { HttpError, requireString, serve } from "../_shared/http.ts";
import { enforceLimit, requireUser } from "../_shared/supabase.ts";
import { LANGUAGES, languageOf, PROVIDER } from "../_shared/ai.ts";
import { transcribe } from "../_shared/gemini.ts";

const SARVAM_URL = "https://api.sarvam.ai";
const STT_MODEL = Deno.env.get("SARVAM_STT_MODEL") ?? "saarika:v2.5";
const TTS_MODEL = Deno.env.get("SARVAM_TTS_MODEL") ?? "bulbul:v2";
const TTS_SPEAKER = Deno.env.get("SARVAM_TTS_SPEAKER") ?? "anushka";
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

// Sarvam uses BCP-47 codes; Odia is "od-IN".
const SARVAM_LANG: Record<string, string> = {
  en: "en-IN", hi: "hi-IN", mr: "mr-IN", pa: "pa-IN", gu: "gu-IN", bn: "bn-IN",
  ta: "ta-IN", te: "te-IN", kn: "kn-IN", ml: "ml-IN", or: "od-IN",
};

interface Body {
  mode?: "stt" | "tts";
  language?: string;
  audio_base64?: string;
  mime_type?: string;
  text?: string;
}

serve<Body>(async (req, body) => {
  const user = await requireUser(req);
  const sarvamKey = Deno.env.get("SARVAM_API_KEY");
  const lang = languageOf(body.language);

  if (body.mode === "stt") {
    await enforceLimit(user.id, "stt", 200);
    const audioBase64 = requireString(body.audio_base64, "audio_base64");
    if (audioBase64.length * 0.75 > MAX_AUDIO_BYTES) throw new HttpError(413, "too_large", "Recording is too long");
    const mime = body.mime_type ?? "audio/m4a";

    if (!sarvamKey) {
      if (PROVIDER !== "gemini" || !Deno.env.get("GEMINI_API_KEY")) {
        throw new HttpError(501, "speech_not_configured", "Voice service is not configured");
      }
      return { transcript: await transcribe(audioBase64, mime, LANGUAGES[lang].english) };
    }

    const audio = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
    const ext = mime.includes("wav") ? "wav" : mime.includes("aac") ? "aac" : "m4a";
    const form = new FormData();
    form.append("file", new Blob([audio], { type: mime }), `speech.${ext}`);
    form.append("model", STT_MODEL);
    form.append("language_code", SARVAM_LANG[lang]);
    const res = await fetch(`${SARVAM_URL}/speech-to-text`, {
      method: "POST",
      headers: { "api-subscription-key": sarvamKey },
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error("Sarvam STT", res.status, await res.text());
      throw new HttpError(502, "stt_failed", "Could not understand the recording");
    }
    const out = (await res.json()) as { transcript?: string };
    return { transcript: (out.transcript ?? "").trim() };
  }

  if (body.mode === "tts") {
    if (!sarvamKey) throw new HttpError(501, "speech_not_configured", "Voice service is not configured");
    await enforceLimit(user.id, "tts", 200);
    // Strip markdown symbols so they are not read aloud; Sarvam caps input length.
    const text = requireString(body.text, "text").replace(/[*#_`>|]/g, " ").replace(/\s+/g, " ").slice(0, 1500);
    const res = await fetch(`${SARVAM_URL}/text-to-speech`, {
      method: "POST",
      headers: { "api-subscription-key": sarvamKey, "Content-Type": "application/json" },
      body: JSON.stringify({ text, target_language_code: SARVAM_LANG[lang], model: TTS_MODEL, speaker: TTS_SPEAKER }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error("Sarvam TTS", res.status, await res.text());
      throw new HttpError(502, "tts_failed", "Could not generate speech");
    }
    const out = (await res.json()) as { audios?: string[] };
    if (!out.audios?.length) throw new HttpError(502, "tts_failed", "Could not generate speech");
    return { audio_base64: out.audios[0], mime_type: "audio/wav" };
  }

  throw new HttpError(400, "invalid_input", "mode must be stt or tts");
});
