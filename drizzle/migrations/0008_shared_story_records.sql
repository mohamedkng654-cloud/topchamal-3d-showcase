CREATE TABLE public.store_stories (
 id text PRIMARY KEY,
 content jsonb NOT NULL DEFAULT '{}'::jsonb,
 is_active boolean NOT NULL DEFAULT true,
 expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_stories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_stories TO authenticated;
GRANT ALL ON public.store_stories TO service_role;
ALTER TABLE public.store_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads live stories" ON public.store_stories FOR SELECT TO anon, authenticated USING (is_active AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY "admins manage stories" ON public.store_stories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.store_stories FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX store_stories_live_idx ON public.store_stories (is_active, expires_at);
INSERT INTO public.store_stories (id,content,is_active,expires_at,created_at)
SELECT story->>'id', story, coalesce((story->>'is_active')::boolean,true), nullif(story->>'expires_at','')::timestamptz, coalesce(nullif(story->>'created_at','')::timestamptz,now())
FROM public.site_content, LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(value)='array' THEN value ELSE '[]'::jsonb END) story
WHERE key='stories' AND story->>'id' IS NOT NULL
ON CONFLICT (id) DO NOTHING;
COMMENT ON TABLE public.store_stories IS 'Shared story records; independent writes prevent concurrent administrators overwriting other stories.';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='store_stories') THEN
 ALTER PUBLICATION supabase_realtime ADD TABLE public.store_stories;
 END IF;
END $$;