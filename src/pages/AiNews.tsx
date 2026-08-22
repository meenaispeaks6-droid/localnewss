import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Bot, Cpu, RefreshCw, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import NewsCard from "@/components/NewsCard";
import NewsSkeleton from "@/components/NewsSkeleton";
import Seo from "@/components/Seo";
import NotifyButton from "@/components/NotifyButton";
import SiteFooter from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import type { Lang, NewsArticle } from "@/lib/newsTypes";
import { SITE_NAME, SITE_URL, cityPath, homePath } from "@/lib/geo";

/** Pseudo-city key used by the news pipeline for this topic feed. */
export const AI_TOPIC = "AI & Tools";

export const aiNewsPath = (lang: Lang) => (lang === "hi" ? "/ai-news/hi" : "/ai-news");

const REFRESH_MS = 90 * 1000;

const t = {
  en: {
    eyebrow: "Live AI intelligence feed",
    title: "AI & Tools",
    tagline: "Every model launch, tool drop and AI story — as it happens.",
    intro:
      "A live stream of artificial intelligence news: new models, AI tools and apps, funding rounds, research breakthroughs and policy moves, summarised in plain language and refreshed through the day.",
    refresh: "Sync now",
    fetching: "Scanning the wire...",
    updated: "Feed synced",
    error: "Could not sync the AI feed",
    empty: "No AI stories cached yet. Hit “Sync now”.",
    all: "All signals",
    stories: (n: number) => `${n} stories`,
    live: "LIVE",
    latest: "Latest drops",
    back: "All city news",
    updatedAt: "Last sync",
  },
  hi: {
    eyebrow: "लाइव एआई फ़ीड",
    title: "एआई और टूल्स",
    tagline: "हर नया मॉडल, हर नया टूल, हर एआई ख़बर — तुरंत।",
    intro:
      "आर्टिफिशियल इंटेलिजेंस की लाइव ख़बरें — नए एआई मॉडल, टूल्स और ऐप्स, फ़ंडिंग, रिसर्च और नीतियों की आसान भाषा में जानकारी, दिन भर अपडेट।",
    refresh: "अभी अपडेट करें",
    fetching: "ख़बरें खोजी जा रही हैं...",
    updated: "फ़ीड अपडेट हो गई",
    error: "एआई फ़ीड अपडेट नहीं हो सकी",
    empty: "अभी कोई एआई ख़बर सेव नहीं है। “अभी अपडेट करें” दबाएँ।",
    all: "सभी",
    stories: (n: number) => `${n} ख़बरें`,
    live: "लाइव",
    latest: "ताज़ा अपडेट",
    back: "शहरों की ख़बरें",
    updatedAt: "अंतिम अपडेट",
  },
};

