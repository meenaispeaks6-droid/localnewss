ALTER TABLE public.ai_keys
  ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cooldown_until timestamptz;

ALTER TABLE public.firecrawl_keys
  ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cooldown_until timestamptz;

CREATE INDEX IF NOT EXISTS ai_keys_cooldown_idx ON public.ai_keys (cooldown_until);
CREATE INDEX IF NOT EXISTS firecrawl_keys_cooldown_idx ON public.firecrawl_keys (cooldown_until);