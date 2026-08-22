import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCitiesTool from "./tools/list-cities";
import getCityNewsTool from "./tools/get-city-news";
import searchNewsTool from "./tools/search-news";
import getAiNewsTool from "./tools/get-ai-news";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "local-news",
  title: "Local News",
  version: "0.1.0",
  instructions:
    "Tools for Local News, a bilingual (English/Hindi) Indian city news site. Use `list_cities` to find covered cities, `get_city_news` for a city's latest stories, `search_news` to search headlines across cities, and `get_ai_news` for worldwide AI and technology updates.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCitiesTool, getCityNewsTool, searchNewsTool, getAiNewsTool],
});
