// Passcode-protected admin API for managing Firecrawl accounts.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";
import { admin } from "../_shared/firecrawl.ts";
import { checkFirecrawlKey, runHealthChecks } from "../_shared/key-health.ts";

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list") }),
  z.object({
    action: z.literal("add"),
    label: z.string().min(1).max(80),
    api_key: z.string().min(10).max(200),
    priority: z.number().int().min(0).max(999).optional(),
  }),
  z.object({ action: z.literal("toggle"), id: z.string().uuid(), is_active: z.boolean() }),
  z.object({ action: z.literal("reset"), id: z.string().uuid() }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
  z.object({ action: z.literal("test"), id: z.string().uuid() }),
  z.object({ action: z.literal("check_all") }),
]);

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function mask(key: string) {
  return key.length <= 8 ? "••••" : `${key.slice(0, 5)}••••${key.slice(-4)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type, x-admin-passcode, x-retry-count, traceparent, tracestate, baggage",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    const expected = Deno.env.get("ADMIN_PASSCODE");
    if (!expected) return json({ error: "Admin passcode is not configured" }, 500);

    const given = req.headers.get("x-admin-passcode") ?? "";
    if (!timingSafeEqual(given, expected)) {
      return json({ error: "Invalid passcode" }, 401);
    }

    const parsed = ActionSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

    const supabase = admin();
    const input = parsed.data;

    if (input.action === "add") {
      const { error } = await supabase.from("firecrawl_keys").insert({
        label: input.label.trim(),
        api_key: input.api_key.trim(),
        priority: input.priority ?? 100,
      });
      if (error) return json({ error: error.message }, 400);
    }

    if (input.action === "toggle") {
      const { error } = await supabase
        .from("firecrawl_keys")
        .update({ is_active: input.is_active })
        .eq("id", input.id);
      if (error) return json({ error: error.message }, 400);
    }

    if (input.action === "reset") {
      const { error } = await supabase
        .from("firecrawl_keys")
        .update({ exhausted_at: null, last_error: null, is_active: true })
        .eq("id", input.id);
      if (error) return json({ error: error.message }, 400);
    }

    if (input.action === "delete") {
      const { error } = await supabase.from("firecrawl_keys").delete().eq("id", input.id);
      if (error) return json({ error: error.message }, 400);
    }

    if (input.action === "test") {
      const { data: row } = await supabase
        .from("firecrawl_keys")
        .select("id, api_key")
        .eq("id", input.id)
        .maybeSingle();
      if (!row) return json({ error: "Account not found" }, 404);
      const { ok, details } = await checkFirecrawlKey(supabase, row);
      if (!ok) return json({ tested: false, details }, 200);
    }

    if (input.action === "check_all") {
      await runHealthChecks(supabase);
    }

    const { data, error } = await supabase
      .from("firecrawl_keys")
      .select("id, label, api_key, is_active, priority, last_used_at, last_error, exhausted_at, last_checked_at, last_success_at, created_at")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return json({ error: error.message }, 400);

    return json({
      accounts: (data ?? []).map(({ api_key, ...rest }) => ({ ...rest, key_preview: mask(api_key) })),
    }, 200);
  } catch (e) {
    console.error("admin-firecrawl error:", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
