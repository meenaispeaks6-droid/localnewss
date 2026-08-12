import { Helmet } from "react-helmet-async";
import { SITE_URL } from "@/lib/geo";
import type { Lang } from "@/lib/newsTypes";

interface SeoProps {
  title: string;
  description: string;
  path: string;
  lang: Lang;
  /** Path of the alternate-language version of this same page */
  altPath?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const Seo = ({ title, description, path, lang, altPath, noindex, jsonLd }: SeoProps) => {
  const url = `${SITE_URL}${path}`;
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <html lang={lang} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, follow" />}
      {altPath && (
        <link
          rel="alternate"
          hrefLang={lang === "hi" ? "en-IN" : "hi-IN"}
          href={`${SITE_URL}${altPath}`}
        />
      )}
      {altPath && <link rel="alternate" hrefLang={lang === "hi" ? "hi-IN" : "en-IN"} href={url} />}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={lang === "hi" ? "hi_IN" : "en_IN"} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {blocks.map((block, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  );
};

export default Seo;
