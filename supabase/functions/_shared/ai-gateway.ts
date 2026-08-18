import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible";
import { streamText } from "npm:ai";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  activeKeys,
  isRetryableError,
  recordFailure,
  recordSuccess,
  withRetry,
} from "./circuit-breaker.ts";

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
  failure_count?: number | null;
  cooldown_until?: string | null;
};

/**
 * Runs a text generation, rotating through the admin-managed AI keys
 * (ai_keys table, highest priority first). Transient errors are retried with
 * backoff; a key that keeps failing is put in a growing cooldown (circuit
 * breaker) and skipped until it expires. Falls back to the Lovable AI Gateway.
 */
export async function generateNewsText(
  supabase: SupabaseClient,
  opts: { system: string; prompt: string },
): Promise<{ text: string; usedAccount: string; error: string | null }> {
  const { data: keys } = await supabase
    .from("ai_keys")
    .select("id, label, api_key, base_url, model, failure_count, cooldown_until")
    .eq("is_active", true)
    .is("exhausted_at", null)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  let lastError: string | null = null;

  for (const key of activeKeys((keys ?? []) as AiKeyRow[])) {
    const outcome = await withRetry(
      async () => {
        try {
          const provider = createOpenAICompatible({
            name: "admin-ai-key",
            baseURL: key.base_url,
            headers: { Authorization: `Bearer ${key.api_key}` },
          });
          const stream = streamText({ model: provider(key.model), ...opts });
          return { text: (await stream.text).trim(), error: null as string | null, status: 200 };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const status = (err as { statusCode?: number })?.statusCode ?? 0;
          return { text: "", error: message, status };
        }
      },
      {
        tries: 3,
        shouldRetry: (r) => !!r.error && isRetryableError(r.error, r.status || undefined),
      },
    );

    if (!outcome.error) {
      await recordSuccess(supabase, "ai_keys", key.id);
      return { text: outcome.text, usedAccount: key.label, error: null };
    }

    lastError = outcome.error;
    const { cooldownMinutes } = await recordFailure(supabase, "ai_keys", key, {
      status: outcome.status || undefined,
      message: outcome.error,
    });
    console.error(
      `AI key "${key.label}" failed (${outcome.status}), paused ${cooldownMinutes}m:`,
      outcome.error,
    );
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
