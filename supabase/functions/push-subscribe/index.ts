import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod";

const SubSchema = z.object({
  action: z.enum(["subscribe", "unsubscribe"]).default("subscribe"),
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(300), auth: z.string().max(300) }).optional(),
  city: z.string().min(1).max(80).optional(),
  state: z.string().max(80).optional(),
  lang: z.enum(["hi", "en"]).default("hi"),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = SubSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { action, endpoint, keys, city, state, lang } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "unsubscribe") {
      const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
      if (error) throw error;
      return json({ ok: true, subscribed: false });
    }

    if (!keys || !city) return json({ error: "keys and city are required" }, 400);

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        city: city.trim(),
        state: state?.trim() || null,
        lang,
        failure_count: 0,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw error;

    return json({ ok: true, subscribed: true });
  } catch (e) {
    console.error("push-subscribe failed:", e);
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
