import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const SITE = "https://localnews.meenai.in";

const slugify = (v: string) =>
  v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default defineTool({
  name: "search_news",
  title: "Search news",
  description:
    "Search published Local News stories across all cities by keyword in the English or Hindi headline, newest first.",
  inputSchema: {
    query: z.string().describe("Keyword or phrase to search for in headlines."),
    limit: z.number().int().optional().describe("Maximum stories to return (default 10, max 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const term = query.trim();
    if (!term) return { content: [{ type: "text", text: "query must not be empty" }], isError: true };

    const supabase = supabaseForUser(ctx);
    const pattern = `%${term.replace(/[%,]/g, " ")}%`;
    const { data, error } = await supabase
      .from("news_articles")
      .select("title_en,title_hi,summary_en,summary_hi,category,city,source_name,source_url,published_at,slug")
      .or(`title_en.ilike.${pattern},title_hi.ilike.${pattern}`)
      .order("published_at", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 10, 1), 50));

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const stories = (data ?? []).map((a) => ({
      title: a.title_en,
      titleHi: a.title_hi,
      summary: a.summary_en,
      summaryHi: a.summary_hi,
      city: a.city,
      category: a.category,
      source: a.source_name,
      sourceUrl: a.source_url,
      publishedAt: a.published_at,
      pageUrl: a.slug ? `${SITE}/news/${slugify(a.city)}/${a.slug}` : `${SITE}/news/${slugify(a.city)}`,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(stories, null, 2) }],
      structuredContent: { query: term, count: stories.length, stories },
    };
  },
});
