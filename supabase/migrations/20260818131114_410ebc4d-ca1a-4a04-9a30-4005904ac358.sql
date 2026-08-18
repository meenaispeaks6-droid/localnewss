CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('key-health-check') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'key-health-check'
);

SELECT cron.schedule(
  'key-health-check',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fwummhpxwwelpoqtjpiw.supabase.co/functions/v1/key-health',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);