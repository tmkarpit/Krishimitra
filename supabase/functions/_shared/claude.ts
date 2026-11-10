// Optional paid provider: Anthropic Claude (set AI_PROVIDER=anthropic and ANTHROPIC_API_KEY).
import Anthropic from "npm:@anthropic-ai/sdk@1.4.0";
import { HttpError } from "./http.ts";
import type { AiMessage, AskOptions } from "./ai.ts";

const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
const MODEL = Deno.env.get("CLAUDE_MODEL") ?? "claude-opus-5-5";

function toAnthropic(m: AiMessage): Anthropic.Beta.BetaMessageParam {
  if (typeof m.content === "string") return { role: m.role, content: m.content };
  return {
    role: m.role,
    content: m.content.map((p): Anthropic.Beta.BetaContentBlockParam =>
      p.type === "text"
        ? { type: "text", text: p.text }
        : { type: "image", source: { type: "base64", media_type: p.mediaType as "image/jpeg", data: p.data } }
    ),
  };
}

export async function askClaude(opts: AskOptions) {
  let message: Anthropic.Beta.BetaMessage;
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      // Re-run declined requests on a fallback model chosen by refusal category.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      messages: opts.messages.map(toAnthropic),
      output_config: {
        effort: opts.effort ?? "medium",
        ...(opts.schema ? { format: { type: "json_schema", schema: opts.schema } } : {}),
      },
    });
    message = await stream.finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(503, "ai_busy", "AI service is busy, try again shortly");
    if (err instanceof Anthropic.APIError) {
      console.error("Claude API error", err.status, err.message);
      throw new HttpError(502, "ai_error", "AI service error");
    }
    throw err;
  }

  if (message.stop_reason === "refusal") {
    throw new HttpError(422, "ai_refused", "The assistant could not answer this request");
  }
  if (message.stop_reason === "max_tokens") {
    throw new HttpError(502, "ai_truncated", "The answer was too long; please try again");
  }

  return {
    text: message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim(),
    usage: { input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens },
  };
}
