import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT, adsEnabled } from "@/lib/ads";
import type { Lang } from "@/lib/newsTypes";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

let scriptLoaded = false;

const loadAdSense = () => {
  if (scriptLoaded || typeof document === "undefined") return;
  scriptLoaded = true;
  const s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(s);
};

/**
 * Non-intrusive AdSense unit. Renders nothing until a publisher ID and slot are
 * configured in src/lib/ads.ts, so the reading experience is never blocked.
 */
const AdSlot = ({
  slot,
  lang = "en",
  className = "",
}: {
  slot: string;
  lang?: Lang;
  className?: string;
}) => {
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!adsEnabled() || !slot) return;
    loadAdSense();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* ad blocker or duplicate push — ignore */
    }
  }, [slot]);

  if (!adsEnabled() || !slot) return null;

  return (
    <aside
      aria-label={lang === "hi" ? "विज्ञापन" : "Advertisement"}
      className={`container my-6 ${className}`}
    >
      <p className="mb-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
        {lang === "hi" ? "विज्ञापन" : "Advertisement"}
      </p>
      <ins
        ref={ref}
        className="adsbygoogle block"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
};

export default AdSlot;
