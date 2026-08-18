// Shared health-check logic for AI and Firecrawl keys.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const EXHAUSTED = new Set([401, 402, 403, 429]);

export type CheckResult = {
  ok: boolean;
  status: number;
  latencyMs: number;
  details: string;
};

/** Pulls a readable message out of a provider's JSON/text error body. */
function errorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const msg = parsed?.error?.message ?? parsed?.message ?? parsed?.error ?? null;
    if (typeof msg === "string" && msg.trim()) return msg.trim().slice(0, 200);
  } catch {
    /* not JSON */
  }
  return body.replace(/\s+/g, " ").trim().slice(0, 200);
}

async function probe(
  url: string,
  init: RequestInit,
): Promise<CheckResult> {
  const started = Date.now();
  try {
    const res = await fetch(url, init);
    const body = (await res.text()).slice(0, 500);
    return {
      ok: res.ok,
      status: res.status,
      latencyMs: Date.now() - started,
      details: res.ok ? body.slice(0, 300) : errorMessage(body),
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      details: e instanceof Error ? e.message : String(e),
    };
  }
}

function updatePayload(r: CheckResult, now: string) {
  return {
    last_checked_at: now,
    last_status: r.status,
    last_latency_ms: r.latencyMs,
    ...(r.ok
      ? { last_success_at: now, last_error: null, exhausted_at: null }
      : {
        last_error: r.details || `HTTP ${r.status || 0}`,
        ...(EXHAUSTED.has(r.status) ? { exhausted_at: now } : {}),
      }),
  };
}

export async function checkAiKey(
  supabase: SupabaseClient,
  row: { id: string; api_key: string; base_url: string; model: string },
): Promise<CheckResult> {
  const result = await probe(`${row.base_url.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${row.api_key}` },
    body: JSON.stringify({
      model: row.model,
      messages: [{ role: "user", content: "Reply with OK" }],
      max_tokens: 5,
    }),
  });

  await supabase
    .from("ai_keys")
    .update(updatePayload(result, new Date().toISOString()))
    .eq("id", row.id);

  return result;
}

export async function checkFirecrawlKey(
  supabase: SupabaseClient,
  row: { id: string; api_key: string },
): Promise<CheckResult> {
  const result = await probe("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${row.api_key}` },
    body: JSON.stringify({ query: "india news", limit: 1 }),
  });

  await supabase
    .from("firecrawl_keys")
    .update(updatePayload(result, new Date().toISOString()))
    .eq("id", row.id);

  return result;
}

/** Checks every enabled key (including ones previously marked exhausted, so they can recover). */
export async function runHealthChecks(supabase: SupabaseClient) {
  const [{ data: aiKeys }, { data: fcKeys }] = await Promise.all([
    supabase.from("ai_keys").select("id, api_key, base_url, model").eq("is_active", true),
    supabase.from("firecrawl_keys").select("id, api_key").eq("is_active", true),
  ]);

  const ai = await Promise.all(
    (aiKeys ?? []).map(async (k) => ({ id: k.id, ...(await checkAiKey(supabase, k)) })),
  );
  const firecrawl = await Promise.all(
    (fcKeys ?? []).map(async (k) => ({ id: k.id, ...(await checkFirecrawlKey(supabase, k)) })),
  );

  return { ai, firecrawl, checkedAt: new Date().toISOString() };
}
