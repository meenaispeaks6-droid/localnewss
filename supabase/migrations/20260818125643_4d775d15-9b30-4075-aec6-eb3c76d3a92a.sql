CREATE TABLE public.ai_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  api_key text NOT NULL,
  base_url text NOT NULL DEFAULT 'https://generativelanguage.googleapis.com/v1beta/openai',
  model text NOT NULL DEFAULT 'gemini-2.0-flash',
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  last_used_at timestamptz,
  last_error text,
  exhausted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ai_keys TO service_role;
ALTER TABLE public.ai_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client access to ai_keys" ON public.ai_keys FOR ALL USING (false) WITH CHECK (false);

INSERT INTO public.ai_keys (label, api_key, priority) VALUES
  ('Gemini key 1', 'AQ.Ab8RN6LwjW7PioHWb-j6M2KKD6GwApQR6UjreYwKv4BwatHLYQ', 10),
  ('Gemini key 2', 'AQ.Ab8RN6K_y4QeFhdQ01l8SyGISY2tum9Zl3cMSKjVWBlXGaMYIQ', 20);