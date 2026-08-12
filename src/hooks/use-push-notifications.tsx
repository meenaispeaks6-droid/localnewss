import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getExistingSubscription,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import type { Lang } from "@/lib/newsTypes";

interface Args {
  city?: string;
  state?: string;
  lang: Lang;
}

export const usePushNotifications = ({ city, state, lang }: Args) => {
  const hi = lang === "hi";
  const supported = pushSupported();
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    let active = true;
    getExistingSubscription()
      .then((sub) => active && setSubscribed(Boolean(sub)))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [supported]);

  const enable = useCallback(async () => {
    if (!city) return;
    setBusy(true);
    try {
      await subscribeToPush({ city, state, lang });
      setSubscribed(true);
      toast.success(
        hi
          ? `${city} की ख़बरों की सूचनाएँ चालू हो गईं`
          : `Notifications on for ${city} news`,
      );
    } catch (e) {
      const reason = e instanceof Error ? e.message : "";
      toast.error(
        reason === "denied"
          ? hi
            ? "आपने सूचनाओं की अनुमति नहीं दी"
            : "Notification permission was blocked"
          : reason === "unsupported"
            ? hi
              ? "इस ब्राउज़र में सूचनाएँ समर्थित नहीं हैं"
              : "This browser doesn't support notifications"
            : hi
              ? "सूचनाएँ चालू नहीं हो सकीं"
              : "Could not enable notifications",
      );
    } finally {
      setBusy(false);
    }
  }, [city, state, lang, hi]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
      toast.success(hi ? "सूचनाएँ बंद कर दी गईं" : "Notifications turned off");
    } catch {
      toast.error(hi ? "सूचनाएँ बंद नहीं हो सकीं" : "Could not turn off notifications");
    } finally {
      setBusy(false);
    }
  }, [hi]);

  return { supported, subscribed, busy, enable, disable };
};
