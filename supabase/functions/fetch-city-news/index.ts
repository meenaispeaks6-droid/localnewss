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
      id: z.coerce.number(),
      title_en: z.string(),
      title_hi: z.string().nullish(),
      summary_en: z.string().nullish(),
      summary_hi: z.string().nullish(),
      category: z.string().nullish(),
      source_name: z.string().nullish(),
    }),
  ),
});

type OutArticle = {
  title_en: string;
  title_hi?: string | null;
  summary_en?: string | null;
  summary_hi?: string | null;
  category?: string | null;
  source_url: string;
  source_name?: string | null;
};

// Detects Hindi/Devanagari text so a Hindi RSS headline is never presented
// as the English version of a story.
const DEVANAGARI = /[\u0900-\u097F]/;


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

    // Drop non-story links (section fronts, e-papers, homepages, tag pages)
    // that Firecrawl search often returns — they look like "no new news"
    // because they never change.
    results = results.filter((r) => isRealStory(r.url, r.title, `${r.title} ${r.description ?? ""}`, city));

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

    // Keep each editorial request small enough for providers to finish the
    // complete bilingual JSON response instead of truncating it mid-article.
    // Enrich the freshest story per refresh. This stays below the
    // working account's token-per-minute limit; repeated minute refreshes
    // progressively enrich the feed without blocking live RSS updates.
    // Spend the AI budget on stories that have no Hindi version yet, so every
    // refresh adds new bilingual articles instead of redoing the same ones.
    const { data: alreadyBilingual } = await supabase
      .from("news_articles")
      .select("source_url, title_en, title_hi")
      .in("source_url", results.slice(0, 40).map((r) => r.url));
    // A story only counts as done when it has Hindi text AND its English
    // headline is really English (raw Hindi RSS titles are stored in both
    // columns until the AI produces a translation).
    const doneUrls = new Set(
      (alreadyBilingual ?? [])
        .filter((r) => r.title_hi && !DEVANAGARI.test(r.title_en ?? ""))
        .map((r) => r.source_url),
    );
    const pending = results.filter((r) => !doneUrls.has(r.url));
    const editorialResults = (pending.length > 0 ? pending : results).slice(0, 6);



    // 2. Turn raw results into clean bilingual news items (rotates AI keys).
    let articles: OutArticle[] = [];
    let aiError: string | null = null;

    const systemPrompt =
      "You are a bilingual (Hindi + English) local news editor for India. " +
      "From the given search results, keep only genuine news items about the requested city; drop duplicates and anything that is not news. " +
      'Reply with ONLY raw JSON of the shape {"articles":[{"id":1,"title_en":"","title_hi":"","summary_en":"","summary_hi":"","category":"","source_name":""}]} ' +
      "with no markdown fences, no reasoning, no explanation before or after the JSON. The first character of your reply must be '{'.\n" +
      "Writing rules:\n" +
      "- Return one article for every valid input result, and copy its id number exactly.\n" +
      "- title_en: clear English headline, max 12 words. title_hi: the same headline in natural Devanagari Hindi, max 12 words.\n" +
      "- Never keep the publisher name inside a headline; put it in source_name.\n" +
      "- summary_en and summary_hi: 1-2 short sentences (max 300 characters) explaining what happened, where and why it matters.\n" +
      "- Both languages are mandatory for every article. Use simple words and never invent facts.\n" +
      "- category is one of Politics, Crime, Business, Sports, Education, Weather, Culture, Community, Health.";

    // Small batches prevent providers with short output limits from cutting
    // the JSON document in half. A failed batch does not discard successful
    // bilingual articles from the other batches.
    for (let offset = 0; offset < editorialResults.length; offset += 3) {
      const batch = editorialResults.slice(offset, offset + 3);
      // Source URLs stay out of the prompt: Google News links are very long
      // base64 blobs that some providers' firewalls reject, and the model
      // only needs an id it can echo back.
      const ai = await generateNewsText(supabase, {
        system: systemPrompt,
        prompt: `City: ${place}\n\nSearch results:\n${batch
          .map((r, i) =>
            `id ${i + 1}\nTITLE: ${r.title}\nSOURCE: ${r.sourceName ?? ""}\nTEXT: ${r.description.replace(/<[^>]+>/g, " ").slice(0, 240)}`
          )
          .join("\n\n")}`,
      });

      if (ai.error) {
        aiError = "AI summarisation partially unavailable — showing live search results";
        continue;
      }

      const candidate = extractArticlesJson(ai.text);
      if (!candidate) {
        console.error("AI output was not JSON:", ai.text.slice(0, 500));
        continue;
      }
      try {
        const parsedOut = ArticlesSchema.safeParse(JSON.parse(candidate));
        if (parsedOut.success) {
          const list = parsedOut.data.articles;
          console.log(`AI returned ${list.length} article(s) via ${ai.usedAccount}`);
          list.forEach((a, idx) => {
            // Models sometimes renumber or drop the id — fall back to the
            // response position so a good bilingual article is never lost.
            const src = batch[Number(a.id) - 1] ?? batch[idx];
            if (!src) return;
            articles.push({
              ...a,
              source_url: src.url,
              source_name: a.source_name || src.sourceName || null,
            });
          });
        } else {
          console.error("AI output did not match schema:", parsedOut.error.message, ai.text.slice(0, 500));
        }
      } catch (err) {
        console.error("AI output was not parseable JSON:", (err as Error).message, ai.text.slice(0, 300));
      }


    }

    articles = articles.filter(
      (a) => a.source_url?.startsWith("http") && (a.title_en ?? "").trim().length > 3,
    );



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

    // Every live result is still published as-is (fresh headlines without any
    // AI cost); the AI-enriched bilingual versions take precedence by URL.
    if (results.length > 0) {
      const SOCIAL = /(youtube\.com|youtu\.be|instagram\.com|facebook\.com|x\.com|twitter\.com|tiktok\.com)/i;
      const enriched = new Set(articles.map((a) => a.source_url));
      const raw = results
        .filter(
          (r) =>
            !SOCIAL.test(r.url) &&
            (r.title ?? "").trim().length > 3 &&
            !enriched.has(r.url),
        )
        .map((r) => {
          const title = clean(stripSource(r.title), 120) ?? r.title.slice(0, 120);
          const summary = clean(r.description?.replace(/<[^>]+>/g, " "), 300);
          // A Hindi RSS headline is Hindi content: mirror it into the Hindi
          // columns so the English page can tell it still needs translating.
          const isHindi = DEVANAGARI.test(title);
          return {
            title_en: title,
            title_hi: isHindi ? title : null,
            summary_en: summary,
            summary_hi: isHindi ? summary : null,
            category: "general",
            source_url: r.url,
            source_name: r.sourceName ?? null,
          };
        });

      articles = [...articles, ...raw];
    }






    // 3. Cache in the database


    const pubMap = new Map(
      results.filter((r) => r.publishedAt).map((r) => [r.url, r.publishedAt!]),
    );
    let inserted = 0;
    if (articles.length > 0) {
      const urls = articles.map((a) => a.source_url);
      const { data: existingRows } = await supabase
        .from("news_articles")
        .select("source_url, published_at, title_en, title_hi, summary_en, summary_hi, category")
        .in("source_url", urls);
      const existing = new Map(
        (existingRows ?? []).map((r) => [r.source_url, r]),
      );
      const rows = articles.map((a) => {
        const prev = existing.get(a.source_url);
        // Never let a later non-AI refresh wipe bilingual text a previous
        // AI run already produced for the same story.
        const keepPrev = !a.title_hi && prev?.title_hi;
        return {
          city,
          title_en: keepPrev ? prev!.title_en : a.title_en,
          title_hi: a.title_hi ?? prev?.title_hi ?? null,
          summary_en: keepPrev ? prev!.summary_en : a.summary_en,
          summary_hi: a.summary_hi ?? prev?.summary_hi ?? null,
          category: a.category || prev?.category || "general",
          source_url: a.source_url,
          source_name: a.source_name || new URL(a.source_url).hostname.replace("www.", ""),
          published_at: pubMap.get(a.source_url) ?? prev?.published_at ?? new Date().toISOString(),
        };
      });


      // Update matching URLs too. A story may first be cached by the non-AI
      // fallback and gain its Hindi fields on a later successful AI run.
      const { data: insertedRows, error } = await supabase
        .from("news_articles")
        .upsert(rows, { onConflict: "source_url", ignoreDuplicates: false })
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

/**
 * Reasoning models often narrate before answering ("Here's a thinking
 * process: ... { ... }"), so a naive first-brace/last-brace slice breaks.
 * Scan for every balanced JSON object and return the first one that parses
 * and actually contains an "articles" array.
 */
function extractArticlesJson(raw: string): string | null {
  const text = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    .replace(/```(?:json)?/gi, " ");
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          const slice = text.slice(i, j + 1);
          try {
            const obj = JSON.parse(slice);
            if (obj && Array.isArray(obj.articles)) return slice;
          } catch { /* keep scanning */ }
          i = j;
          break;
        }
      }
    }
  }
  return null;
}


/**
 * A real story has a headline (not a section name like "राजस्थान") and a URL
 * that points at an article, not a site front page or e-paper index.
 */
const BLOCKED_HOSTS =
  /(^|\.)(gemini\.google|deepmind\.google|play\.google\.com|apps\.apple\.com|google\.com|blog\.google|openai\.com|anthropic\.com|microsoft\.com|apple\.com|youtube\.com|youtu\.be|instagram\.com|facebook\.com|x\.com|twitter\.com|tiktok\.com|pinterest\.com|amazon\.[a-z.]+|wikipedia\.org|linkedin\.com)$/i;

const PROMO_WORDS =
  /(gemini|chatgpt|copilot|ai assistant|asistente|download the app|app store|play store|subscribe now|pricing|sign up free)/i;

function isRealStory(url: string, title: string, text = "", city = ""): boolean {
  const t = (title ?? "").replace(/\s+/g, " ").trim();
  if (t.length < 15 || t.split(/\s+/).length < 3) return false;
  if (/(e-?paper|ई-?पेपर|epaper|live tv|photo gallery|web stories|latest news|breaking news|top stories|होम|home page)/i.test(t)) {
    return false;
  }
  if (PROMO_WORDS.test(t)) return false;
  let path = "";
  let host = "";
  try {
    const u = new URL(url);
    path = u.pathname;
    host = u.hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
  // Product/marketing/social pages are never local news.
  if (BLOCKED_HOSTS.test(host)) return false;
  // The story must actually mention the city somewhere.
  if (city) {
    const hay = `${text} ${url}`.toLowerCase();
    const hindiNewsSource = /[\u0900-\u097F]/.test(t) &&
      /(bhaskar|jagran|amarujala|patrika|livehindustan|navbharattimes|abplive|aajtak|news18|zeenews|public\.app|etvbharat|\.in)$|(bhaskar|jagran|amarujala|patrika|livehindustan|navbharattimes|abplive|aajtak|news18|zeenews|public\.app|etvbharat)/i
        .test(host);
    if (!hay.includes(city.toLowerCase()) && !hindiNewsSource) return false;
  }
  const segments = path.split("/").filter(Boolean);
  // Article URLs have a slug or numeric id; section fronts are 1-2 short words.
  if (segments.length === 0) return false;
  const last = segments[segments.length - 1];
  if (segments.length <= 1 && last.length < 12) return false;
  if (/^(news|city|state|india|videos?|photos?|tag|topic|category)$/i.test(last)) return false;
  return true;
}

function json(body: unknown, status: number) {

  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
