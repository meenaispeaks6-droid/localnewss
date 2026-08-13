import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useParams } from "react-router-dom";
import { RefreshCw, Newspaper, ChevronRight, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import NewsCard from "@/components/NewsCard";
import NewsSkeleton from "@/components/NewsSkeleton";
import Seo from "@/components/Seo";
import NotifyButton from "@/components/NotifyButton";
import SiteFooter from "@/components/SiteFooter";
import NotFound from "@/pages/NotFound";
import { supabase } from "@/integrations/supabase/client";
import type { Lang, NewsArticle } from "@/lib/newsTypes";
import {
  SITE_NAME,
  SITE_URL,
  cityPath,
  findCityBySlug,
  findStateOf,
  homePath,
  statePath,
} from "@/lib/geo";
import { saveCity } from "@/lib/savedCity";
import { clearRead, getReadIds, markRead, markUnread } from "@/lib/readState";

const t = {
  hi: {
    heading: "की ताज़ा ख़बरें",
    refresh: "नई ख़बरें लाएँ",
    loading: "ख़बरें लोड हो रही हैं...",
    fetching: "लाइव ख़बरें खोजी जा रही हैं...",
    empty: "इस शहर की ख़बरें अभी उपलब्ध नहीं हैं। 'नई ख़बरें लाएँ' दबाएँ।",
    updated: "ख़बरें अपडेट हो गईं",
    error: "ख़बरें लाने में समस्या हुई",
    count: (n: number) => `${n} ख़बरें`,
    unread: (n: number) => `${n} अपठित`,
    markAll: "सभी पढ़ी हुई",
    live: (n: number) => `${n} नई ख़बरें आई हैं`,
    skip: "मुख्य सामग्री पर जाएँ",
    home: "भारत",
    nearby: "के अन्य शहर",
    intro: (city: string, state: string) =>
      `${city} (${state}) की स्थानीय ख़बरें एक जगह — प्रशासन, अपराध, मौसम, ट्रैफ़िक, स्कूल-कॉलेज, कारोबार और खेल से जुड़ी ताज़ा अपडेट, भरोसेमंद समाचार स्रोतों से जुटाकर हिंदी में। हर ख़बर मूल स्रोत से जुड़ी है।`,
  },
  en: {
    heading: "latest news",
    refresh: "Fetch fresh news",
    loading: "Loading news...",
    fetching: "Searching live news...",
    empty: "No news cached for this city yet. Tap 'Fetch fresh news'.",
    updated: "News updated",
    error: "Could not fetch news",
    count: (n: number) => `${n} stories`,
    unread: (n: number) => `${n} unread`,
    markAll: "Mark all read",
    live: (n: number) => `${n} new stories just came in`,
    skip: "Skip to main content",
    home: "India",
    nearby: "More cities in",
    intro: (city: string, state: string) =>
      `Local news from ${city}, ${state} in one place — civic administration, crime, weather, traffic, schools and colleges, business and sport, gathered from trusted news sources and updated through the day. Every story links back to its original publisher.`,
  },
};

const STALE_MS = 60 * 60 * 1000;
const LIVE_POLL_MS = 60 * 1000;

const CityNews = ({ lang }: { lang: Lang }) => {
  const { citySlug: slug } = useParams();
  const navigate = useNavigate();
  const city = findCityBySlug(slug);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const c = t[lang];

  const cityName = city?.name ?? "";

  const loadCached = useCallback(async (target: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("news_articles")
      .select("*")
      .eq("city", target)
      .order("published_at", { ascending: false })
      .limit(30);
    if (error) console.error(error);
    const rows = (data as NewsArticle[]) ?? [];
    setArticles(rows);
    setLoading(false);
    const newest = rows[0]?.published_at ? new Date(rows[0].published_at).getTime() : 0;
    return { count: rows.length, stale: Date.now() - newest > STALE_MS };
  }, []);

  const fetchLive = useCallback(
    async (target: string, state?: string) => {
      setFetching(true);
      try {
        const { data, error } = await supabase.functions.invoke("fetch-city-news", {
          body: { city: target, state },
        });
        if (error) throw error;
        if (data?.error) throw new Error(String(data.error));
        const fresh = (data?.articles as NewsArticle[]) ?? [];
        if (fresh.length > 0) {
          setArticles(fresh);
          toast.success(c.updated);
        }
      } catch (e) {
        console.error("fetch-city-news failed:", e);
        toast.error(c.error);
      } finally {
        setFetching(false);
      }
    },
    [c],
  );

  useEffect(() => {
    if (!cityName) return;
    saveCity(cityName);
    setReadIds(getReadIds(cityName));
    let active = true;
    (async () => {
      const { count, stale } = await loadCached(cityName);
      if (active && (count === 0 || stale)) await fetchLive(cityName, city?.state);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityName]);

  // Live in-page alerts: poll for newer stories while the page stays open.
  useEffect(() => {
    if (!cityName) return;
    const timer = setInterval(async () => {
      if (document.hidden) return;
      const newest = articles[0]?.published_at;
      const query = supabase
        .from("news_articles")
        .select("*")
        .eq("city", cityName)
        .order("published_at", { ascending: false })
        .limit(30);
      const { data } = newest ? await query.gt("published_at", newest) : await query;
      const fresh = (data as NewsArticle[]) ?? [];
      if (newest && fresh.length > 0) {
        // Show new stories instantly, then tell the reader they arrived.
        setArticles((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...fresh.filter((f) => !seen.has(f.id)), ...prev];
        });
        const unseen = fresh.filter((f) => !readIds.has(f.id)).length;
        if (unseen === 0) return;
        toast.success(c.live(unseen), {
          action: {
            label: lang === "hi" ? "देखें" : "Show",
            onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }),
          },
        });
      }
    }, LIVE_POLL_MS);
    return () => clearInterval(timer);
  }, [cityName, articles, c, lang, readIds]);

  const toggleRead = useCallback(
    (id: string, next: boolean) => {
      if (!cityName) return;
      setReadIds(new Set(next ? markRead(cityName, id) : markUnread(cityName, id)));
    },
    [cityName],
  );

  if (!city) return <NotFound />;

  const stateInfo = findStateOf(city);
  const cityLabel = lang === "hi" ? city.nameHi : city.name;
  const stateLabel = lang === "hi" ? city.stateHi : city.state;
  const path = cityPath(city, lang);
  const busy = loading || (fetching && articles.length === 0);
  const siblings = (stateInfo?.cities ?? []).filter((x) => x.name !== city.name).slice(0, 12);
  const unreadCount = articles.filter((a) => !readIds.has(a.id)).length;

  const title =
    lang === "hi"
      ? `${cityLabel} न्यूज़ — आज का ${cityLabel} समाचार`
      : `${city.name} News Today — Local News, ${city.state}`;
  const description =
    lang === "hi"
      ? `${cityLabel}, ${stateLabel} की आज की ताज़ा ख़बरें — प्रशासन, अपराध, मौसम, कारोबार और खेल के लोकल समाचार हिंदी में, दिन भर अपडेट।`
      : `Today's local news from ${city.name}, ${city.state} — civic, crime, weather, business and sport updates from trusted sources, refreshed through the day.`;

  const faqs =
    lang === "hi"
      ? [
          {
            q: `${cityLabel} की आज की ताज़ा ख़बरें कहाँ पढ़ें?`,
            a: `इसी पेज पर ${cityLabel} की ताज़ा लोकल ख़बरें दिन भर अपडेट होती रहती हैं। हर ख़बर उसके मूल समाचार स्रोत से जुड़ी है, ताकि आप पूरी रिपोर्ट वहीं पढ़ सकें।`,
          },
          {
            q: `${cityLabel} समाचार कितनी बार अपडेट होते हैं?`,
            a: `ख़बरें लगातार जुटाई जाती हैं और पेज खुला रहने पर नई ख़बरें अपने आप दिखती हैं। आप "नई ख़बरें लाएँ" बटन दबाकर भी तुरंत ताज़ा अपडेट ला सकते हैं।`,
          },
          {
            q: `क्या ${cityLabel} की ख़बरें अंग्रेज़ी में भी मिलेंगी?`,
            a: `हाँ। ऊपर भाषा बदलकर आप ${city.name} की वही ख़बरें अंग्रेज़ी में पढ़ सकते हैं।`,
          },
          {
            q: `${stateLabel} के दूसरे शहरों की ख़बरें कैसे देखें?`,
            a: `नीचे दिए गए शहरों के लिंक पर जाएँ या ${stateLabel} पेज खोलें, जहाँ राज्य के सभी शहरों की सूची है।`,
          },
        ]
      : [
          {
            q: `Where can I read today's ${city.name} local news?`,
            a: `This page collects the latest ${city.name} news through the day. Every story links back to the publisher that reported it, so you can read the full report at the source.`,
          },
          {
            q: `How often is ${city.name} news updated?`,
            a: `Stories are gathered continuously and new ones appear automatically while the page is open. You can also tap "Fetch fresh news" for an immediate update.`,
          },
          {
            q: `Is ${city.name} news available in Hindi?`,
            a: `Yes. Switch the language at the top to read the same ${city.name} coverage in Hindi.`,
          },
          {
            q: `How do I see news from other cities in ${city.state}?`,
            a: `Use the city links below, or open the ${city.state} page for a full list of cities we cover.`,
          },
        ];


  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Seo
        title={title}
        description={description}
        path={path}
        lang={lang}
        altPath={cityPath(city, lang === "hi" ? "en" : "hi")}
        jsonLd={[
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
              { "@type": "ListItem", position: 3, name: cityLabel, item: `${SITE_URL}${path}` },
            ].filter(Boolean),
          },
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            description,
            url: `${SITE_URL}${path}`,
            inLanguage: lang === "hi" ? "hi-IN" : "en-IN",
            about: { "@type": "City", name: city.name, containedInPlace: { "@type": "AdministrativeArea", name: city.state } },
            mainEntity: {
              "@type": "ItemList",
              itemListElement: articles.slice(0, 20).map((a, i) => ({
                "@type": "ListItem",
                position: i + 1,
                item: {
                  "@type": "NewsArticle",
                  headline: lang === "hi" ? a.title_hi || a.title_en : a.title_en,
                  datePublished: a.published_at,
                  url: a.source_url,
                  publisher: { "@type": "Organization", name: a.source_name ?? SITE_NAME },
                },
              })),
            },
          },
        ]}
      />

      <a
        href="#news"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        {c.skip}
      </a>

      <Header
        city={city.name}
        onCityChange={(name) => navigate(cityPath(name, lang))}
        lang={lang}
        onLangChange={(next) => navigate(cityPath(city, next))}
      />

      <section className="relative overflow-hidden border-b border-border bg-secondary/40">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl"
        />
        <div className="container relative py-8 md:py-12">
          <nav aria-label="Breadcrumb" className="mb-4">
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
              <li aria-current="page" className="font-medium text-foreground">
                {cityLabel}
              </li>
            </ol>
          </nav>

          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <motion.h1
                key={path}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl md:text-5xl"
              >
                <span className="text-primary">{cityLabel}</span> {c.heading}
              </motion.h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {c.intro(cityLabel, stateLabel)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {articles.length > 0 && (
                <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {c.count(articles.length)}
                </span>
              )}
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                  {c.unread(unreadCount)}
                </span>
              )}
              {articles.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setReadIds(
                      unreadCount > 0
                        ? new Set(markRead(city.name, articles.map((a) => a.id)))
                        : clearRead(city.name),
                    )
                  }
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {unreadCount > 0 ? c.markAll : lang === "hi" ? "सभी अपठित" : "Mark all unread"}
                </button>
              )}
              <button
                type="button"
                onClick={() => fetchLive(city.name, city.state)}
                disabled={fetching}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
              >
                <RefreshCw aria-hidden="true" className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
                {fetching ? c.fetching : c.refresh}
              </button>
              <NotifyButton city={city.name} state={city.state} lang={lang} />
            </div>
          </div>
        </div>
      </section>

      <main id="news" className="container flex-1 py-8 md:py-10">
        <p className="sr-only" role="status" aria-live="polite">
          {busy ? c.loading : c.count(articles.length)}
        </p>

        {busy ? (
          <NewsSkeleton />
        ) : articles.length === 0 ? (
          <div className="mx-auto flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 text-center">
            <Newspaper className="h-9 w-9 text-muted-foreground" aria-hidden="true" />
            <p className="px-6 text-sm text-muted-foreground">{c.empty}</p>
          </div>
        ) : (
          <ul className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {articles.map((a, i) => (
              <li key={a.id} className="h-full">
                <NewsCard
                  article={a}
                  index={i}
                  lang={lang}
                  read={readIds.has(a.id)}
                  onToggleRead={toggleRead}
                />
              </li>
            ))}
          </ul>
        )}

        {siblings.length > 0 && stateInfo && (
          <section className="mt-12 border-t border-border pt-8">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              {lang === "hi" ? `${stateLabel} ${c.nearby}` : `${c.nearby} ${stateLabel}`}
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {siblings.map((s) => (
                <li key={s.name}>
                  <Link
                    to={cityPath(s, lang)}
                    className="inline-flex min-h-9 items-center rounded-full border border-border bg-card px-3.5 text-sm transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {lang === "hi" ? s.nameHi : s.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to={statePath(stateInfo.slug, lang)}
                  className="inline-flex min-h-9 items-center rounded-full bg-primary/10 px-3.5 text-sm font-medium text-primary"
                >
                  {lang === "hi" ? "सभी शहर" : "All cities"}
                </Link>
              </li>
            </ul>
          </section>
        )}
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
};

export default CityNews;