const AiNews = ({ lang }: { lang: Lang }) => {
  const navigate = useNavigate();
  const c = t[lang];
  const hi = lang === "hi";
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [filter, setFilter] = useState<string>("__all");

  const loadCached = useCallback(async () => {
    const { data } = await supabase
      .from("news_articles")
      .select("*")
      .eq("city", AI_TOPIC)
      .order("published_at", { ascending: false })
      .limit(36);
    setArticles((data as NewsArticle[]) ?? []);
    setLoading(false);
    return (data ?? []).length;
  }, []);

  const sync = useCallback(
    async (silent = false) => {
      if (!silent) setFetching(true);
      try {
        const { data, error } = await supabase.functions.invoke("fetch-city-news", {
          body: { city: AI_TOPIC },
        });
        if (error) throw error;
        const fresh = (data?.articles as NewsArticle[]) ?? [];
        if (fresh.length > 0) {
          setArticles((current) => {
            const byId = new Map(current.map((a) => [a.id, a]));
            for (const a of fresh) byId.set(a.id, a);
            return [...byId.values()]
              .sort((a, b) => b.published_at.localeCompare(a.published_at))
              .slice(0, 36);
          });
          if (!silent) toast.success(c.updated);
        }
      } catch (e) {
        console.error("AI feed sync failed:", e);
        if (!silent) toast.error(c.error);
      } finally {
        if (!silent) setFetching(false);
      }
    },
    [c],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const count = await loadCached();
      if (active) await sync(count > 0);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tick = () => {
      if (!document.hidden) sync(true);
    };
    const timer = setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => {
    const seen = new Map<string, number>();
    for (const a of articles) {
      const key = (a.category ?? "general").trim();
      if (!key || key.toLowerCase() === "general") continue;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  }, [articles]);

  const visible = useMemo(
    () =>
      (filter === "__all" ? articles : articles.filter((a) => a.category === filter))
        // Topic stories have no city page, so cards link straight to the publisher.
        .map((a) => ({ ...a, slug: null })),
    [articles, filter],
  );

  const lastUpdated = articles[0]?.published_at ?? null;
  const title = hi
    ? "एआई और टूल्स न्यूज़ — आज की ताज़ा आर्टिफिशियल इंटेलिजेंस ख़बरें"
    : "AI & Tools News Today — Live Artificial Intelligence Updates";

  return (
    <div className="ai-surface flex min-h-dvh flex-col bg-background text-foreground">
      <Seo
        title={title}
        description={c.intro}
        path={aiNewsPath(lang)}
        lang={lang}
        altPath={aiNewsPath(hi ? "en" : "hi")}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: title,
          description: c.intro,
          url: `${SITE_URL}${aiNewsPath(lang)}`,
          inLanguage: hi ? "hi-IN" : "en-IN",
          dateModified: lastUpdated ?? undefined,
          about: { "@type": "Thing", name: "Artificial intelligence" },
          isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
        }}
      />

      <Header
        onCityChange={(name) => navigate(cityPath(name, lang))}
        lang={lang}
        onLangChange={(next) => navigate(aiNewsPath(next))}
      />

      <section className="relative isolate overflow-hidden border-b border-border">
        <div aria-hidden="true" className="absolute inset-0 ai-grid" />
        <div
          aria-hidden="true"
          className="ai-orb pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full opacity-50"
          style={{ background: "var(--ai-violet)" }}
        />
        <div
          aria-hidden="true"
          className="ai-orb pointer-events-none absolute -right-16 top-10 h-64 w-64 rounded-full opacity-40"
          style={{ background: "var(--ai-cyan)", animationDelay: "-4s" }}
        />

        <div className="container relative py-12 md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-3xl"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-medium backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              {c.eyebrow}
            </span>

            <h1 className="mt-5 font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
              <span className="ai-gradient-text">{c.title}</span>
            </h1>
            <p className="mt-3 font-heading text-lg text-foreground/90 sm:text-xl">{c.tagline}</p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {c.intro}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => sync()}
                disabled={fetching}
                className="ai-shine inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-[color:var(--primary-foreground)] shadow-lg transition-transform hover:scale-[1.03] disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} aria-hidden="true" />
                {fetching ? c.fetching : c.refresh}
              </button>
              <NotifyButton city={AI_TOPIC} state="India" lang={lang} />
              <Link
                to={homePath(lang)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card/60 px-4 text-sm backdrop-blur transition-colors hover:border-primary/50 hover:text-primary"
              >
                {c.back}
              </Link>
            </div>

            <dl className="mt-8 grid max-w-lg grid-cols-3 gap-3">
              {[
                { icon: Zap, label: c.live, value: c.stories(articles.length) },
                { icon: Bot, label: hi ? "मॉडल व टूल्स" : "Models & tools", value: String(categories.length || 1) },
                {
                  icon: Cpu,
                  label: c.updatedAt,
                  value: lastUpdated
                    ? new Date(lastUpdated).toLocaleTimeString(hi ? "hi-IN" : "en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-border bg-card/60 p-3 backdrop-blur"
                >
                  <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <s.icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    {s.label}
                  </dt>
                  <dd className="mt-1 font-heading text-sm font-semibold">{s.value}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        </div>
      </section>

      <main className="container flex-1 py-9 md:py-12">
        {categories.length > 0 && (
          <nav aria-label={hi ? "श्रेणियाँ" : "Topics"} className="mb-7 flex flex-wrap gap-2">
            {[["__all", c.all] as const, ...categories.map(([k]) => [k, k] as const)].map(
              ([key, label]) => {
                const active = filter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    aria-pressed={active}
                    className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm transition-all ${
                      active
                        ? "border-transparent bg-primary font-semibold text-[color:var(--primary-foreground)]"
                        : "border-border bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-primary"
                    }`}
                  >
                    {label}
                  </button>
                );
              },
            )}
          </nav>
        )}

        <h2 className="flex items-center gap-2 font-heading text-xl font-semibold tracking-tight sm:text-2xl">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
          {c.latest}
        </h2>

        {loading ? (
          <div className="mt-6">
            <NewsSkeleton />
          </div>
        ) : visible.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
            {c.empty}
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((a, i) => (
              <NewsCard key={a.id} article={a as NewsArticle} index={i} lang={lang} />
            ))}
          </div>
        )}
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
};

export default AiNews;
