import { indiaCities, type City } from "@/data/indiaCities";

export const SITE_URL = "https://localnews.meenai.in";
export const SITE_NAME = "Local News";

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const citySlug = (city: City | string) =>
  slugify(typeof city === "string" ? city : city.name);

export interface StateInfo {
  state: string;
  stateHi: string;
  slug: string;
  cities: City[];
}

export const indiaStates: StateInfo[] = (() => {
  const map = new Map<string, StateInfo>();
  for (const c of indiaCities) {
    const existing = map.get(c.state);
    if (existing) existing.cities.push(c);
    else
      map.set(c.state, {
        state: c.state,
        stateHi: c.stateHi,
        slug: slugify(c.state),
        cities: [c],
      });
  }
  return [...map.values()].sort((a, b) => a.state.localeCompare(b.state));
})();

export const findCityBySlug = (slug?: string) =>
  slug ? indiaCities.find((c) => citySlug(c) === slug.toLowerCase()) : undefined;

export const findStateBySlug = (slug?: string) =>
  slug ? indiaStates.find((s) => s.slug === slug.toLowerCase()) : undefined;

export const findStateOf = (city: City) =>
  indiaStates.find((s) => s.state === city.state);

export const cityPath = (city: City | string, lang: "hi" | "en") =>
  `/news/${citySlug(city)}${lang === "hi" ? "/hi" : ""}`;

export const statePath = (slug: string, lang: "hi" | "en") =>
  `/state/${slug}${lang === "hi" ? "/hi" : ""}`;

export const homePath = (lang: "hi" | "en") => (lang === "hi" ? "/hi" : "/");

export const articlePath = (
  city: City | string,
  articleSlug: string,
  lang: "hi" | "en",
) => `/news/${citySlug(city)}/${articleSlug}${lang === "hi" ? "/hi" : ""}`;

export const cityCategoryPath = (
  city: City | string,
  category: string,
  lang: "hi" | "en",
) =>
  `/news/${citySlug(city)}/category/${slugify(category)}${lang === "hi" ? "/hi" : ""}`;
