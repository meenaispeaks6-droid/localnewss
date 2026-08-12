import type { City } from "@/data/indiaCities";
import { citySlug, findCityBySlug } from "@/lib/geo";

const KEY = "ln:saved-city";

/** City the user last viewed/selected, remembered across visits. */
export const getSavedCity = (): City | undefined => {
  if (typeof window === "undefined") return undefined;
  try {
    return findCityBySlug(localStorage.getItem(KEY) ?? undefined);
  } catch {
    return undefined;
  }
};

export const saveCity = (city: City | string) => {
  try {
    localStorage.setItem(KEY, citySlug(city));
  } catch {
    /* storage unavailable */
  }
};

export const clearSavedCity = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
};
