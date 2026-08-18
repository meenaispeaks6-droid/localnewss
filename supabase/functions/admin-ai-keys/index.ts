// Passcode-protected admin API for managing AI provider keys.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";
import { admin } from "../_shared/firecrawl.ts";

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list") }),
  z.object({
    action: z.literal("add"),
    label: z.string().min(1).max(80),
    api_key: z.string().min(10).max(400),
    base_url: z.string().url().max(300).optional(),
    model: z.string().min(1).max(120).optional(),
    priority: z.number().int().min(0).max(999).optional(),
  }),
  z.object({ action: z.literal("toggle"), id: z.string().uuid(), is_active: z.boolean() }),
  z.object({ action: z.literal("reset"), id: z.string().uuid() }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
  z.object({ action: z.literal("test"), id: z.string().uuid() }),
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
  return key.length <= 8 ? "••••" : `${key.slice(0, 6)}••••${key.slice(-4)}`;
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
    if (!timingSafeEqual(given, expected)) return json({ error: "Invalid passcode" }, 401);

    const parsed = ActionSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

    const supabase = admin();
    const input = parsed.data;
    let testResult: { tested: boolean; details?: string } | null = null;

    if (input.action === "add") {
      const { error } = await supabase.from("ai_keys").insert({
        label: input.label.trim(),
        api_key: input.api_key.trim(),
        base_url: input.base_url?.trim() || "https://generativelanguage.googleapis.com/v1beta/openai",
        model: input.model?.trim() || "gemini-3.6-flash",
        priority: input.priority ?? 100,
      });
      if (error) return json({ error: error.message }, 400);
    }

    if (input.action === "toggle") {
      const { error } = await supabase
        .from("ai_keys").update({ is_active: input.is_active }).eq("id", input.id);
      if (error) return json({ error: error.message }, 400);
    }

    if (input.action === "reset") {
      const { error } = await supabase
        .from("ai_keys")
        .update({ exhausted_at: null, last_error: null, is_active: true })
        .eq("id", input.id);
      if (error) return json({ error: error.message }, 400);
    }

    if (input.action === "delete") {
      const { error } = await supabase.from("ai_keys").delete().eq("id", input.id);
      if (error) return json({ error: error.message }, 400);
    }

    if (input.action === "test") {
      const { data: row } = await supabase
        .from("ai_keys").select("id, api_key, base_url, model").eq("id", input.id).maybeSingle();
      if (!row) return json({ error: "Account not found" }, 404);

      const res = await fetch(`${row.base_url.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${row.api_key}` },
        body: JSON.stringify({
          model: row.model,
          messages: [{ role: "user", content: "Reply with OK" }],
          max_tokens: 5,
        }),
      });
      const details = (await res.text()).slice(0, 300);
      testResult = { tested: res.ok, details };
      await supabase
        .from("ai_keys")
        .update({
          last_error: res.ok ? null : `HTTP ${res.status}: ${details.slice(0, 200)}`,
          exhausted_at: res.ok ? null : new Date().toISOString(),
        })
        .eq("id", row.id);
    }

    const { data, error } = await supabase
      .from("ai_keys")
      .select("id, label, api_key, base_url, model, is_active, priority, last_used_at, last_error, exhausted_at, created_at")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return json({ error: error.message }, 400);

    const keys = (data ?? []).map(({ api_key, ...rest }) => ({ ...rest, key_preview: mask(api_key) }));
    const activeId = keys.find((k) => k.is_active && !k.exhausted_at)?.id ?? null;

    return json({ keys, activeId, ...(testResult ?? {}) }, 200);
  } catch (e) {
    console.error("admin-ai-keys error:", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
