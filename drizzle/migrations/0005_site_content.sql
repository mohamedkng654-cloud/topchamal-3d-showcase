CREATE TABLE public.site_content (key text PRIMARY KEY, value jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.site_content TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_content TO authenticated;
GRANT ALL ON public.site_content TO service_role;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads site content" ON public.site_content FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage site content" ON public.site_content FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());