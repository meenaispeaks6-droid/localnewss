ALTER TABLE public.ai_keys
  ADD COLUMN IF NOT EXISTS last_status integer,
  ADD COLUMN IF NOT EXISTS last_latency_ms integer;

ALTER TABLE public.firecrawl_keys
  ADD COLUMN IF NOT EXISTS last_status integer,
  ADD COLUMN IF NOT EXISTS last_latency_ms integer;