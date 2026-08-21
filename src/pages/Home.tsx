import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Seo from "@/components/Seo";
import SiteFooter from "@/components/SiteFooter";
import LocalNewsBanner from "@/components/LocalNewsBanner";
import { getSavedCity } from "@/lib/savedCity";
import type { Lang } from "@/lib/newsTypes";
import { indiaCities } from "@/data/indiaCities";
import {
  SITE_NAME,
  SITE_URL,
  cityPath,
  homePath,
  indiaStates,
  statePath,
} from "@/lib/geo";

const POPULAR = [
  "Delhi", "Mumbai", "Bengaluru", "Hyderabad", "Chennai", "Kolkata",
  "Pune", "Ahmedabad", "Jaipur", "Lucknow", "Patna", "Bhopal",
];

// Small state-specific flavour shown next to a few state names.
const STATE_FLAVOUR: Record<string, { emoji: string; en: string; hi: string }> = {
  rajasthan: { emoji: "🐪", en: "Forts & desert", hi: "किले और रेगिस्तान" },
  "andaman-and-nicobar-islands": { emoji: "🏝️", en: "Islands & beaches", hi: "द्वीप और समुद्र तट" },
};


const Home = ({ lang }: { lang: Lang }) => {
  const navigate = useNavigate();
  const hi = lang === "hi";
  const path = homePath(lang);

  // Returning visitors go straight to their remembered city (once per session).
  useEffect(() => {
    if (sessionStorage.getItem("ln:home-visited")) return;
    sessionStorage.setItem("ln:home-visited", "1");
    const saved = getSavedCity();
    if (saved) navigate(cityPath(saved, lang), { replace: true });
  }, [lang, navigate]);

  const title = hi
    ? "लोकल न्यूज़ — भारत के हर शहर की ताज़ा ख़बरें"
    : "Local News — Every City in India, Hindi & English";
  const description = hi
    ? "भारत के 300+ शहरों की स्थानीय ख़बरें एक जगह — दिल्ली, मुंबई, जयपुर, पटना, चेन्नई और हर राज्य की ताज़ा अपडेट हिंदी और अंग्रेज़ी में।"
    : "Local news from 300+ cities across India — Delhi, Mumbai, Jaipur, Patna, Chennai and every state, in Hindi and English.";

  const popularCities = POPULAR.map((n) => indiaCities.find((c) => c.name === n)).filter(Boolean);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Seo
        title={title}
        description={description}
        path={path}
        lang={lang}
        altPath={homePath(hi ? "en" : "hi")}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          url: SITE_URL,
          inLanguage: hi ? "hi-IN" : "en-IN",
          description,
        }}
      />

      <Header
        onCityChange={(name) => navigate(cityPath(name, lang))}
        lang={lang}
        onLangChange={(next) => navigate(homePath(next))}
      />

      <main className="container flex-1 py-10 md:py-14">
        <LocalNewsBanner lang={lang} />
        <h1 className="max-w-3xl font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl md:text-5xl">
          {hi ? (
            <>
              भारत के हर शहर की <span className="text-primary">स्थानीय ख़बरें</span>
            </>
          ) : (
            <>
              <span className="text-primary">Local news</span> from every city in India
            </>
          )}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {description}
        </p>

        <section className="mt-10">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            {hi ? "लोकप्रिय शहर" : "Popular cities"}
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {popularCities.map((c) => (
              <li key={c!.name}>
                <Link
                  to={cityPath(c!, lang)}
                  className="flex min-h-14 flex-col justify-center rounded-2xl border border-border bg-card px-4 py-2 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                >
                  <span className="font-heading text-sm font-semibold">
                    {hi ? c!.nameHi : c!.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {hi ? c!.stateHi : c!.state}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            {hi ? "राज्य के अनुसार ख़बरें" : "Browse news by state"}
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {indiaStates.map((s) => {
              const flavour = STATE_FLAVOUR[s.slug];
              return (
                <li key={s.slug}>
                  <Link
                    to={statePath(s.slug, lang)}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {flavour && (
                        <span aria-hidden="true" className="text-base leading-none">
                          {flavour.emoji}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate">{hi ? s.stateHi : s.state}</span>
                        {flavour && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {hi ? flavour.hi : flavour.en}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {s.cities.length}
                    </span>
                  </Link>
                </li>
              );
            })}

          </ul>
        </section>
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
};

export default Home;
