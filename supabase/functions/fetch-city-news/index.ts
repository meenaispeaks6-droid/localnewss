import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod";
import { generateNewsText } from "../_shared/ai-gateway.ts";
import { firecrawl } from "../_shared/firecrawl.ts";
import { googleNewsSearch } from "../_shared/google-news.ts";


const BodySchema = z.object({
  city: z.string().min(1).max(80),
  state: z.string().min(1).max(80).optional(),
});

const ArticlesSchema = z.object({
  articles: z.array(
    z.object({
      title_en: z.string(),
      title_hi: z.string().nullish(),
      summary_en: z.string().nullish(),
      summary_hi: z.string().nullish(),
      category: z.string().nullish(),
      source_url: z.string(),
      source_name: z.string().nullish(),
    }),
  ),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const city = parsed.data.city.trim();
    const state = parsed.data.state?.trim() ?? "";
    const place = state ? `${city}, ${state}` : city;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Live news. Google News RSS first (free, unlimited), then Firecrawl
    // as a fallback for places RSS doesn't cover.
    let results: Array<
      { url: string; title: string; description: string; sourceName?: string; publishedAt?: string }
    > = await googleNewsSearch(place, 48);
    let notice: string | null = null;

    if (results.length < 3) {
      const runSearch = (tbs: string) =>
        firecrawl("/search", {
          query: `${place} India latest local news today समाचार`,
          limit: 10,
          tbs,
          lang: "hi",
          country: "in",
        }, supabase);

      let search = await runSearch("qdr:d");
      if (search.ok) {
        const d = (search.body as any)?.data;
        const hits = (d?.web ?? d ?? []) as unknown[];
        if (!Array.isArray(hits) || hits.length === 0) {
          search = await runSearch("qdr:w");
        }
      }

      if (search.ok) {
        const searchJson = search.body as any;
        const raw = (searchJson?.data?.web ?? searchJson?.data ?? []) as Array<
          { url?: string; title?: string; description?: string; snippet?: string }
        >;
        const extra = raw
          .filter((r) => r?.url && r?.title)
          .slice(0, 10)
          .map((r) => ({
            url: r.url as string,
            title: r.title as string,
            description: r.description ?? r.snippet ?? "",
          }));
        const seen = new Set(results.map((r) => r.url));
        for (const e of extra) if (!seen.has(e.url)) results.push(e);
      } else {
        console.error(`Firecrawl search failed [${search.status}]`, search.body);
      }
    }

    if (results.length === 0) {
      const { data: cached } = await supabase
        .from("news_articles")
        .select("*")
        .eq("city", city)
        .order("published_at", { ascending: false })
        .limit(30);
      return json({
        articles: cached ?? [],
        inserted: 0,
        notice: "No fresh news found right now — showing saved news",
      }, 200);
    }


    // 2. Turn raw results into clean bilingual news items (rotates AI keys)
    const ai = await generateNewsText(supabase, {
      system:
        "You are a bilingual (Hindi + English) local news editor for India. " +
        "From the given search results, keep only genuine news items about the requested city. " +
        'Reply with ONLY raw JSON of the shape {"articles":[{"title_en":"","title_hi":"","summary_en":"","summary_hi":"","category":"","source_url":"","source_name":""}]} ' +
        "with no markdown fences and no commentary. Summaries are 2-3 sentences; Hindi must be Devanagari. " +
        "category is one of Politics, Crime, Business, Sports, Education, Weather, Culture, Community, Health. " +
        "source_url must be copied exactly from the input. Never invent facts beyond the given text.",
      prompt: `City: ${place}\n\nSearch results:\n${
        results
          .map((r, i) => `${i + 1}. TITLE: ${r.title}\nURL: ${r.url}\nTEXT: ${r.description}`)
          .join("\n\n")
      }`,
    });

    const rawText = ai.text;
    const aiError = ai.error ? "AI summarisation unavailable — showing live search results" : null;


    const jsonText = rawText
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    let articles: z.infer<typeof ArticlesSchema>["articles"] = [];
    if (start !== -1 && end > start) {
      const parsedOut = ArticlesSchema.safeParse(
        JSON.parse(jsonText.slice(start, end + 1)),
      );
      if (parsedOut.success) {
        articles = parsedOut.data.articles;
      } else {
        console.error("AI output did not match schema:", parsedOut.error.message, rawText.slice(0, 500));
      }
    } else if (!aiError) {
      console.error("AI output was not JSON:", rawText.slice(0, 500));
    }


    articles = articles.filter((a) => a.source_url?.startsWith("http"));

    // Fallback: if the AI step failed or returned nothing, still publish the
    // live search results as-is so readers get fresh news without AI credits.
    if (articles.length === 0 && results.length > 0) {
      const SOCIAL = /(youtube\.com|youtu\.be|instagram\.com|facebook\.com|x\.com|twitter\.com|tiktok\.com)/i;
      articles = results
        .filter((r) => !SOCIAL.test(r.url))
        .map((r) => ({
          title_en: r.title.slice(0, 200),
          title_hi: null,
          summary_en: r.description ? r.description.slice(0, 500) : null,
          summary_hi: null,
          category: "general",
          source_url: r.url,
          source_name: r.sourceName ?? null,
        }));
    }



    // 3. Cache in the database


    const pubMap = new Map(
      results.filter((r) => r.publishedAt).map((r) => [r.url, r.publishedAt!]),
    );
    let inserted = 0;
    if (articles.length > 0) {
      const rows = articles.map((a) => ({
        city,
        title_en: a.title_en,
        title_hi: a.title_hi,
        summary_en: a.summary_en,
        summary_hi: a.summary_hi,
        category: a.category || "general",
        source_url: a.source_url,
        source_name: a.source_name || new URL(a.source_url).hostname.replace("www.", ""),
        published_at: pubMap.get(a.source_url) ?? new Date().toISOString(),
      }));

      // Only genuinely new URLs are stored; existing ones keep their original
      // published_at so "new since" checks stay accurate.
      const { data: insertedRows, error } = await supabase
        .from("news_articles")
        .upsert(rows, { onConflict: "source_url", ignoreDuplicates: true })
        .select("id");
      if (error) console.error("Cache write failed:", error.message);
      inserted = insertedRows?.length ?? 0;
    }

    const { data: stored } = await supabase
      .from("news_articles")
      .select("*")
      .eq("city", city)
      .order("published_at", { ascending: false })
      .limit(30);

    return json({ articles: stored ?? [], inserted, notice: notice ?? aiError }, 200);
  } catch (e) {
    console.error("fetch-city-news error:", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
