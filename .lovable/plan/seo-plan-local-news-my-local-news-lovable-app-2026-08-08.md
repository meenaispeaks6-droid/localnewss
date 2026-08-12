# SEO Plan — Local News (my-local-news.lovable.app)

## The core problem

The site has **307 cities** but only **one URL** (`/`). City selection happens in React state, so Google sees a single page with whatever city loads by default (Jaipur). Every "Patna local news in Hindi" search — the exact demand this app serves — has no page to rank.

Everything else below is secondary to fixing that.

---

## Phase 1 — Indexable city URLs (highest impact)

Add real routes so each city/state is its own page:

```text
/                          → India hub, city + state directory
/news/:citySlug            → e.g. /news/patna  (Hindi default)
/news/:citySlug/en         → English variant
/state/:stateSlug          → e.g. /state/bihar, links to its cities
```

- City and language come from the URL, not `useState`; the header picker navigates instead of setting state.
- Cached articles for the city render immediately on load so the page is never empty for a crawler.
- Add `hreflang` between the `hi` and `en` variants of each city.

Result: ~307 city pages + ~36 state pages + hub, instead of 1.

## Phase 2 — Per-page head metadata

Install `react-helmet-async`, add `HelmetProvider` in `main.tsx`, and give every route:

- `<title>`: `पटना की ताज़ा ख़बरें — Patna Local News Today` (<60 chars)
- `<meta name="description">`: city + state + language, <160 chars
- Self-referencing `<link rel="canonical">` per route (remove any sitewide canonical)
- Per-route `og:title` / `og:description` / `og:url`
- Single `<h1>` per page (already the case)

Note: this is a client-rendered SPA. Googlebot executes JS and will see these tags, but social crawlers (WhatsApp, LinkedIn, Facebook) only read the static `index.html`, so link previews stay generic per-page. Fixing that properly needs server rendering — the app can get it by upgrading to Lovable's latest template ("/" in chat → "Migrate to TanStack Start", [what the upgrade gives you](https://lovable.dev/blog/building-apps-using-tanstack-start)). Not required for Google ranking.

## Phase 3 — Structured data (JSON-LD)

- `index.html`: `Organization` + `WebSite` (with `SearchAction` once search exists)
- City page: `CollectionPage` + `ItemList` of the articles, each item `NewsArticle` with `headline`, `datePublished`, `url`, `publisher`
- `BreadcrumbList`: India → State → City

## Phase 4 — Sitemap & robots

- Add `scripts/generate-sitemap.ts` wired to `predev` / `prebuild`, emitting `public/sitemap.xml` with the hub, all state pages, and both language variants of all 307 city pages. No `lastmod` unless we have a real per-page timestamp.
- `public/robots.txt`: keep the existing allow blocks, add `Sitemap: https://my-local-news.lovable.app/sitemap.xml`.

## Phase 5 — Content depth per city page

Thin pages of aggregated links rank poorly. Each city page gets crawlable, city-specific content around the feed:

- One short intro paragraph naming the city, state, and what the page covers (generated once per city from the city dataset, not AI-invented facts).
- Article summaries rendered as real text (already stored in the DB) rather than only headlines.
- Internal links: city → its state page → neighbouring cities in the same state. This is what gets 307 pages crawled from a homepage.
- Only link out to sources with `rel="noopener"` — keep `nofollow` off so pages read as a genuine aggregator.

## Phase 6 — Technical hygiene

- Real 404 status behaviour for unknown city slugs (noindex on `NotFound`, per-route only).
- Lazy-load below-the-fold content; the news grid already avoids images so LCP should be text — keep it that way.
- Ensure the cached-article read happens before first paint where possible so crawlers don't get a skeleton.

## Phase 7 — Measure

- Verify the property in Google Search Console and submit the sitemap.
- After a few weeks, check which city pages get impressions; Semrush can validate demand per city term (e.g. "patna news in hindi") and show which competitors own those SERPs.

---

## Technical notes

- Slugs: derive from `indiaCities` (`name` → lowercase, spaces → `-`), stored alongside the existing Hindi fields so URLs stay stable.
- `document.documentElement.lang` must follow the route language (`hi` / `en`), not component state.
- The `fetch-city-news` edge function stays unchanged; routing only changes which city it is called with.
- Sitemap generation reads `src/data/indiaCities.ts` directly — no DB call needed at build time.

## Suggested order

1, 2, 4 first (routes + metadata + sitemap) — that is where nearly all the gain is. Then 3, 5, 6, and 7 as ongoing.
