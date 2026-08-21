// Google AdSense configuration.
// Paste your publisher ID (ca-pub-XXXXXXXXXXXXXXXX) below once AdSense approves
// the site. Ads stay hidden everywhere until this is set, so nothing breaks.
export const ADSENSE_CLIENT = "";

// Ad unit slot IDs created in your AdSense dashboard.
export const AD_SLOTS = {
  // Responsive banner shown once per page, just above the footer.
  footer: "",
};

export const adsEnabled = () => ADSENSE_CLIENT.startsWith("ca-pub-");
