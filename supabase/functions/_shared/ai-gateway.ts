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
          // Plain (non-streaming) OpenAI-compatible call. Some community
          // routers accept the request but never emit stream chunks, which
          // looked like an "empty response" even though the key works.
          const res = await fetch(
            `${key.base_url.replace(/\/$/, "")}/chat/completions`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${key.api_key}`,
                // Some routers sit behind a bot firewall that blocks
                // requests without a normal browser/client fingerprint.
                Accept: "application/json",
                "User-Agent":
                  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
              },
              body: JSON.stringify({
                model: key.model,
                messages: [
                  { role: "system", content: opts.system },
                  { role: "user", content: opts.prompt },
                ],
                // Bilingual article JSON is larger than a normal chat answer;
                // provider defaults can cut a valid JSON document in half.
                max_tokens: 2000,
                temperature: 0.2,
              }),
            },
          );
          const raw = await res.text();
          if (!res.ok) {
            return { text: "", error: raw.slice(0, 300) || `HTTP ${res.status}`, status: res.status };
          }
          let text = "";
          try {
            const body = JSON.parse(raw);
            const msg = body?.choices?.[0]?.message;
            text = String(
              msg?.content ?? msg?.reasoning_content ?? body?.choices?.[0]?.text ?? "",
            ).trim();
          } catch {
            // Some routers answer with an SSE stream even for a plain
            // request — stitch the delta chunks back together.
            const chunks: string[] = [];
            for (const line of raw.split("\n")) {
              const t = line.trim();
              if (!t.startsWith("data:")) continue;
              const payload = t.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const piece = JSON.parse(payload)?.choices?.[0];
                const part = piece?.delta?.content ?? piece?.message?.content ?? "";
                if (part) chunks.push(String(part));
              } catch { /* ignore malformed chunk */ }
            }
            text = chunks.join("").trim();
            if (!text) {
              return {
                text: "",
                error: `Provider returned non-JSON body: ${raw.replace(/\s+/g, " ").slice(0, 200)}`,
                status: 502,
              };
            }
          }
          // An empty reply means this account silently refused the request —
          // treat it as a failure so the next account is used.
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
        tries: 2,
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
