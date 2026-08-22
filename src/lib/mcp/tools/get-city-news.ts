import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const SITE = "https://localnews.meenai.in";

const slugify = (v: string) =>
  v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default defineTool({
  name: "get_city_news",
  title: "Get city news",
  description:
    "Get the latest published news stories for an Indian city covered by Local News, newest first. Returns bilingual headlines and summaries plus links.",
  inputSchema: {
    city: z.string().describe("City name, e.g. 'Alwar' or 'Jaipur'."),
    category: z.string().optional().describe("Optional category filter, e.g. Politics, Crime, Sports."),
    limit: z.number().int().optional().describe("Maximum stories to return (default 10, max 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ city, category, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("news_articles")
      .select("title_en,title_hi,summary_en,summary_hi,category,source_name,source_url,published_at,slug,city")
      .ilike("city", city.trim())
      .order("published_at", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 10, 1), 50));
    if (category?.trim()) q = q.eq("category", category.trim());

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const stories = (data ?? []).map((a) => ({
      title: a.title_en,
      titleHi: a.title_hi,
      summary: a.summary_en,
      summaryHi: a.summary_hi,
      category: a.category,
      source: a.source_name,
      sourceUrl: a.source_url,
      publishedAt: a.published_at,
      pageUrl: a.slug ? `${SITE}/news/${slugify(a.city)}/${a.slug}` : `${SITE}/news/${slugify(a.city)}`,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(stories, null, 2) }],
      structuredContent: { city, count: stories.length, stories },
    };
  },
});
