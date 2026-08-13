import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronRight, Clock, ExternalLink } from "lucide-react";
import Header from "@/components/Header";
import Seo from "@/components/Seo";
import SiteFooter from "@/components/SiteFooter";
import NewsSkeleton from "@/components/NewsSkeleton";
import NotFound from "@/pages/NotFound";
import { supabase } from "@/integrations/supabase/client";
import { categoryHi, type Lang, type NewsArticle } from "@/lib/newsTypes";
import {
  SITE_NAME,
  SITE_URL,
  articlePath,
  cityCategoryPath,
  cityPath,
  findCityBySlug,
  findStateOf,
  homePath,
  statePath,
} from "@/lib/geo";

const t = {
  hi: {
    home: "भारत",
    source: "पूरी ख़बर पढ़ें",
    sourceNote: (name: string) => `यह ख़बर ${name} पर प्रकाशित हुई। पूरी रिपोर्ट वहीं पढ़ें।`,
    related: "इसी शहर की और ख़बरें",
    all: "सभी ख़बरें",
    missing: "यह ख़बर अब उपलब्ध नहीं है।",
    published: "प्रकाशित",
  },
  en: {
    home: "India",
    source: "Read the full report",
    sourceNote: (name: string) => `This story was reported by ${name}. Read the full report there.`,
    related: "More news from this city",
    all: "All stories",
    missing: "This story is no longer available.",
    published: "Published",
  },
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const ArticleNews = ({ lang }: { lang: Lang }) => {
  const { citySlug: slug, articleSlug } = useParams();
  const navigate = useNavigate();
  const city = findCityBySlug(slug);
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [related, setRelated] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const c = t[lang];

  const cityName = city?.name ?? "";

  useEffect(() => {
    if (!cityName || !articleSlug) return;
    let active = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("news_articles")
        .select("*")
        .eq("city", cityName)
        .eq("slug", articleSlug)
        .maybeSingle();
      if (!active) return;
      setArticle((data as NewsArticle) ?? null);
      const { data: rel } = await supabase
        .from("news_articles")
        .select("*")
        .eq("city", cityName)
        .order("published_at", { ascending: false })
        .limit(7);
      if (!active) return;
      setRelated(((rel as NewsArticle[]) ?? []).filter((r) => r.slug !== articleSlug).slice(0, 6));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [cityName, articleSlug]);

  if (!city) return <NotFound />;

  const stateInfo = findStateOf(city);
  const cityLabel = lang === "hi" ? city.nameHi : city.name;
  const stateLabel = lang === "hi" ? city.stateHi : city.state;
  const headline = article
    ? lang === "hi"
      ? article.title_hi || article.title_en
      : article.title_en
    : "";
  const summary = article
    ? (lang === "hi" ? article.summary_hi || article.summary_en : article.summary_en) ?? ""
    : "";
  const path = articlePath(city, articleSlug ?? "", lang);
  const sourceName = article ? article.source_name ?? hostOf(article.source_url) : "";
  const categoryLabel = article
    ? lang === "hi"
      ? categoryHi[article.category] ?? article.category
      : article.category
    : "";

  const title = article
    ? `${headline} — ${cityLabel} ${lang === "hi" ? "न्यूज़" : "News"}`
    : `${cityLabel} ${lang === "hi" ? "न्यूज़" : "News"}`;
  const description =
    (summary || headline).slice(0, 155) ||
    (lang === "hi" ? `${cityLabel} की ताज़ा ख़बर।` : `Latest news from ${city.name}.`);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Seo
        title={title}
        description={description}
        path={path}
        lang={lang}
        altPath={articlePath(city, articleSlug ?? "", lang === "hi" ? "en" : "hi")}
        image={article?.image_url ?? undefined}
        noindex={!loading && !article}
        jsonLd={
          article
            ? [
                {
                  "@context": "https://schema.org",
                  "@type": "NewsArticle",
                  headline,
                  description: summary || headline,
                  datePublished: article.published_at,
                  dateModified: article.published_at,
                  inLanguage: lang === "hi" ? "hi-IN" : "en-IN",
                  image: article.image_url ? [article.image_url] : undefined,
                  articleSection: article.category,
                  mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}${path}` },
                  publisher: { "@type": "Organization", name: sourceName || SITE_NAME },
                  contentLocation: {
                    "@type": "City",
                    name: city.name,
                    containedInPlace: { "@type": "AdministrativeArea", name: city.state },
                  },
                  isBasedOn: article.source_url,
                },
                {
                  "@context": "https://schema.org",
                  "@type": "BreadcrumbList",
                  itemListElement: [
                    { "@type": "ListItem", position: 1, name: c.home, item: `${SITE_URL}${homePath(lang)}` },
                    stateInfo && {
                      "@type": "ListItem",
                      position: 2,
                      name: stateLabel,
                      item: `${SITE_URL}${statePath(stateInfo.slug, lang)}`,
                    },
                    {
                      "@type": "ListItem",
                      position: 3,
                      name: cityLabel,
                      item: `${SITE_URL}${cityPath(city, lang)}`,
                    },
                    { "@type": "ListItem", position: 4, name: headline, item: `${SITE_URL}${path}` },
                  ].filter(Boolean),
                },
              ]
            : undefined
        }
      />

      <Header
        city={city.name}
        onCityChange={(name) => navigate(cityPath(name, lang))}
        lang={lang}
        onLangChange={(next) => navigate(articlePath(city, articleSlug ?? "", next))}
      />

      <main className="container flex-1 py-8 md:py-10">
        <nav aria-label="Breadcrumb" className="mb-5">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <li>
              <Link to={homePath(lang)} className="hover:text-primary">
                {c.home}
              </Link>
            </li>
            {stateInfo && (
              <>
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
                <li>
                  <Link to={statePath(stateInfo.slug, lang)} className="hover:text-primary">
                    {stateLabel}
                  </Link>
                </li>
              </>
            )}
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            <li>
              <Link to={cityPath(city, lang)} className="hover:text-primary">
                {cityLabel}
              </Link>
            </li>
          </ol>
        </nav>

        {loading ? (
          <NewsSkeleton />
        ) : !article ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">{c.missing}</p>
            <Link
              to={cityPath(city, lang)}
              className="mt-4 inline-flex min-h-10 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              {c.all}
            </Link>
          </div>
        ) : (
          <article className="mx-auto max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={cityCategoryPath(city, article.category, lang)}
                className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary"
              >
                {categoryLabel}
              </Link>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" aria-hidden="true" />
                <time dateTime={article.published_at}>
                  {c.published}{" "}
                  {new Date(article.published_at).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN")}
                </time>
              </span>
            </div>

            <h1 className="mt-3 font-heading text-2xl font-bold leading-tight tracking-tight text-balance sm:text-3xl md:text-4xl">
              {headline}
            </h1>

            {article.image_url && (
              <img
                src={article.image_url}
                alt={headline}
                loading="lazy"
                className="mt-5 aspect-video w-full rounded-2xl border border-border object-cover"
              />
            )}

            {summary && (
              <p className="mt-5 text-base leading-relaxed text-muted-foreground">{summary}</p>
            )}

            <div className="mt-6 rounded-2xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">{c.sourceNote(sourceName)}</p>
              <a
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                {c.source} <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>

            {related.length > 0 && (
              <section className="mt-10 border-t border-border pt-6">
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                  {lang === "hi" ? `${cityLabel} की और ख़बरें` : `${c.related} — ${city.name}`}
                </h2>
                <ul className="mt-4 grid gap-3">
                  {related.map((r) => (
                    <li key={r.id}>
                      <Link
                        to={r.slug ? articlePath(city, r.slug, lang) : cityPath(city, lang)}
                        className="block rounded-xl border border-border bg-card p-4 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
                      >
                        {lang === "hi" ? r.title_hi || r.title_en : r.title_en}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  to={cityPath(city, lang)}
                  className="mt-4 inline-flex min-h-9 items-center rounded-full bg-primary/10 px-3.5 text-sm font-medium text-primary"
                >
                  {c.all}
                </Link>
              </section>
            )}
          </article>
        )}
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
};

export default ArticleNews;
