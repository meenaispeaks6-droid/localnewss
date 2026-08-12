import { Bell, BellOff, Loader2 } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import type { Lang } from "@/lib/newsTypes";

interface Props {
  city?: string;
  state?: string;
  lang: Lang;
  variant?: "solid" | "outline";
}

const NotifyButton = ({ city, state, lang, variant = "outline" }: Props) => {
  const hi = lang === "hi";
  const { supported, subscribed, busy, enable, disable } = usePushNotifications({
    city,
    state,
    lang,
  });

  if (!supported || !city) return null;

  const base =
    "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const skin = subscribed
    ? "border border-border bg-card text-muted-foreground hover:bg-secondary"
    : variant === "solid"
      ? "bg-primary text-primary-foreground hover:opacity-90"
      : "border border-primary/40 bg-card text-primary hover:bg-primary/10";

  return (
    <button
      type="button"
      onClick={subscribed ? disable : enable}
      disabled={busy}
      className={`${base} ${skin}`}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : subscribed ? (
        <BellOff className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Bell className="h-4 w-4" aria-hidden="true" />
      )}
      {subscribed
        ? hi
          ? "सूचनाएँ बंद करें"
          : "Turn off alerts"
        : hi
          ? "ख़बरों की सूचना पाएँ"
          : "Notify me"}
    </button>
  );
};

export default NotifyButton;
