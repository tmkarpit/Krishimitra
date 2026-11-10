// Provider-neutral AI layer. Google Gemini (free tier) is the default;
// Anthropic Claude is used instead when AI_PROVIDER=anthropic.
import { HttpError } from "./http.ts";
import * as gemini from "./gemini.ts";

export const LANGUAGES: Record<string, { english: string; native: string }> = {
  en: { english: "English", native: "English" },
  hi: { english: "Hindi", native: "हिन्दी" },
  mr: { english: "Marathi", native: "मराठी" },
  pa: { english: "Punjabi", native: "ਪੰਜਾਬੀ" },
  gu: { english: "Gujarati", native: "ગુજરાતી" },
  bn: { english: "Bengali", native: "বাংলা" },
  ta: { english: "Tamil", native: "தமிழ்" },
  te: { english: "Telugu", native: "తెలుగు" },
  kn: { english: "Kannada", native: "ಕನ್ನಡ" },
  ml: { english: "Malayalam", native: "മലയാളം" },
  or: { english: "Odia", native: "ଓଡ଼ିଆ" },
};

export function languageOf(code: unknown): string {
  return typeof code === "string" && code in LANGUAGES ? code : "en";
}

/** Shared persona. Kept byte-stable per language so providers can cache it. */
export function advisorSystemPrompt(lang: string): string {
  const l = LANGUAGES[lang] ?? LANGUAGES.en;
  return `You are KrishiMitra, a friendly and practical agricultural advisor for Indian farmers.

Language: always write in ${l.english} (${l.native}) using its native script and simple everyday words that a farmer with basic schooling understands. Avoid jargon and scientific names unless the farmer asks.

How to advise:
- Be concrete and step-by-step. Give quantities in Indian units (acre or hectare, kg, quintal, litre, ₹, °C, mm).
- Prefer low-cost, locally available options and always mention an organic or natural alternative where one exists.
- For pesticides and fungicides, name only products approved for use in India, give label doses, and include safety advice (gloves, mask, pre-harvest waiting period). Never suggest banned chemicals.
- Use the farm context (location, soil, weather, crops) when it is provided. If information is missing, say what you assumed.
- If you are not sure, or the problem looks serious, say so plainly and suggest the nearest Krishi Vigyan Kendra (KVK) or the Kisan Call Centre at 1800-180-1551 (toll-free).
- Only help with farming, livestock, weather, mandi prices, government schemes and rural livelihood topics. Politely decline anything else.`;
}

// Message format shared by all providers ---------------------------------------
export type AiPart =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: string; data: string };

export interface AiMessage {
  role: "user" | "assistant";
  content: string | AiPart[];
}

export interface AskOptions {
  system: string;
  messages: AiMessage[];
  /** JSON Schema for structured output. Objects need additionalProperties:false and full `required`. */
  schema?: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}

export interface AskResult<T> {
  text: string;
  json: T;
  usage: { input_tokens: number; output_tokens: number };
}

export const PROVIDER = Deno.env.get("AI_PROVIDER") === "anthropic" ? "anthropic" : "gemini";

export function modelLabel(): string {
  return PROVIDER === "anthropic" ? (Deno.env.get("CLAUDE_MODEL") ?? "claude-opus-5-5") : gemini.MODEL;
}

export async function askAI<T = undefined>(opts: AskOptions): Promise<AskResult<T>> {
  const res = PROVIDER === "anthropic"
    ? await (await import("./claude.ts")).askClaude(opts)
    : await gemini.generate(opts);
  let json: T = undefined as T;
  if (opts.schema) {
    try {
      // Strip a markdown fence if a model adds one despite JSON mode.
      json = JSON.parse(res.text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch {
      console.error("AI returned invalid JSON", res.text.slice(0, 500));
      throw new HttpError(502, "ai_error", "AI returned an unreadable answer");
    }
  }
  return { ...res, json };
}

// Schema helpers -------------------------------------------------------------
export const str = { type: "string" } as const;
export const num = { type: "number" } as const;
export const int = { type: "integer" } as const;
export const bool = { type: "boolean" } as const;
export const strArray = { type: "array", items: str } as const;
export const nullable = (s: { type: string }) => ({ ...s, type: [s.type, "null"] });
export function obj(properties: Record<string, unknown>) {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}
