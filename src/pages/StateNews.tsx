import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import Header from "@/components/Header";
import Seo from "@/components/Seo";
import SiteFooter from "@/components/SiteFooter";
import NotFound from "@/pages/NotFound";
import type { Lang } from "@/lib/newsTypes";
import { SITE_URL, cityPath, findStateBySlug, homePath, statePath } from "@/lib/geo";

const StateNews = ({ lang }: { lang: Lang }) => {
  const { stateSlug } = useParams();
  const navigate = useNavigate();
  const info = findStateBySlug(stateSlug);
  const hi = lang === "hi";

  if (!info) return <NotFound />;

  const label = hi ? info.stateHi : info.state;
  const path = statePath(info.slug, lang);
  const title = hi
    ? `${label} की ताज़ा ख़बरें — ${info.state} Local News`
    : `${info.state} Local News — City by City`;
  const description = hi
    ? `${label} के ${info.cities.length} शहरों की स्थानीय ख़बरें — अपना शहर चुनें और ताज़ा अपडेट हिंदी में पढ़ें।`
    : `Local news from ${info.cities.length} cities across ${info.state}. Pick your city for today's updates in English or Hindi.`;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Seo
        title={title}
        description={description}
        path={path}
        lang={lang}
        altPath={statePath(info.slug, hi ? "en" : "hi")}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: hi ? "भारत" : "India", item: `${SITE_URL}${homePath(lang)}` },
              { "@type": "ListItem", position: 2, name: label, item: `${SITE_URL}${path}` },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            description,
            url: `${SITE_URL}${path}`,
            inLanguage: hi ? "hi-IN" : "en-IN",
            mainEntity: {
              "@type": "ItemList",
              itemListElement: info.cities.map((c, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: c.name,
                url: `${SITE_URL}${cityPath(c, lang)}`,
              })),
            },
          },
        ]}
      />

      <Header
        onCityChange={(name) => navigate(cityPath(name, lang))}
        lang={lang}
        onLangChange={(next) => navigate(statePath(info.slug, next))}
      />

      <main className="container flex-1 py-10 md:py-14">
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <li>
              <Link to={homePath(lang)} className="hover:text-primary">
                {hi ? "भारत" : "India"}
              </Link>
            </li>
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            <li aria-current="page" className="font-medium text-foreground">
              {label}
            </li>
          </ol>
        </nav>

        <h1 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          <span className="text-primary">{label}</span>{" "}
          {hi ? "की ताज़ा ख़बरें" : "local news"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {description}
        </p>

        <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {info.cities.map((c) => (
            <li key={c.name}>
              <Link
                to={cityPath(c, lang)}
                className="flex min-h-14 items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary"
              >
                <span className="truncate font-medium">{hi ? c.nameHi : c.name}</span>
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
};

export default StateNews;
