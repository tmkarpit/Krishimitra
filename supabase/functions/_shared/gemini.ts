// Google Gemini via the generateContent REST API (free tier: https://aistudio.google.com/apikey).
import { HttpError } from "./http.ts";
import type { AiMessage, AskOptions } from "./ai.ts";

const API = "https://generativelanguage.googleapis.com/v1beta/models";
export const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash";
// Tried in order when the main model is rate-limited or overloaded (free-tier models
// regularly return 503 "high demand"). Comma-separated.
const FALLBACK_MODELS = (Deno.env.get("GEMINI_FALLBACK_MODEL") ?? "gemini-3.5-flash-lite,gemini-3.1-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter((m) => m && m !== MODEL);

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

interface GenerateResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

const BLOCKED = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "IMAGE_SAFETY", "RECITATION"]);

function toParts(content: AiMessage["content"]): Part[] {
  if (typeof content === "string") return [{ text: content }];
  return content.map((p) => (p.type === "text" ? { text: p.text } : { inlineData: { mimeType: p.mediaType, data: p.data } }));
}

async function call(model: string, body: unknown): Promise<Response> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new HttpError(501, "ai_not_configured", "GEMINI_API_KEY is not set");
  try {
    return await fetch(`${API}/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Edge Functions are cut off at ~150 s, so a slow model must leave time for the fallbacks.
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") return new Response(null, { status: 504 });
    throw err;
  }
}

const ATTEMPT_TIMEOUT_MS = 45000;

interface Body {
  generationConfig?: { thinkingConfig?: unknown; [key: string]: unknown };
  [key: string]: unknown;
}

/** Sends the request, moving down the fallback chain while models are rate-limited, overloaded or slow. */
async function request(body: Body): Promise<GenerateResponse> {
  let res: Response | undefined;
  for (const model of [MODEL, ...FALLBACK_MODELS]) {
    if (res) console.warn(`Gemini returned ${res.status}; retrying on ${model}`);
    res = await call(model, body);
    if (res.status === 400 && body.generationConfig?.thinkingConfig) {
      // Not every model accepts a thinking level; retry once without it.
      const { thinkingConfig: _, ...generationConfig } = body.generationConfig;
      res = await call(model, { ...body, generationConfig });
    }
    if (res.status !== 429 && res.status < 500) break;
  }
  res = res!;
  if (res.status === 429 || res.status >= 500) throw new HttpError(503, "ai_busy", "AI is busy, try again shortly");
  if (!res.ok) {
    console.error("Gemini error", res.status, (await res.text()).slice(0, 1000));
    throw new HttpError(502, "ai_error", "AI service error");
  }
  return (await res.json()) as GenerateResponse;
}

function textOf(res: GenerateResponse) {
  if (res.promptFeedback?.blockReason) {
    throw new HttpError(422, "ai_refused", "The assistant could not answer this request");
  }
  const candidate = res.candidates?.[0];
  const reason = candidate?.finishReason ?? "";
  if (BLOCKED.has(reason)) throw new HttpError(422, "ai_refused", "The assistant could not answer this request");
  if (reason === "MAX_TOKENS") throw new HttpError(502, "ai_truncated", "The answer was too long; please try again");
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();
  if (!text) throw new HttpError(502, "ai_error", "AI returned an empty answer");
  return text;
}

export async function generate(opts: AskOptions) {
  const res = await request({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: opts.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: toParts(m.content) })),
    generationConfig: {
      // Thinking tokens count toward this limit, so leave generous room.
      maxOutputTokens: Math.max(opts.maxTokens ?? 16000, 8192),
      // Low thinking keeps answers fast enough for the Edge Function time limit.
      thinkingConfig: { thinkingLevel: opts.effort === "high" ? "high" : "low" },
      ...(opts.schema ? { responseMimeType: "application/json", responseJsonSchema: opts.schema } : {}),
    },
  });
  return {
    text: textOf(res),
    usage: {
      input_tokens: res.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: res.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}

/** Speech-to-text for a short farmer voice note. */
export async function transcribe(audioBase64: string, mimeType: string, languageName: string): Promise<string> {
  const res = await request({
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType, data: audioBase64 } },
        {
          text: `Transcribe this voice message from an Indian farmer. The expected language is ${languageName}; ` +
            `write the transcript in that language's native script (keep English words as spoken). ` +
            `Output only the transcript text, nothing else. If there is no speech, output nothing.`,
        },
      ],
    }],
    generationConfig: { maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: "low" } },
  });
  const parts = res.candidates?.[0]?.content?.parts ?? [];
  return parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("").trim();
}
