import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Lang } from "@/lib/newsTypes";

type Kind = "sun" | "rain" | "cloud" | "storm" | "snow" | "fog";

interface Weather {
  temp: number;
  feels: number;
  code: number;
  wind: number;
  kind: Kind;
  isDay: boolean;
}

const kindOf = (code: number): Kind => {
  if (code === 0 || code === 1) return "sun";
  if (code === 2 || code === 3) return "cloud";
  if (code >= 45 && code <= 48) return "fog";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 95) return "storm";
  if (code >= 51) return "rain";
  return "cloud";
};

const label: Record<Kind, { en: string; hi: string }> = {
  sun: { en: "Clear & sunny", hi: "साफ़ धूप" },
  cloud: { en: "Cloudy", hi: "बादल छाए" },
  rain: { en: "Rain", hi: "बारिश" },
  storm: { en: "Thunderstorm", hi: "आँधी-तूफ़ान" },
  snow: { en: "Snow", hi: "बर्फ़बारी" },
  fog: { en: "Fog", hi: "कोहरा" },
};

/** Animated sun; ray length/speed grows with the temperature. */
const SunScene = ({ temp }: { temp: number }) => {
  const heat = Math.max(0, Math.min(1, (temp - 18) / 26));
  return (
    <svg viewBox="0 0 120 90" className="h-full w-full" role="img" aria-hidden="true">
      <motion.g
        style={{ transformOrigin: "60px 40px" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 26 - heat * 14, repeat: Infinity, ease: "linear" }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <rect
            key={i}
            x="59"
            y={8 - heat * 5}
            width="2"
            height={10 + heat * 9}
            rx="1"
            fill="currentColor"
            className="text-amber-400"
            opacity={0.5 + heat * 0.5}
            transform={`rotate(${i * 30} 60 40)`}
          />
        ))}
      </motion.g>
      <motion.circle
        cx="60"
        cy="40"
        r={15 + heat * 3}
        className="fill-amber-400"
        animate={{ opacity: [0.85, 1, 0.85], scale: [1, 1.05, 1] }}
        style={{ transformOrigin: "60px 40px" }}
        transition={{ duration: 3 - heat, repeat: Infinity, ease: "easeInOut" }}
      />
      {heat > 0.6 && (
        <motion.path
          d="M30 74 q6 -6 12 0 t12 0 t12 0 t12 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="text-amber-500/60"
          animate={{ y: [0, -4, 0], opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </svg>
  );
};

const MoonScene = () => (
  <svg viewBox="0 0 120 90" className="h-full w-full" role="img" aria-hidden="true">
    <motion.g
      animate={{ y: [0, -3, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      <circle cx="60" cy="42" r="20" className="fill-sky-100" />
      <circle cx="69" cy="34" r="19" className="fill-card" />
    </motion.g>
    {[{ x: 29, y: 24 }, { x: 91, y: 29 }, { x: 82, y: 65 }, { x: 34, y: 62 }].map(
      (star, index) => (
        <motion.circle
          key={index}
          cx={star.x}
          cy={star.y}
          r="1.8"
          className="fill-sky-200"
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: index * 0.35 }}
        />
      ),
    )}
  </svg>
);

/** Rain with a cute cartoon character walking under an umbrella. */
const RainScene = ({ storm }: { storm?: boolean }) => (
  <svg viewBox="0 0 120 90" className="h-full w-full" role="img" aria-hidden="true">
    <g className="fill-slate-400/70">
      <ellipse cx="46" cy="18" rx="18" ry="11" />
      <ellipse cx="66" cy="20" rx="14" ry="9" />
    </g>
    {Array.from({ length: 9 }).map((_, i) => (
      <motion.line
        key={i}
        x1={20 + i * 10}
        y1="30"
        x2={17 + i * 10}
        y2="40"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-sky-400"
        animate={{ y: [0, 46], opacity: [0, 1, 0] }}
        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12, ease: "linear" }}
      />
    ))}
    {storm && (
      <motion.path
        d="M62 30 l-8 14 h7 l-5 12 14 -16 h-7 z"
        className="fill-amber-300"
        animate={{ opacity: [0, 1, 0, 0, 0] }}
        transition={{ duration: 2.6, repeat: Infinity }}
      />
    )}

    {/* walking character */}
    <motion.g
      animate={{ x: [-6, 6, -6], y: [0, -1.5, 0] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
    >
      <path d="M42 58 q18 -14 36 0" className="fill-primary" />
      <rect x="59" y="56" width="2" height="14" rx="1" className="fill-foreground/60" />
      <circle cx="60" cy="72" r="5" className="fill-amber-200 stroke-foreground/40" strokeWidth="1" />
      <circle cx="58" cy="72" r="0.9" className="fill-foreground/70" />
      <circle cx="62" cy="72" r="0.9" className="fill-foreground/70" />
      <path d="M58 74.5 q2 1.8 4 0" fill="none" stroke="currentColor" strokeWidth="0.9" className="text-foreground/60" strokeLinecap="round" />
      <rect x="56" y="77" width="8" height="8" rx="3" className="fill-primary/80" />
      <motion.rect
        x="56.5"
        y="84"
        width="2"
        height="5"
        rx="1"
        className="fill-foreground/60"
        animate={{ rotate: [12, -12, 12] }}
        style={{ transformOrigin: "57.5px 84px" }}
        transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.rect
        x="61.5"
        y="84"
        width="2"
        height="5"
        rx="1"
        className="fill-foreground/60"
        animate={{ rotate: [-12, 12, -12] }}
        style={{ transformOrigin: "62.5px 84px" }}
        transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.g>
  </svg>
);

const CloudScene = ({ fog, snow }: { fog?: boolean; snow?: boolean }) => (
  <svg viewBox="0 0 120 90" className="h-full w-full" role="img" aria-hidden="true">
    <motion.g
      className={fog ? "fill-slate-300/60" : "fill-slate-400/70"}
      animate={{ x: [-4, 4, -4] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
    >
      <ellipse cx="50" cy="36" rx="20" ry="12" />
      <ellipse cx="72" cy="38" rx="15" ry="10" />
    </motion.g>
    {snow &&
      Array.from({ length: 6 }).map((_, i) => (
        <motion.circle
          key={i}
          cx={32 + i * 11}
          cy="52"
          r="2"
          className="fill-sky-200"
          animate={{ y: [0, 32], opacity: [0, 1, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3, ease: "linear" }}
        />
      ))}
  </svg>
);

const CityWeather = ({ city, state, lang }: { city: string; state?: string; lang: Lang }) => {
  const [w, setW] = useState<Weather | null>(null);

  useEffect(() => {
    let active = true;
    setW(null);
    const load = async () => {
      try {
        const g = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&countryCode=IN&language=en&format=json`,
        ).then((r) => r.json());
        const indian = (g?.results ?? []).filter(
          (r: { country_code?: string }) => r.country_code === "IN",
        );
        if (indian.length === 0) return;
        const norm = (v?: string) => (v ?? "").toLowerCase().replace(/[^a-z]/g, "");
        const inState = state
          ? indian.filter(
              (r: { admin1?: string }) =>
                norm(r.admin1) === norm(state) ||
                norm(state).includes(norm(r.admin1)) ||
                norm(r.admin1).includes(norm(state)),
            )
          : [];
        const pool = inState.length ? inState : indian;
        const exact = pool.filter(
          (r: { name?: string }) => norm(r.name) === norm(city),
        );
        const place = (exact.length ? exact : pool).sort(
          (a: { population?: number }, b: { population?: number }) =>
            (b.population ?? 0) - (a.population ?? 0),
        )[0];
        if (!place) return;
        const f = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&timezone=Asia%2FKolkata`,
        ).then((r) => r.json());
        const c = f?.current;
        if (!active || !c) return;
        setW({
          temp: Math.round(c.temperature_2m),
          feels: Math.round(c.apparent_temperature),
          code: c.weather_code,
          wind: Math.round(c.wind_speed_10m),
          kind: kindOf(c.weather_code),
           isDay: c.is_day === 1,
        });
      } catch (e) {
        console.error("weather failed", e);
      }
    };
    load();
    const timer = setInterval(load, 10 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [city, state]);


  if (!w) return null;

  const wet = w.kind === "rain" || w.kind === "storm";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-5 inline-flex items-center gap-4 rounded-2xl border border-border bg-card/80 px-4 py-3 backdrop-blur"
    >
      <div className="h-16 w-20 shrink-0">
        {w.kind === "sun" && w.isDay ? (
          <SunScene temp={w.temp} />
        ) : w.kind === "sun" ? (
          <MoonScene />
        ) : wet ? (
          <RainScene storm={w.kind === "storm"} />
        ) : (
          <CloudScene fog={w.kind === "fog"} snow={w.kind === "snow"} />
        )}
      </div>
      <div className="leading-tight">
        <p className="font-heading text-2xl font-bold">{w.temp}°C</p>
        <p className="text-xs text-muted-foreground">
          {w.kind === "sun" && !w.isDay
            ? lang === "hi" ? "साफ़ रात" : "Clear night"
            : label[w.kind][lang]} ·{" "}
          {lang === "hi" ? `महसूस ${w.feels}°` : `feels ${w.feels}°`} ·{" "}
          {lang === "hi" ? `हवा ${w.wind} किमी/घं` : `wind ${w.wind} km/h`}
        </p>
        <p className="text-[11px] text-muted-foreground/80">
          {lang === "hi" ? `${city} का लाइव मौसम` : `Live weather in ${city}`}
        </p>
      </div>
    </motion.div>
  );
};

export default CityWeather;
