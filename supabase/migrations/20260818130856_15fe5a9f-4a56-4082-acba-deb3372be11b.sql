ALTER TABLE public.ai_keys
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz;

ALTER TABLE public.firecrawl_keys
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz;