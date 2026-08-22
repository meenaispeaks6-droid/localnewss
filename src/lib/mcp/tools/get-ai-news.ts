import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const SITE = "https://localnews.meenai.in";

export default defineTool({
  name: "get_ai_news",
  title: "Get AI & Tools news",
  description:
    "Get the latest worldwide AI and technology stories from the Local News 'AI & Tools' feed (new models, benchmarks, tools, robotics, research), newest first.",
  inputSchema: {
    limit: z.number().int().optional().describe("Maximum stories to return (default 10, max 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("news_articles")
      .select("title_en,summary_en,source_name,source_url,published_at")
      .eq("city", "AI & Tools")
      .order("published_at", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 10, 1), 50));

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const stories = (data ?? []).map((a) => ({
      title: a.title_en,
      summary: a.summary_en,
      source: a.source_name,
      sourceUrl: a.source_url,
      publishedAt: a.published_at,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(stories, null, 2) }],
      structuredContent: { feedUrl: `${SITE}/ai-news`, count: stories.length, stories },
    };
  },
});
