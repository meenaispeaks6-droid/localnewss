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
            headers: key.base_url.includes("generativelanguage.googleapis.com")
              ? { "x-goog-api-key": key.api_key }
              : { Authorization: `Bearer ${key.api_key}` },
          });
          const stream = streamText({
            model: provider(key.model),
            ...opts,
            // Bilingual article JSON is substantially larger than a normal
            // chat answer. Provider defaults can stop around 2K tokens and
            // leave an otherwise valid JSON document cut in half.
            maxOutputTokens: 1500,
            maxRetries: 0,
          });
          const text = (await stream.text).trim();
          // An empty reply means this account silently refused the request —
          // treat it as a failure so the next account (or Lovable AI) is used.
          if (text.length < 2) {
            return { text: "", error: "Empty response from provider", status: 502 };
          }
          return { text, error: null as string | null, status: 200 };

        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const status = (err as { statusCode?: number })?.statusCode ?? 0;
          return { text: "", error: message, status };
        }
      },
      {
        tries: 1,
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

  // No Lovable AI fallback on purpose: this app runs AI only on the
  // admin-managed keys (ai_keys), so no Lovable credits are consumed.
  return { text: "", usedAccount: "none", error: lastError ?? "No AI key available" };

}
