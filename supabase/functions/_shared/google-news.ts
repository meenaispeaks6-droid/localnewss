// Free live-news source: Google News RSS search.
// No API key, no credits, no rate limits — used as the primary source so
// Firecrawl credits are only spent when RSS has nothing for a city.

export type NewsHit = {
  url: string;
  title: string;
  description: string;
  sourceName?: string;
  publishedAt?: string;
};

const SOCIAL =
  /(youtube\.com|youtu\.be|instagram\.com|facebook\.com|x\.com|twitter\.com|tiktok\.com)/i;

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : undefined;
}

async function fetchFeed(url: string): Promise<NewsHit[]> {
  let res: Response | null = null;
  // Two quick tries only: a throttled feed stays throttled, and readers
  // should never wait on long back-offs.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
          "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
        },
        signal: AbortSignal.timeout(8000),
      });
    } catch (e) {
      console.error(`Feed request failed ${url}:`, (e as Error).message);
      res = null;
    }
    if (res && (res.ok || (res.status !== 429 && res.status < 500))) break;
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  if (!res) return [];
  if (!res.ok) {
    console.error(`News RSS failed [${res.status}] ${url}`);
    return [];
  }
  const xml = await res.text();
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ??
    // Atom feeds (e.g. The Verge) use <entry> instead of <item>.
    xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  const hits: NewsHit[] = [];
  for (const item of items) {
    // RSS puts the URL in <link>text</link>, Atom in <link href="..."/>.
    const link = tag(item, "link") ||
      item.match(/<link[^>]+href="([^"]+)"/i)?.[1];
    const title = tag(item, "title");
    if (!link || !title || !link.startsWith("http") || SOCIAL.test(link)) continue;
    const pub = tag(item, "pubDate") ?? tag(item, "published") ?? tag(item, "updated");
    const parsed = pub ? new Date(pub) : null;
    hits.push({
      url: link,
      title: title.replace(/\s+-\s+[^-]+$/, "").slice(0, 200),
      description: (tag(item, "description") ?? tag(item, "summary") ?? "").slice(0, 500),
      sourceName: tag(item, "source"),
      publishedAt: parsed && !isNaN(parsed.getTime())
        ? parsed.toISOString()
        : undefined,
    });
  }
  return hits;
}

/**
 * Live news for a place from Google News RSS (Hindi feed first, then English).
 * Only stories from the last `maxAgeHours` are returned so readers always see
 * genuinely fresh news.
 */
export async function googleNewsSearch(
  place: string,
  maxAgeHours = 48,
  queries?: { hi?: string; en: string; extraFeeds?: string[] },
): Promise<NewsHit[]> {
  const hiQuery = queries ? queries.hi : `${place} समाचार OR news`;
  const enQuery = queries?.en ?? `${place} news`;
  const hiFeed = hiQuery
    ? `https://news.google.com/rss/search?q=${
      encodeURIComponent(hiQuery)
    }&hl=hi-IN&gl=IN&ceid=IN:hi`
    : null;
  // Topic feeds cover worldwide news, so they use the global English edition
  // instead of the India edition used for city news.
  const enLocale = queries ? "hl=en-US&gl=US&ceid=US:en" : "hl=en-IN&gl=IN&ceid=IN:en";
  const enFeed = `https://news.google.com/rss/search?q=${
    encodeURIComponent(enQuery)
  }&${enLocale}`;
  // Google News answers 503 to a lot of datacentre traffic, so Bing News RSS
  // runs as a free, always-available backup for the same queries.
  const bing = (q: string, hindi: boolean) =>
    `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=RSS&cc=${
      queries ? "US" : "IN"
    }${hindi ? "&setlang=hi" : ""}`;
  // Topic feeds (custom queries) are English-first — and English-only when no
  // Hindi query is supplied.
  const feeds = (queries
    ? [enFeed, ...(queries.extraFeeds ?? []), hiFeed, bing(enQuery, false)]
    : [
      hiFeed,
      enFeed,
      hiQuery ? bing(hiQuery, true) : null,
      bing(enQuery, false),
    ]).filter(Boolean) as string[];

  const seen = new Set<string>();
  const out: NewsHit[] = [];
  const cutoff = Date.now() - maxAgeHours * 3600_000;

  // All feeds run at once: one throttled source can no longer delay the rest.
  const perFeed = await Promise.all(
    feeds.map((feed) =>
      fetchFeed(feed).catch((e) => {
        console.error("News RSS error:", e);
        return [] as NewsHit[];
      })
    ),
  );

  for (const hits of perFeed) {
    for (const h of hits) {
      if (seen.has(h.url)) continue;
      if (h.publishedAt && new Date(h.publishedAt).getTime() < cutoff) continue;
      seen.add(h.url);
      out.push(h);
    }
  }

  return out
    .sort((a, b) =>
      (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")
    )
    .slice(0, queries ? 24 : 15);
}
