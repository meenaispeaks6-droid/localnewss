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

    // 2. Turn raw results into clean bilingual news items (rotates AI keys).
    let articles: z.infer<typeof ArticlesSchema>["articles"] = [];
    let aiError: string | null = null;

    {
      const ai = await generateNewsText(supabase, {
        system:
          "You are a bilingual (Hindi + English) local news editor for India. " +
          "From the given search results, keep only genuine news items about the requested city; drop duplicates and anything that is not news. " +
          'Reply with ONLY raw JSON of the shape {"articles":[{"title_en":"","title_hi":"","summary_en":"","summary_hi":"","category":"","source_url":"","source_name":""}]} ' +
          "with no markdown fences and no commentary.\n" +
          "Writing rules:\n" +
          "- title_en: clear English headline, max 12 words. title_hi: the same headline in natural Devanagari Hindi, max 12 words.\n" +
          "- Never keep the publisher name inside a headline (remove trailing ' - Zee News', ' | Dainik Bhaskar' etc.); put it in source_name.\n" +
          "- summary_en and summary_hi: exactly 1-2 short sentences (max 300 characters) that answer what happened, where and why it matters. No long paragraphs, no repetition of the headline word for word.\n" +
          "- Both languages are mandatory for every article; translate rather than leaving a field empty.\n" +
          "- Simple everyday words; no clickbait, no opinion, no invented facts beyond the given text.\n" +
          "- category is one of Politics, Crime, Business, Sports, Education, Weather, Culture, Community, Health.\n" +
          "- source_url must be copied exactly from the input.",
        prompt: `City: ${place}\n\nSearch results:\n${
          results
            .map((r, i) =>
              `${i + 1}. TITLE: ${r.title}\nSOURCE: ${r.sourceName ?? ""}\nURL: ${r.url}\nTEXT: ${r.description}`
            )
            .join("\n\n")
        }`,
      });

      const rawText = ai.text;
      aiError = ai.error ? "AI summarisation unavailable — showing live search results" : null;

      const jsonText = rawText
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();
      const start = jsonText.indexOf("{");
      const end = jsonText.lastIndexOf("}");
      if (start !== -1 && end > start) {
        try {
          const parsedOut = ArticlesSchema.safeParse(
            JSON.parse(jsonText.slice(start, end + 1)),
          );
          if (parsedOut.success) {
            articles = parsedOut.data.articles;
          } else {
            console.error("AI output did not match schema:", parsedOut.error.message, rawText.slice(0, 500));
          }
        } catch (err) {
          console.error("AI output was not parseable JSON:", (err as Error).message, rawText.slice(0, 300));
        }
      } else if (!aiError) {
        console.error("AI output was not JSON:", rawText.slice(0, 500));
      }
    }

    articles = articles.filter((a) => a.source_url?.startsWith("http"));

    // Keep summaries short and headlines free of the publisher suffix even
    // when the model gets chatty.
    const clean = (s: string | null | undefined, max: number) => {
      if (!s) return null;
      const trimmed = s.replace(/\s+/g, " ").trim();
      if (!trimmed) return null;
      return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
    };
    const stripSource = (title: string) =>
      title.replace(/\s+[-–—|]\s+[^-–—|]{2,40}$/u, "").trim() || title.trim();

    articles = articles.map((a) => ({
      ...a,
      title_en: clean(stripSource(a.title_en), 120) ?? a.title_en,
      title_hi: clean(a.title_hi ? stripSource(a.title_hi) : null, 120),
      summary_en: clean(a.summary_en, 300),
      summary_hi: clean(a.summary_hi, 300),
    }));

    // Fallback: if the AI step failed or returned nothing, still publish the
    // live search results as-is so readers get fresh news without AI credits.
    if (articles.length === 0 && results.length > 0) {
      const SOCIAL = /(youtube\.com|youtu\.be|instagram\.com|facebook\.com|x\.com|twitter\.com|tiktok\.com)/i;
      articles = results
        .filter((r) => !SOCIAL.test(r.url))
        .map((r) => ({
          title_en: clean(stripSource(r.title), 120) ?? r.title.slice(0, 120),
          title_hi: null,
          summary_en: clean(r.description?.replace(/<[^>]+>/g, " "), 300),
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
