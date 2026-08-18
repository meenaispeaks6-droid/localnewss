// Periodic health check for all API keys. Called by cron and from the admin panel.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { admin } from "../_shared/firecrawl.ts";
import { runHealthChecks } from "../_shared/key-health.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type, x-admin-passcode",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    const result = await runHealthChecks(admin());
    console.log("key health check", JSON.stringify(result));
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("key-health error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
