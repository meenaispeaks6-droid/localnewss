import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { streamText } from "npm:ai";
import { z } from "npm:zod";
import { createLovableAiGatewayProvider } from "../_shared/ai-gateway.ts";
import { firecrawl } from "../_shared/firecrawl.ts";


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

    // 1. Live web search for this city's news (auto-rotates Firecrawl accounts)
    const search = await firecrawl("/search", {
      query: `${place} India latest local news today समाचार`,
      limit: 10,
      tbs: "qdr:w",
      lang: "hi",
      country: "in",
    }, supabase);

    if (!search.ok) {
      const { data: cached } = await supabase
        .from("news_articles")
        .select("*")
        .eq("city", city)
        .order("published_at", { ascending: false })
        .limit(30);
      console.error(`Firecrawl search failed [${search.status}]`, search.body);
      return json({
        articles: cached ?? [],
        inserted: 0,
        notice: search.status === 402 || search.status === 429
          ? "Firecrawl limit reached — showing saved news. Add another Firecrawl account in the admin panel."
          : "News search unavailable — showing saved news",
      }, 200);
    }

    const searchJson = search.body as any;

    const raw = (searchJson?.data?.web ?? searchJson?.data ?? []) as Array<
      { url?: string; title?: string; description?: string; snippet?: string }
    >;

    const results = raw
      .filter((r) => r?.url && r?.title)
      .slice(0, 10)
      .map((r) => ({
        url: r.url as string,
        title: r.title as string,
        description: r.description ?? r.snippet ?? "",
      }));

    if (results.length === 0) {
      return json({ articles: [], message: "No fresh news found" }, 200);
    }

    // 2. Turn raw results into clean bilingual news items
    const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
    const stream = streamText({
      model: gateway("google/gemini-3.6-flash"),
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

    let rawText = "";
    let aiError: string | null = null;
    try {
      rawText = (await stream.text).trim();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as { statusCode?: number })?.statusCode;
      aiError = status === 403 || /credit limit/i.test(msg)
        ? "AI credits exhausted — showing saved news"
        : "AI summarisation unavailable — showing saved news";
      console.error("AI summarisation failed:", msg);
    }

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

    // 3. Cache in the database


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
        published_at: new Date().toISOString(),
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

    return json({ articles: stored ?? [], inserted, notice: aiError }, 200);
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
