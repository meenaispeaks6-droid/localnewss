import { indiaCities, type City } from "@/data/indiaCities";

const norm = (v: string) =>
  v.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();

/** Match a free-form place/district/state string from a geocoder to a known city. */
export const matchCity = (
  place?: string | null,
  district?: string | null,
  state?: string | null,
): City | undefined => {
  const candidates = [place, district].filter(Boolean).map((v) => norm(v as string));
  if (candidates.length === 0) return undefined;

  const inState = state
    ? indiaCities.filter((c) => norm(c.state) === norm(state) || norm(state).includes(norm(c.state)))
    : [];
  const pools = inState.length ? [inState, indiaCities] : [indiaCities];

  for (const pool of pools) {
    for (const cand of candidates) {
      const exact = pool.find((c) => norm(c.name) === cand);
      if (exact) return exact;
    }
    for (const cand of candidates) {
      const partial = pool.find(
        (c) => cand.includes(norm(c.name)) || norm(c.name).includes(cand),
      );
      if (partial) return partial;
    }
  }
  return undefined;
};

interface Geo {
  place?: string;
  district?: string;
  state?: string;
}

const reverseGeocode = async (lat: number, lon: number): Promise<Geo> => {
  const res = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
  );
  if (!res.ok) throw new Error("reverse geocode failed");
  const d = await res.json();
  return { place: d.city || d.locality, district: d.localityInfo?.administrative?.[3]?.name, state: d.principalSubdivision };
};

const ipLookup = async (): Promise<Geo> => {
  const res = await fetch("https://ipapi.co/json/");
  if (!res.ok) throw new Error("ip lookup failed");
  const d = await res.json();
  return { place: d.city, district: d.region, state: d.region };
};

const browserPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 10 * 60 * 1000,
    });
  });

/** Detects the user's city, preferring GPS and falling back to IP geolocation. */
export const detectCity = async (usePrecise: boolean): Promise<City | undefined> => {
  let geo: Geo | undefined;
  if (usePrecise) {
    try {
      const pos = await browserPosition();
      geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
    } catch {
      geo = undefined;
    }
  }
  if (!geo) {
    try {
      geo = await ipLookup();
    } catch {
      return undefined;
    }
  }
  return matchCity(geo.place, geo.district, geo.state);
};
