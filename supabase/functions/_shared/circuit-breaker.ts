// Shared retry + circuit-breaker helpers for rotating API keys.
//
// - Transient failures (network errors, 5xx, 429) are retried a couple of
//   times with exponential backoff before the key is considered failing.
// - A failing key gets a growing cooldown (1m → 5m → 15m → 1h → 6h) during
//   which the rotation skips it. Hard-exhausted keys (401/402/403) are also
//   marked exhausted so the admin panel flags them.
// - Any success clears the failure count and cooldown.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const HARD_FAIL = new Set([401, 402, 403]);
export const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

/** Cooldown in minutes by consecutive-failure count (1-indexed). */
const COOLDOWN_MINUTES = [1, 5, 15, 60, 360];

export function cooldownFor(failureCount: number): number {
  const i = Math.min(Math.max(failureCount, 1), COOLDOWN_MINUTES.length) - 1;
  return COOLDOWN_MINUTES[i];
}

export function isRetryableStatus(status: number) {
  return status === 0 || RETRYABLE.has(status);
}

export function isRetryableError(msg: string, status?: number) {
  if (status) return isRetryableStatus(status);
  return /timeout|timed out|network|fetch failed|socket|ECONN|temporarily|overload|503|502|500|rate limit|429/i
    .test(msg);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs `attempt` up to `tries` times with exponential backoff while the
 * failure looks transient.
 */
export async function withRetry<T>(
  attempt: (tryIndex: number) => Promise<T>,
  opts: { tries?: number; baseDelayMs?: number; shouldRetry: (result: T) => boolean },
): Promise<T> {
  const tries = opts.tries ?? 3;
  const base = opts.baseDelayMs ?? 500;
  let last!: T;
  for (let i = 0; i < tries; i++) {
    last = await attempt(i);
    if (!opts.shouldRetry(last) || i === tries - 1) return last;
    await sleep(base * 2 ** i + Math.floor(Math.random() * 200));
  }
  return last;
}

/** Filters out keys that are currently in cooldown. */
export function activeKeys<T extends { cooldown_until?: string | null }>(rows: T[]): T[] {
  const now = Date.now();
  return rows.filter((r) => !r.cooldown_until || new Date(r.cooldown_until).getTime() <= now);
}

export async function recordSuccess(
  supabase: SupabaseClient,
  table: "ai_keys" | "firecrawl_keys",
  id: string,
) {
  await supabase
    .from(table)
    .update({
      last_used_at: new Date().toISOString(),
      last_error: null,
      failure_count: 0,
      cooldown_until: null,
      exhausted_at: null,
    })
    .eq("id", id);
}

export async function recordFailure(
  supabase: SupabaseClient,
  table: "ai_keys" | "firecrawl_keys",
  row: { id: string; failure_count?: number | null },
  info: { status?: number; message: string },
): Promise<{ cooldownMinutes: number; cooldownUntil: string }> {
  const failures = (row.failure_count ?? 0) + 1;
  const minutes = cooldownFor(failures);
  const now = new Date();
  const until = new Date(now.getTime() + minutes * 60_000).toISOString();

  await supabase
    .from(table)
    .update({
      failure_count: failures,
      cooldown_until: until,
      last_error: info.message.slice(0, 300),
      last_status: info.status ?? 0,
      ...(info.status && HARD_FAIL.has(info.status)
        ? { exhausted_at: now.toISOString() }
        : {}),
    })
    .eq("id", row.id);

  return { cooldownMinutes: minutes, cooldownUntil: until };
}
