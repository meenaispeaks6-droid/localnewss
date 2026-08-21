update public.news_articles
set title_hi = coalesce(title_hi, title_en),
    summary_hi = coalesce(summary_hi, summary_en)
where title_en ~ '[\u0900-\u097F]';