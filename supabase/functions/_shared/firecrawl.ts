// Firecrawl call helper with automatic retry + circuit-breaker rotation.
// Order: the Lovable-managed gateway connection first, then any extra
// Firecrawl accounts stored in the firecrawl_keys table (highest priority
// first). Transient failures are retried with backoff; a failing account is
// paused for a growing cooldown and skipped until it expires.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  activeKeys,
  isRetryableStatus,
  recordFailure,
  recordSuccess,
  withRetry,
} from "./circuit-breaker.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firecrawl/v2";
const DIRECT_URL = "https://api.firecrawl.dev/v2";

export function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export type FirecrawlResult = {
  ok: boolean;
  status: number;
  body: unknown;
  usedAccount: string;
};

const EXHAUSTED = new Set([401, 402, 403, 429]);

async function callOnce(
  path: string,
  payload: unknown,
  headers: Record<string, string>,
  base: string,
): Promise<{ status: number; body: unknown }> {
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch { /* keep text */ }
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: { error: e instanceof Error ? e.message : String(e) } };
  }
}

/** Calls once, retrying transient failures (network, 429, 5xx) with backoff. */
function callWithRetry(
  path: string,
  payload: unknown,
  headers: Record<string, string>,
  base: string,
) {
  return withRetry(
    () => callOnce(path, payload, headers, base),
    {
      tries: 3,
      shouldRetry: (r) => !(r.status >= 200 && r.status < 300) && isRetryableStatus(r.status),
    },
  );
}

export async function firecrawl(
  path: string,
  payload: unknown,
  supabase: SupabaseClient,
): Promise<FirecrawlResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

  let last: FirecrawlResult | null = null;

  // 1. Built-in connector account
  if (LOVABLE_API_KEY && FIRECRAWL_API_KEY) {
    const { status, body } = await callWithRetry(path, payload, {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": FIRECRAWL_API_KEY,
    }, GATEWAY_URL);
    if (status >= 200 && status < 300) {
      return { ok: true, status, body, usedAccount: "Built-in account" };
    }
    console.error(`Firecrawl built-in account failed [${status}]`);
    last = { ok: false, status, body, usedAccount: "Built-in account" };
    if (!EXHAUSTED.has(status) && status !== 0) return last;
  }

  // 2. Admin-added backup accounts (skipping any in cooldown)
  const { data: keys } = await supabase
    .from("firecrawl_keys")
    .select("id, label, api_key, failure_count, cooldown_until")
    .eq("is_active", true)
    .is("exhausted_at", null)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  for (const key of activeKeys(keys ?? [])) {
    const { status, body } = await callWithRetry(path, payload, {
      Authorization: `Bearer ${key.api_key}`,
    }, DIRECT_URL);

    if (status >= 200 && status < 300) {
      await recordSuccess(supabase, "firecrawl_keys", key.id);
      return { ok: true, status, body, usedAccount: key.label };
    }

    const { cooldownMinutes } = await recordFailure(supabase, "firecrawl_keys", key, {
      status: status || undefined,
      message: status ? `HTTP ${status}` : "Network error",
    });
    console.error(
      `Firecrawl account "${key.label}" failed [${status}], paused ${cooldownMinutes}m`,
    );

    last = { ok: false, status, body, usedAccount: key.label };
    if (!EXHAUSTED.has(status) && status !== 0) return last;
  }

  return last ?? {
    ok: false,
    status: 500,
    body: { error: "No Firecrawl account configured" },
    usedAccount: "none",
  };
}
