import { Link } from "react-router-dom";
import type { Lang } from "@/lib/newsTypes";
import { homePath, indiaStates, statePath } from "@/lib/geo";
import AdSlot from "@/components/AdSlot";
import { AD_SLOTS } from "@/lib/ads";

const SiteFooter = ({ lang }: { lang: Lang }) => (
  <>
    <AdSlot slot={AD_SLOTS.footer} lang={lang} />
    <footer className="border-t border-border bg-secondary/50">
      <div className="container py-8">

      <nav aria-label={lang === "hi" ? "राज्य" : "States"}>
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          {lang === "hi" ? "राज्य और केंद्र शासित प्रदेश" : "States and Union Territories"}
        </h2>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {indiaStates.map((s) => (
            <li key={s.slug}>
              <Link to={statePath(s.slug, lang)} className="hover:text-primary">
                {lang === "hi" ? s.stateHi : s.state}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p className="mt-8 text-center text-xs text-muted-foreground">
        <Link to={homePath(lang)} className="hover:text-primary">
          © 2026 Local News
        </Link>{" "}
        · {lang === "hi" ? "हर शहर, हर ख़बर" : "Every city, every story"}
      </p>
    </div>
  </footer>
);

export default SiteFooter;
