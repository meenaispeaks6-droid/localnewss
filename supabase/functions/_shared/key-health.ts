// Shared health-check logic for AI and Firecrawl keys.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const EXHAUSTED = new Set([401, 402, 403, 429]);

export async function checkAiKey(
  supabase: SupabaseClient,
  row: { id: string; api_key: string; base_url: string; model: string },
): Promise<{ ok: boolean; details: string }> {
  const now = new Date().toISOString();
  let ok = false;
  let details = "";
  let status = 0;
  try {
    const res = await fetch(`${row.base_url.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${row.api_key}` },
      body: JSON.stringify({
        model: row.model,
        messages: [{ role: "user", content: "Reply with OK" }],
        max_tokens: 5,
      }),
    });
    status = res.status;
    ok = res.ok;
    details = (await res.text()).slice(0, 300);
  } catch (e) {
    details = e instanceof Error ? e.message : String(e);
  }

  await supabase
    .from("ai_keys")
    .update({
      last_checked_at: now,
      ...(ok
        ? { last_success_at: now, last_error: null, exhausted_at: null }
        : {
          last_error: `HTTP ${status || 0}: ${details.slice(0, 200)}`,
          ...(EXHAUSTED.has(status) ? { exhausted_at: now } : {}),
        }),
    })
    .eq("id", row.id);

  return { ok, details };
}

export async function checkFirecrawlKey(
  supabase: SupabaseClient,
  row: { id: string; api_key: string },
): Promise<{ ok: boolean; details: string }> {
  const now = new Date().toISOString();
  let ok = false;
  let details = "";
  let status = 0;
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${row.api_key}` },
      body: JSON.stringify({ query: "india news", limit: 1 }),
    });
    status = res.status;
    ok = res.ok;
    details = (await res.text()).slice(0, 300);
  } catch (e) {
    details = e instanceof Error ? e.message : String(e);
  }

  await supabase
    .from("firecrawl_keys")
    .update({
      last_checked_at: now,
      ...(ok
        ? { last_success_at: now, last_error: null, exhausted_at: null }
        : {
          last_error: `HTTP ${status || 0}`,
          ...(EXHAUSTED.has(status) ? { exhausted_at: now } : {}),
        }),
    })
    .eq("id", row.id);

  return { ok, details };
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
