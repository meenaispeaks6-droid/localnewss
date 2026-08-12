// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.
import { writeFileSync } from "fs";
import { resolve } from "path";
import { indiaCities } from "../src/data/indiaCities";

const BASE_URL = "https://localnews.meenai.in";

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const entries: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/en", changefreq: "daily", priority: "0.9" },
];

const states = [...new Set(indiaCities.map((c) => c.state))].sort();
for (const state of states) {
  entries.push({ path: `/state/${slugify(state)}`, changefreq: "weekly", priority: "0.7" });
  entries.push({ path: `/state/${slugify(state)}/en`, changefreq: "weekly", priority: "0.6" });
}

for (const city of indiaCities) {
  entries.push({ path: `/news/${slugify(city.name)}`, changefreq: "hourly", priority: "0.8" });
  entries.push({ path: `/news/${slugify(city.name)}/en`, changefreq: "hourly", priority: "0.7" });
}

const xml = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
  ...entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  ),
  `</urlset>`,
].join("\n");

writeFileSync(resolve("public/sitemap.xml"), xml);
console.log(`sitemap.xml written (${entries.length} entries)`);
