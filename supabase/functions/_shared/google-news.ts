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
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LocalNewsBot/1.0; +https://localnews.meenai.in)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });
    if (res.ok || (res.status !== 429 && res.status < 500)) break;
    // Google throttles bursts from datacentre IPs with 429/503; back off.
    await new Promise((resolve) => setTimeout(resolve, 700 * 2 ** attempt));
  }
  if (!res) return [];
  if (!res.ok) {
    console.error(`Google News RSS failed [${res.status}] ${url}`);
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
  // Topic feeds (custom queries) are English-first — and English-only when no
  // Hindi query is supplied.
  const feeds = (queries
    ? [enFeed, ...(queries.extraFeeds ?? []), hiFeed]
    : [hiFeed, enFeed]).filter(Boolean) as string[];

  const seen = new Set<string>();
  const out: NewsHit[] = [];
  const cutoff = Date.now() - maxAgeHours * 3600_000;

  for (const feed of feeds) {
    let hits: NewsHit[] = [];
    try {
      hits = await fetchFeed(feed);
    } catch (e) {
      console.error("Google News RSS error:", e);
    }
    for (const h of hits) {
      if (seen.has(h.url)) continue;
      if (h.publishedAt && new Date(h.publishedAt).getTime() < cutoff) continue;
      seen.add(h.url);
      out.push(h);
    }
    if (out.length >= (queries ? 24 : 12)) break;
  }

  return out
    .sort((a, b) =>
      (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")
    )
    .slice(0, queries ? 24 : 15);
}
