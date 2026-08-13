# Rank for local city news (vs Dainik Bhaskar)

## What Semrush shows about the competition

Bhaskar's traffic comes from two things we don't have:

- A deep URL tree: `bhaskar.com/local/bihar/`, `/local/mp/ujjain/` — a state hub, a city hub, and thousands of **individual article pages** under each city.
- Server-rendered HTML, so Google indexes a story within minutes of publication.

Our site today has 688 city/state **list** pages and zero article pages. A list page that only shows headlines linking away to other publishers gives Google very little unique text to rank, and every visitor click leaves our site. That is the single biggest gap.

## What to build

### 1. Article pages of our own (the main change)
New route `/news/:citySlug/:articleSlug` (and `/en`) rendering one story:
- Headline as the H1, our Hindi/English summary, image, category, published time
- Clear "Read the full report at <source>" link out (attribution kept, but the page itself is ours)
- Related stories from the same city + link back to the city hub
- `NewsArticle` + `BreadcrumbList` JSON-LD with `datePublished`, `publisher`, `inLanguage`

City cards start linking to these internal pages instead of straight out to the source. This turns ~30 stories per city into indexable long-tail pages ("<city> <event> news"), which is exactly what wins city searches.

### 2. Article slugs
Add a `slug` column on `news_articles`, generated from the transliterated/English headline plus a short id suffix so it is unique and stable. Backfill existing rows; the ingest function fills it for new ones.

### 3. Category hubs per city
`/news/:citySlug/category/:category` for crime, weather, business, sport, education — matches queries like "patna crime news today". Linked from the city page as filter chips.

### 4. A live news sitemap
A backend function serving `/news-sitemap.xml`: the last 48 hours of articles with `<news:news>` publication tags, plus `lastmod` on city pages so Google re-crawls the ones that changed. Declared in `robots.txt` next to the existing sitemap.

### 5. Freshness signals on city pages
Visible "last updated" timestamp, `dateModified` in the CollectionPage schema, and article counts — freshness is a ranking factor in news.

## The honest limit

Everything above helps Google, which executes JavaScript. But this app renders entirely in the browser, so Google must queue each page for a second rendering pass — a real handicap in news, where speed of indexing decides who ranks. Bhaskar wins partly because its HTML is server-rendered. The app can get server rendering by upgrading to Lovable's latest template — type "/" in chat and choose "Migrate to TanStack Start", or ask me to do it ([what the upgrade gives you](https://lovable.dev/blog/building-apps-using-tanstack-start)). I'd do that after, or instead of, step 4 if you want the biggest ranking lever.

## Technical notes

- Migration: `alter table public.news_articles add column slug text`, unique index on `(city, slug)`, backfill, GRANTs unchanged.
- `fetch-city-news` edge function generates the slug on insert.
- New `src/pages/ArticleNews.tsx`, `src/pages/CityCategory.tsx`; routes added in `App.tsx` above the catch-all.
- New edge function `news-sitemap` (public, `verify_jwt = false`) returning XML.
- Static `scripts/generate-sitemap.ts` keeps handling the 688 evergreen routes.
