import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable-ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}

/**
 * Returns the chat model used for news summarisation.
 * If GEMINI_API_KEY is set, calls Google AI Studio directly (free tier, no
 * Lovable credits). Otherwise falls back to the Lovable AI Gateway.
 */
export function createNewsModel() {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (GEMINI_API_KEY) {
    const google = createOpenAICompatible({
      name: "google-ai-studio",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      headers: { Authorization: `Bearer ${GEMINI_API_KEY}` },
    });
    return { model: google("gemini-2.0-flash"), usingOwnKey: true };
  }
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
  return {
    model: createLovableAiGatewayProvider(LOVABLE_API_KEY)("google/gemini-3.6-flash"),
    usingOwnKey: false,
  };
}
