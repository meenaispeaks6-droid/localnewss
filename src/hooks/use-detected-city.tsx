import { useCallback, useEffect, useState } from "react";
import { detectCity } from "@/lib/detectCity";
import type { City } from "@/data/indiaCities";
import { getSavedCity, saveCity, clearSavedCity } from "@/lib/savedCity";

const DISMISS_KEY = "ln:geo-dismissed";

export const useDetectedCity = () => {
  const [saved] = useState<City | undefined>(() => getSavedCity());
  const [city, setCity] = useState<City | undefined>(saved);
  const [loading, setLoading] = useState(!saved);
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1",
  );

  const run = useCallback(async (usePrecise: boolean) => {
    setLoading(true);
    const found = await detectCity(usePrecise);
    setCity(found);
    if (found) saveCity(found);
    setLoading(false);
    return found;
  }, []);

  useEffect(() => {
    // Remembered city from a previous visit — no need to detect again.
    if (saved) return;
    let active = true;
    (async () => {
      // Only use GPS silently if permission was already granted.
      let granted = false;
      try {
        const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
        granted = status?.state === "granted";
      } catch {
        granted = false;
      }
      const found = await detectCity(granted);
      if (active) {
        setCity(found);
        if (found) saveCity(found);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [saved]);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }, []);

  const forget = useCallback(() => {
    clearSavedCity();
    setCity(undefined);
    void run(true);
  }, [run]);

  return {
    city,
    loading,
    dismissed,
    dismiss,
    remembered: Boolean(saved),
    forget,
    requestPrecise: () => run(true),
  };
};
