import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Moon, RefreshCw, Sun } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import NewsCard from "@/components/NewsCard";
import NewsSkeleton from "@/components/NewsSkeleton";
import Seo from "@/components/Seo";
import NotifyButton from "@/components/NotifyButton";
import SiteFooter from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import type { NewsArticle } from "@/lib/newsTypes";
import { SITE_NAME, SITE_URL, cityPath, homePath } from "@/lib/geo";

/** Pseudo-city key used by the news pipeline for this topic feed. */
export const AI_TOPIC = "AI & Tools";

/** This feed is English-only by design, so it has a single URL. */
export const aiNewsPath = () => "/ai-news";

const REFRESH_MS = 90 * 1000;

const AiNews = () => {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [filter, setFilter] = useState<string>("__all");
  // Page-local appearance: dark by default, light just swaps to a white surface.
  const [mode, setMode] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return localStorage.getItem("ai-news-mode") === "light" ? "light" : "dark";
  });

  useEffect(() => {
    localStorage.setItem("ai-news-mode", mode);
  }, [mode]);

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

  const sync = useCallback(async (silent = false) => {
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
        if (!silent) toast.success("Feed synced");
      }
    } catch (e) {
      console.error("AI feed sync failed:", e);
      if (!silent) toast.error("Could not sync the AI feed");
    } finally {
      if (!silent) setFetching(false);
    }
  }, []);

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
  const title = "AI & Tools News Today — Live Artificial Intelligence Updates";
  const description =
    "A live stream of artificial intelligence news in English: new AI models, tools and apps, funding rounds, research breakthroughs and policy moves, summarised in plain language and refreshed through the day.";

  return (
    <div className={`ai-surface ${mode === "light" ? "ai-light" : ""} flex min-h-dvh flex-col bg-background text-foreground`}>
      <Seo
        title={title}
        description={description}
        path={aiNewsPath()}
        lang="en"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: title,
          description,
          url: `${SITE_URL}${aiNewsPath()}`,
          inLanguage: "en",
          dateModified: lastUpdated ?? undefined,
          about: { "@type": "Thing", name: "Artificial intelligence" },
          isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
        }}
      />

      <Header
        onCityChange={(name) => navigate(cityPath(name, "en"))}
        lang="en"
        onLangChange={(next) => navigate(homePath(next))}
        hideLangToggle
        hideThemeToggle
      />

      <section className="relative isolate overflow-hidden border-b border-border">
        <div aria-hidden="true" className="ai-grid absolute inset-0" />
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
              Live AI intelligence feed
            </span>

            <h1 className="mt-5 font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
              <span className="ai-gradient-text">AI &amp; Tools</span>
            </h1>
            <p className="mt-3 font-heading text-lg text-foreground/90 sm:text-xl">
              Every model launch, tool drop and AI story — as it happens.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {description}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => sync()}
                disabled={fetching}
                className="ai-shine inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-[color:var(--primary-foreground)] shadow-lg transition-transform hover:scale-[1.03] disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {fetching ? "Scanning the wire..." : "Sync now"}
              </button>
              <NotifyButton city={AI_TOPIC} state="India" lang="en" />
              <button
                type="button"
                onClick={() => setMode((m) => (m === "dark" ? "light" : "dark"))}
                aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-card/60 px-4 text-sm backdrop-blur transition-colors hover:border-primary/50 hover:text-primary"
              >
                {mode === "dark" ? (
                  <Sun className="h-4 w-4 text-primary" aria-hidden="true" />
                ) : (
                  <Moon className="h-4 w-4 text-primary" aria-hidden="true" />
                )}
              </button>
            </div>

          </motion.div>
        </div>
      </section>

      <main className="container flex-1 py-9 md:py-12">
        {categories.length > 0 && (
          <nav aria-label="Topics" className="mb-7 flex flex-wrap gap-2">
            {[["__all", "All signals"] as const, ...categories.map(([k]) => [k, k] as const)].map(
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

        <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
          Latest drops
        </h2>

        {loading ? (
          <div className="mt-6">
            <NewsSkeleton />
          </div>
        ) : visible.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
            No AI stories cached yet. Hit “Sync now”.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((a, i) => (
              <NewsCard key={a.id} article={a as NewsArticle} index={i} lang="en" />
            ))}
          </div>
        )}
      </main>

      <SiteFooter lang="en" />
    </div>
  );
};

export default AiNews;
