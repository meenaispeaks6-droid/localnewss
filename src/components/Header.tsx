import { Languages, Moon, Sun, Newspaper } from "lucide-react";
import CityPicker from "@/components/CityPicker";
import type { Lang } from "@/lib/newsTypes";
import { useTheme } from "@/hooks/use-theme";

interface HeaderProps {
  city?: string;
  onCityChange: (name: string) => void;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
}

const Header = ({ city, onCityChange, lang, onLangChange }: HeaderProps) => {
  const { theme, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-2 sm:gap-3">
        <a
          href={lang === "en" ? "/en" : "/"}
          className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <Newspaper className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="font-heading text-base font-bold tracking-tight sm:text-xl">
            <span className="text-primary">{lang === "hi" ? "लोकल" : "Local"}</span>{" "}
            <span className="hidden sm:inline">{lang === "hi" ? "न्यूज़" : "News"}</span>
          </span>
        </a>

        <nav aria-label={lang === "hi" ? "सेटिंग्स" : "Preferences"}>
          <ul className="flex items-center gap-2">
            <li>
              <CityPicker city={city} onCityChange={onCityChange} lang={lang} />
            </li>
            <li>
              <button
                type="button"
                onClick={() => onLangChange(lang === "hi" ? "en" : "hi")}
                className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium shadow-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={
                  lang === "hi" ? "भाषा बदलें: अंग्रेज़ी" : "Switch language to Hindi"
                }
              >
                <Languages className="h-4 w-4 text-primary" aria-hidden="true" />
                <span aria-hidden="true">{lang === "hi" ? "EN" : "हिं"}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={toggle}
                aria-label={
                  theme === "dark"
                    ? lang === "hi"
                      ? "लाइट मोड चालू करें"
                      : "Switch to light mode"
                    : lang === "hi"
                      ? "डार्क मोड चालू करें"
                      : "Switch to dark mode"
                }
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4 text-primary" aria-hidden="true" />
                ) : (
                  <Moon className="h-4 w-4 text-primary" aria-hidden="true" />
                )}
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
