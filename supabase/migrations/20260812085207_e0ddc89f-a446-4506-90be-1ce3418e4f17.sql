ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
DROP POLICY IF EXISTS "No public access to push subscriptions" ON public.push_subscriptions;
CREATE POLICY "No public access to push subscriptions"
ON public.push_subscriptions
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);