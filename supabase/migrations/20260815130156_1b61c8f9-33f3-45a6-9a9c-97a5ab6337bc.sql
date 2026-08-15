create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('send-news-digest-every-10-min')
where exists (select 1 from cron.job where jobname = 'send-news-digest-every-10-min');

select cron.schedule(
  'send-news-digest-every-10-min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://fwummhpxwwelpoqtjpiw.supabase.co/functions/v1/send-news-digest',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_8HHueR2T7KsUeJ_ww1nxuA_X9doRnAZ"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);