export type Lang = "hi" | "en";

export interface NewsArticle {
  id: string;
  city: string;
  title_en: string;
  title_hi: string | null;
  summary_en: string | null;
  summary_hi: string | null;
  source_name: string | null;
  source_url: string;
  image_url: string | null;
  category: string;
  published_at: string;
  slug?: string | null;
}

export const categoryHi: Record<string, string> = {
  Politics: "राजनीति",
  Crime: "क्राइम",
  Business: "बिज़नेस",
  Sports: "खेल",
  Education: "शिक्षा",
  Weather: "मौसम",
  Culture: "संस्कृति",
  Community: "समाज",
  Health: "स्वास्थ्य",
  general: "सामान्य",
};

/**
 * The same story often arrives from several feeds (different URLs, tiny
 * headline differences). Keep the first/newest copy of each story.
 */
const normaliseTitle = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097F]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 10)
    .join(" ");

export function dedupeArticles<T extends NewsArticle>(list: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const a of list) {
    const keys = [
      `u:${(a.source_url ?? "").split("?")[0]}`,
      `e:${normaliseTitle(a.title_en)}`,
      a.title_hi ? `h:${normaliseTitle(a.title_hi)}` : "",
    ].filter((k) => k && !k.endsWith(":"));
    if (keys.some((k) => seen.has(k))) continue;
    for (const k of keys) seen.add(k);
    out.push(a);
  }
  return out;
}
