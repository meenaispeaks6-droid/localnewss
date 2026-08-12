import { citySlug } from "@/lib/geo";
import type { City } from "@/data/indiaCities";

const KEY = (city: City | string) => `ln:read:${citySlug(city)}`;
const LIMIT = 300;

/** Article ids the reader has already opened/marked as read, per city. */
export const getReadIds = (city: City | string): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY(city));
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
};

const persist = (city: City | string, ids: Set<string>) => {
  try {
    localStorage.setItem(KEY(city), JSON.stringify([...ids].slice(-LIMIT)));
  } catch {
    /* storage unavailable */
  }
};

export const markRead = (city: City | string, ids: string | string[]): Set<string> => {
  const next = getReadIds(city);
  (Array.isArray(ids) ? ids : [ids]).forEach((id) => next.add(id));
  persist(city, next);
  return next;
};

export const markUnread = (city: City | string, id: string): Set<string> => {
  const next = getReadIds(city);
  next.delete(id);
  persist(city, next);
  return next;
};

export const clearRead = (city: City | string): Set<string> => {
  try {
    localStorage.removeItem(KEY(city));
  } catch {
    /* storage unavailable */
  }
  return new Set();
};
