import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible";
import { streamText } from "npm:ai";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable-ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}

export type AiKeyRow = {
  id: string;
  label: string;
  api_key: string;
  base_url: string;
  model: string;
};

function isExhausted(msg: string, status?: number) {
  if (status && [401, 402, 403, 429].includes(status)) return true;
  return /quota|rate limit|credit|exhaust|unauthor|forbidden|invalid api key/i.test(msg);
}

/**
 * Runs a text generation, rotating through the admin-managed AI keys
 * (ai_keys table, highest priority first). A key that hits a quota/auth error
 * is marked exhausted and skipped until an admin resets it. Falls back to the
 * Lovable AI Gateway when no key works.
 */
export async function generateNewsText(
  supabase: SupabaseClient,
  opts: { system: string; prompt: string },
): Promise<{ text: string; usedAccount: string; error: string | null }> {
  const { data: keys } = await supabase
    .from("ai_keys")
    .select("id, label, api_key, base_url, model")
    .eq("is_active", true)
    .is("exhausted_at", null)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  let lastError: string | null = null;

  for (const key of (keys ?? []) as AiKeyRow[]) {
    try {
      const provider = createOpenAICompatible({
        name: "admin-ai-key",
        baseURL: key.base_url,
        headers: { Authorization: `Bearer ${key.api_key}` },
      });
      const stream = streamText({ model: provider(key.model), ...opts });
      const text = (await stream.text).trim();
      await supabase
        .from("ai_keys")
        .update({ last_used_at: new Date().toISOString(), last_error: null })
        .eq("id", key.id);
      return { text, usedAccount: key.label, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as { statusCode?: number })?.statusCode;
      console.error(`AI key "${key.label}" failed:`, msg);
      lastError = msg;
      await supabase
        .from("ai_keys")
        .update({
          last_error: msg.slice(0, 300),
          exhausted_at: isExhausted(msg, status) ? new Date().toISOString() : null,
        })
        .eq("id", key.id);
    }
  }

  // Fallback: Lovable AI Gateway
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (LOVABLE_API_KEY) {
    try {
      const model = createLovableAiGatewayProvider(LOVABLE_API_KEY)("google/gemini-3.6-flash");
      const stream = streamText({ model, ...opts });
      return { text: (await stream.text).trim(), usedAccount: "Lovable AI (credits)", error: null };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error("Lovable AI Gateway failed:", lastError);
    }
  }

  return { text: "", usedAccount: "none", error: lastError ?? "No AI key available" };
}
