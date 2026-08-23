create or replace function public.purge_old_news()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.news_articles
  where published_at < now() - interval '24 hours';
$$;

select cron.unschedule('purge-old-news') where exists (select 1 from cron.job where jobname = 'purge-old-news');

select cron.schedule('purge-old-news', '0 * * * *', $$select public.purge_old_news();$$);

delete from public.news_articles where published_at < now() - interval '24 hours';