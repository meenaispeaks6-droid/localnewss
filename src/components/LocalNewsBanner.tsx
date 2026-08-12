import { Link } from "react-router-dom";
import { LocateFixed, X, Loader2 } from "lucide-react";
import { useDetectedCity } from "@/hooks/use-detected-city";
import NotifyButton from "@/components/NotifyButton";
import { cityPath } from "@/lib/geo";
import type { Lang } from "@/lib/newsTypes";

const LocalNewsBanner = ({ lang }: { lang: Lang }) => {
  const hi = lang === "hi";
  const { city, loading, dismissed, dismiss, remembered, forget, requestPrecise } =
    useDetectedCity();

  if (dismissed) return null;

  return (
    <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <LocateFixed className="h-4 w-4" aria-hidden="true" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        {loading ? (
          <p className="text-sm text-muted-foreground">
            {hi ? "आपका शहर पता किया जा रहा है..." : "Detecting your location..."}
          </p>
        ) : city ? (
          <p className="text-sm">
            {remembered
              ? hi
                ? "आपका सहेजा गया शहर: "
                : "Your saved location: "
              : hi
                ? "आपका शहर: "
                : "Your location: "}
            <span className="font-semibold">{hi ? city.nameHi : city.name}</span>
            <span className="text-muted-foreground">, {hi ? city.stateHi : city.state}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {hi
              ? "हम आपका शहर पता नहीं कर सके। सटीक लोकेशन की अनुमति दें या शहर चुनें।"
              : "We couldn't detect your city. Allow precise location or pick a city."}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {city && (
          <Link
            to={cityPath(city, lang)}
            className="flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {hi ? "स्थानीय ख़बरें देखें" : "See local news"}
          </Link>
        )}
        {city && <NotifyButton city={city.name} state={city.state} lang={lang} />}
        {city && remembered && (
          <button
            type="button"
            onClick={forget}
            className="flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-secondary"
          >
            {hi ? "बदलें" : "Change"}
          </button>
        )}
        {!loading && !city && (
          <button
            type="button"
            onClick={requestPrecise}
            className="flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-secondary"
          >
            {hi ? "लोकेशन इस्तेमाल करें" : "Use my location"}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label={hi ? "बंद करें" : "Dismiss"}
          className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default LocalNewsBanner;
