import { supabase } from "@/integrations/supabase/client";
import type { Lang } from "@/lib/newsTypes";

export const VAPID_PUBLIC_KEY =
  "BF51J4rK8D1r7tVG5FnujVPaAIN_tG7XuwHha_i94MCgzbjl8HnN5lRLRTSpEaK33P6Txt6ss0_n2UoWa9BMdJc";

const SW_PATH = "/push-sw.js";

export const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

const getRegistration = () => navigator.serviceWorker.register(SW_PATH);

export const getExistingSubscription = async () => {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (!reg) return null;
  return reg.pushManager.getSubscription();
};

export interface SubscribeArgs {
  city: string;
  state?: string;
  lang: Lang;
}

export const subscribeToPush = async ({ city, state, lang }: SubscribeArgs) => {
  if (!pushSupported()) throw new Error("unsupported");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("denied");

  const reg = await getRegistration();
  await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  const raw = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
  const { error } = await supabase.functions.invoke("push-subscribe", {
    body: {
      action: "subscribe",
      endpoint: raw.endpoint,
      keys: raw.keys,
      city,
      state,
      lang,
    },
  });
  if (error) throw error;
  return true;
};

export const unsubscribeFromPush = async () => {
  const sub = await getExistingSubscription();
  if (!sub) return false;
  await supabase.functions.invoke("push-subscribe", {
    body: { action: "unsubscribe", endpoint: sub.endpoint },
  });
  await sub.unsubscribe();
  return true;
};
