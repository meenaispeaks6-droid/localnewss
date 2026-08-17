// Serves a Google News style sitemap of the last 48 hours of stories.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const SITE_URL = "https://localnews.meenai.in";

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("news_articles")
    .select("city,slug,title_en,title_hi,published_at")
    .gte("published_at", since)
    .not("slug", "is", null)
    .order("published_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("news-sitemap query failed:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const rows = data ?? [];
  const urls = rows.flatMap((r) => {
    const base = `${SITE_URL}/news/${slugify(r.city)}/${r.slug}`;
    return [
      { loc: base, lang: "en", title: r.title_en, date: r.published_at },
      { loc: `${base}/hi`, lang: "hi", title: r.title_hi || r.title_en, date: r.published_at },
    ];
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    ...urls.map((u) =>
      [
        "  <url>",
        `    <loc>${esc(u.loc)}</loc>`,
        `    <lastmod>${new Date(u.date).toISOString()}</lastmod>`,
        "    <news:news>",
        "      <news:publication>",
        "        <news:name>Local News</news:name>",
        `        <news:language>${u.lang}</news:language>`,
        "      </news:publication>",
        `      <news:publication_date>${new Date(u.date).toISOString()}</news:publication_date>`,
        `      <news:title>${esc(u.title ?? "")}</news:title>`,
        "    </news:news>",
        "  </url>",
      ].join("\n"),
    ),
    "</urlset>",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
