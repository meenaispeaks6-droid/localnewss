ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS slug text;

CREATE OR REPLACE FUNCTION public.news_article_slug(_title text, _id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT left(
           nullif(trim(both '-' from regexp_replace(lower(coalesce(_title, '')), '[^a-z0-9]+', '-', 'g')), '')
           , 60)
         || '-' || left(replace(_id::text, '-', ''), 6)
$$;

CREATE OR REPLACE FUNCTION public.set_news_article_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := coalesce(
      public.news_article_slug(NEW.title_en, NEW.id),
      'story-' || left(replace(NEW.id::text, '-', ''), 6)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_news_article_slug ON public.news_articles;
CREATE TRIGGER trg_set_news_article_slug
BEFORE INSERT OR UPDATE ON public.news_articles
FOR EACH ROW EXECUTE FUNCTION public.set_news_article_slug();

UPDATE public.news_articles
SET slug = coalesce(public.news_article_slug(title_en, id), 'story-' || left(replace(id::text, '-', ''), 6))
WHERE slug IS NULL OR slug = '';

CREATE UNIQUE INDEX IF NOT EXISTS news_articles_city_slug_idx ON public.news_articles (city, slug);