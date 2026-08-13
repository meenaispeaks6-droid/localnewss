import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import CityNews from "./pages/CityNews";
import CityCategory from "./pages/CityCategory";
import ArticleNews from "./pages/ArticleNews";
import StateNews from "./pages/StateNews";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home lang="hi" />} />
          <Route path="/en" element={<Home lang="en" />} />
          <Route path="/news/:citySlug" element={<CityNews lang="hi" />} />
          <Route path="/news/:citySlug/en" element={<CityNews lang="en" />} />
          <Route path="/news/:citySlug/category/:category" element={<CityCategory lang="hi" />} />
          <Route path="/news/:citySlug/category/:category/en" element={<CityCategory lang="en" />} />
          <Route path="/news/:citySlug/:articleSlug" element={<ArticleNews lang="hi" />} />
          <Route path="/news/:citySlug/:articleSlug/en" element={<ArticleNews lang="en" />} />
          <Route path="/state/:stateSlug" element={<StateNews lang="hi" />} />
          <Route path="/state/:stateSlug/en" element={<StateNews lang="en" />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
