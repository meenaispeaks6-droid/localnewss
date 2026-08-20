DELETE FROM public.news_articles
WHERE length(btrim(coalesce(title_en,''))) < 15
   OR array_length(regexp_split_to_array(btrim(coalesce(title_en,'')), '\s+'), 1) < 3
   OR title_en ~* '(e-?paper|ई-?पेपर|latest news|breaking news|top stories|web stories|photo gallery)';