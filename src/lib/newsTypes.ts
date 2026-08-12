export type Lang = "hi" | "en";

export interface NewsArticle {
  id: string;
  city: string;
  title_en: string;
  title_hi: string | null;
  summary_en: string | null;
  summary_hi: string | null;
  source_name: string | null;
  source_url: string;
  image_url: string | null;
  category: string;
  published_at: string;
}

export const categoryHi: Record<string, string> = {
  Politics: "राजनीति",
  Crime: "क्राइम",
  Business: "बिज़नेस",
  Sports: "खेल",
  Education: "शिक्षा",
  Weather: "मौसम",
  Culture: "संस्कृति",
  Community: "समाज",
  Health: "स्वास्थ्य",
  general: "सामान्य",
};
