import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, ChevronDown, Search, Check, ChevronRight, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { indiaCities } from "@/data/indiaCities";
import type { Lang } from "@/lib/newsTypes";

interface Props {
  city?: string;
  onCityChange: (name: string) => void;
  lang: Lang;
}

const CityPicker = ({ city, onCityChange, lang }: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeState, setActiveState] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const current = indiaCities.find((c) => c.name === city);
  const buttonLabel = current
    ? lang === "hi"
      ? current.nameHi
      : current.name
    : lang === "hi"
      ? "शहर चुनें"
      : "Choose city";

  const states = useMemo(() => {
    const map = new Map<string, { state: string; stateHi: string; count: number }>();
    for (const c of indiaCities) {
      const e = map.get(c.state);
      if (e) e.count += 1;
      else map.set(c.state, { state: c.state, stateHi: c.stateHi, count: 1 });
    }
    return [...map.values()].sort((a, b) => a.state.localeCompare(b.state));
  }, []);

  const q = query.trim().toLowerCase();

  const filteredStates = useMemo(
    () =>
      !q
        ? states
        : states.filter(
            (s) => s.state.toLowerCase().includes(q) || s.stateHi.includes(query.trim()),
          ),
    [q, query, states],
  );

  const filteredCities = useMemo(() => {
    const inState = activeState
      ? indiaCities.filter((c) => c.state === activeState)
      : indiaCities;
    if (!q) return inState;
    return inState.filter(
      (c) => c.name.toLowerCase().includes(q) || c.nameHi.includes(query.trim()),
    );
  }, [activeState, q, query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const openPicker = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setQuery("");
      setActiveState(current?.state ?? null);
    }
  };

  const activeStateHi = states.find((s) => s.state === activeState)?.stateHi;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={openPicker}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={lang === "hi" ? "शहर चुनें" : "Choose city"}
        className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-sm font-medium shadow-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="max-w-[7rem] truncate sm:max-w-[10rem]">
          {buttonLabel}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            role="listbox"
            aria-label={lang === "hi" ? "स्थान सूची" : "Location list"}
            className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-xl"
          >
            {activeState && (
              <button
                type="button"
                onClick={() => {
                  setActiveState(null);
                  setQuery("");
                }}
                className="mb-1 flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors hover:bg-secondary"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {lang === "hi" ? activeStateHi ?? activeState : activeState}
                </span>
              </button>
            )}

            <div className="relative mb-2">
              <Search
                aria-hidden="true"
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={
                  activeState
                    ? lang === "hi"
                      ? "शहर खोजें"
                      : "Search city"
                    : lang === "hi"
                      ? "राज्य खोजें"
                      : "Search state"
                }
                placeholder={
                  activeState
                    ? lang === "hi"
                      ? "शहर खोजें..."
                      : "Search city..."
                    : lang === "hi"
                      ? "राज्य खोजें..."
                      : "Search state..."
                }
                className="min-h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="max-h-[min(18rem,50vh)] overflow-y-auto">
              {!activeState &&
                filteredStates.map((s) => (
                  <button
                    key={s.state}
                    type="button"
                    onClick={() => {
                      setActiveState(s.state);
                      setQuery("");
                    }}
                    className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 text-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      current?.state === s.state ? "font-semibold text-primary" : ""
                    }`}
                  >
                    <span className="truncate">{lang === "hi" ? s.stateHi : s.state}</span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      {s.count}
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </button>
                ))}

              {activeState &&
                filteredCities.map((c) => {
                  const selected = city === c.name;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onCityChange(c.name);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        selected ? "bg-primary/10 font-semibold text-primary" : "hover:bg-secondary"
                      }`}
                    >
                      {selected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                      <span className="truncate">{lang === "hi" ? c.nameHi : c.name}</span>
                    </button>
                  );
                })}

              {((activeState && filteredCities.length === 0) ||
                (!activeState && filteredStates.length === 0)) && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {lang === "hi" ? "कुछ नहीं मिला" : "Nothing found"}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CityPicker;
