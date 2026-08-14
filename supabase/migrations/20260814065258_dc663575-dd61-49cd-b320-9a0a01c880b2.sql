CREATE TABLE public.firecrawl_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  api_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  last_used_at timestamptz,
  last_error text,
  exhausted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.firecrawl_keys FROM anon, authenticated;
GRANT ALL ON public.firecrawl_keys TO service_role;

ALTER TABLE public.firecrawl_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firecrawl_keys FORCE ROW LEVEL SECURITY;

CREATE POLICY "No public access to firecrawl keys"
ON public.firecrawl_keys
AS PERMISSIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE TRIGGER update_firecrawl_keys_updated_at
BEFORE UPDATE ON public.firecrawl_keys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();