import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

interface Sub {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  city: string;
  state: string | null;
  lang: "hi" | "en";
  last_article_at: string | null;
  failure_count: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:news@my-local-news.lovable.app";
    if (!publicKey || !privateKey) return json({ error: "Push is not configured" }, 500);
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: subsData, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, city, state, lang, last_article_at, failure_count")
      .lt("failure_count", 5);
    if (subsError) throw subsError;
    const subs = (subsData ?? []) as Sub[];

    // Refresh live news for subscribed cities first, under a strict time
    // budget. Refreshing a dozen cities inline used to blow the function's
    // wall-clock limit, so the run died before a single notification was
    // ever sent. Extra cities are refreshed in the background instead.
    const cities = new Map<string, string | null>();
    for (const s of subs) cities.set(s.city, s.state);

    const { data: recent } = await supabase
      .from("news_articles")
      .select("city, published_at")
      .order("published_at", { ascending: false })
      .limit(200);
    const extras: Array<[string, string | null]> = [];
    for (const r of (recent ?? []) as { city: string }[]) {
      if (!cities.has(r.city)) extras.push([r.city, null]);
    }

    const GAP_MS = 1500;
    const BUDGET_MS = 45_000;
    const startedAt = Date.now();
    const refresh = async (city: string, state: string | null) => {
      try {
        await supabase.functions.invoke("fetch-city-news", {
          body: { city, state: state ?? undefined },
        });
      } catch (e) {
        console.error(`refresh failed for ${city}:`, e);
      }
    };

    let refreshed = 0;
    for (const [city, state] of cities) {
      if (Date.now() - startedAt > BUDGET_MS) break;
      await refresh(city, state);
      refreshed++;
      await new Promise((r) => setTimeout(r, GAP_MS));
    }

    // Warm a few other popular cities after the response is sent so pushes
    // are never delayed or dropped by a slow refresh.
    const background = extras.slice(0, 6);
    const warm = (async () => {
      for (const [city, state] of background) {
        await refresh(city, state);
        await new Promise((r) => setTimeout(r, GAP_MS));
      }
    })();
    // deno-lint-ignore no-explicit-any
    (globalThis as any).EdgeRuntime?.waitUntil?.(warm);

    if (subs.length === 0) {
      return json({ ok: true, sent: 0, refreshed, note: "no subscribers" });
    }




    let sent = 0;
    let skipped = 0;
    const removed: string[] = [];

    for (const sub of subs) {
      const since = sub.last_article_at ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: articles } = await supabase
        .from("news_articles")
        .select("title_hi, title_en, summary_hi, summary_en, published_at, slug")
        .eq("city", sub.city)
        .gt("published_at", since)
        .order("published_at", { ascending: false })
        .limit(5);

      const rows = (articles ?? []) as {
        title_hi: string | null;
        title_en: string | null;
        summary_hi: string | null;
        summary_en: string | null;
        published_at: string;
        slug: string | null;
      }[];
      if (rows.length === 0) {
        skipped++;
        continue;
      }

      const top = rows[0];
      const hi = sub.lang === "hi";
      const headline = (hi ? top.title_hi || top.title_en : top.title_en || top.title_hi) ?? "";
      const summary = (hi ? top.summary_hi || top.summary_en : top.summary_en || top.summary_hi) ?? "";
      const more = rows.length - 1;
      // Headline is the notification title so the user sees the actual story.
      const title = headline || (hi ? `${sub.city} की ताज़ा ख़बरें` : `${sub.city} local news`);
      const trimmed = summary.length > 140 ? `${summary.slice(0, 137)}…` : summary;
      const extra = more > 0 ? (hi ? ` · ${more} और ख़बरें` : ` · ${more} more stories`) : "";
      const body = `${sub.city}${extra}${trimmed ? ` — ${trimmed}` : ""}`;

      const citySlug = slugify(sub.city);
      const url = top.slug
        ? `/news/${citySlug}/${top.slug}${hi ? "/hi" : ""}`
        : `/news/${citySlug}${hi ? "/hi" : ""}`;

      const payload = JSON.stringify({
        title,
        body,
        url,
        tag: `news-${citySlug}-${top.published_at}`,
      });


      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
        await supabase
          .from("push_subscriptions")
          .update({
            last_sent_at: new Date().toISOString(),
            last_article_at: top.published_at,
            failure_count: 0,
          })
          .eq("id", sub.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        console.error(`push failed for ${sub.id} [${status}]:`, e);
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          removed.push(sub.id);
        } else {
          await supabase
            .from("push_subscriptions")
            .update({ failure_count: sub.failure_count + 1 })
            .eq("id", sub.id);
        }
      }
    }

    return json({
      ok: true,
      refreshed,
      subscribers: subs.length,
      sent,
      skipped,
      removed: removed.length,
    });
  } catch (e) {
    console.error("send-news-digest failed:", e);
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
