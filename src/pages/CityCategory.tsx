import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import Header from "@/components/Header";
import NewsCard from "@/components/NewsCard";
import NewsSkeleton from "@/components/NewsSkeleton";
import Seo from "@/components/Seo";
import SiteFooter from "@/components/SiteFooter";
import NotFound from "@/pages/NotFound";
import { supabase } from "@/integrations/supabase/client";
import { categoryHi, type Lang, type NewsArticle } from "@/lib/newsTypes";
import {
  SITE_URL,
  cityCategoryPath,
  cityPath,
  findCityBySlug,
  findStateOf,
  homePath,
  slugify,
  statePath,
} from "@/lib/geo";

export const NEWS_CATEGORIES = [
  "Politics",
  "Crime",
  "Business",
  "Sports",
  "Education",
  "Weather",
  "Health",
  "Community",
] as const;

const CityCategory = ({ lang }: { lang: Lang }) => {
  const { citySlug: slug, category: catSlug } = useParams();
  const navigate = useNavigate();
  const city = findCityBySlug(slug);
  const category = NEWS_CATEGORIES.find((x) => slugify(x) === (catSlug ?? "").toLowerCase());
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  const cityName = city?.name ?? "";

  useEffect(() => {
    if (!cityName || !category) return;
    let active = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("news_articles")
        .select("*")
        .eq("city", cityName)
        .eq("category", category)
        .order("published_at", { ascending: false })
        .limit(30);
      if (!active) return;
      setArticles((data as NewsArticle[]) ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [cityName, category]);

  if (!city || !category) return <NotFound />;

  const stateInfo = findStateOf(city);
  const cityLabel = lang === "hi" ? city.nameHi : city.name;
  const stateLabel = lang === "hi" ? city.stateHi : city.state;
  const catLabel = lang === "hi" ? categoryHi[category] ?? category : category;
  const path = cityCategoryPath(city, category, lang);

  const title =
    lang === "hi"
      ? `${cityLabel} ${catLabel} न्यूज़ — आज की ख़बरें`
      : `${city.name} ${category} News Today — ${city.state}`;
  const description =
    lang === "hi"
      ? `${cityLabel} की ${catLabel} से जुड़ी आज की ताज़ा ख़बरें, भरोसेमंद स्रोतों से, दिन भर अपडेट।`
      : `Today's ${category.toLowerCase()} news from ${city.name}, ${city.state}, gathered from trusted sources and updated through the day.`;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Seo
        title={title}
        description={description}
        path={path}
        lang={lang}
        altPath={cityCategoryPath(city, category, lang === "hi" ? "en" : "hi")}
        noindex={!loading && articles.length === 0}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: title,
          description,
          url: `${SITE_URL}${path}`,
          inLanguage: lang === "hi" ? "hi-IN" : "en-IN",
          about: { "@type": "City", name: city.name },
        }}
      />

      <Header
        city={city.name}
        onCityChange={(name) => navigate(cityPath(name, lang))}
        lang={lang}
        onLangChange={(next) => navigate(cityCategoryPath(city, category, next))}
      />

      <main className="container flex-1 py-8 md:py-10">
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <li>
              <Link to={homePath(lang)} className="hover:text-primary">
                {lang === "hi" ? "भारत" : "India"}
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
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            <li aria-current="page" className="font-medium text-foreground">
              {catLabel}
            </li>
          </ol>
        </nav>

        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
          <span className="text-primary">{cityLabel}</span> {catLabel}{" "}
          {lang === "hi" ? "न्यूज़" : "news"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>

        <ul className="mt-6 flex flex-wrap gap-2">
          {NEWS_CATEGORIES.map((x) => (
            <li key={x}>
              <Link
                to={cityCategoryPath(city, x, lang)}
                aria-current={x === category ? "page" : undefined}
                className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm transition-colors ${
                  x === category
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/40 hover:text-primary"
                }`}
              >
                {lang === "hi" ? categoryHi[x] ?? x : x}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          {loading ? (
            <NewsSkeleton />
          ) : articles.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
              {lang === "hi"
                ? `${cityLabel} की ${catLabel} ख़बरें अभी उपलब्ध नहीं हैं।`
                : `No ${category.toLowerCase()} stories for ${city.name} right now.`}
            </p>
          ) : (
            <ul className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {articles.map((a, i) => (
                <li key={a.id} className="h-full">
                  <NewsCard article={a} index={i} lang={lang} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link
          to={cityPath(city, lang)}
          className="mt-8 inline-flex min-h-9 items-center rounded-full bg-primary/10 px-3.5 text-sm font-medium text-primary"
        >
          {lang === "hi" ? `${cityLabel} की सभी ख़बरें` : `All ${city.name} news`}
        </Link>
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
};

export default CityCategory;
