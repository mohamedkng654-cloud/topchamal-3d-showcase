CREATE TABLE public.product_publication_dates (
 product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
 published_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_publication_dates TO authenticated;
GRANT ALL ON public.product_publication_dates TO service_role;
ALTER TABLE public.product_publication_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read publication dates" ON public.product_publication_dates FOR SELECT TO authenticated USING (public.is_admin());
CREATE FUNCTION public.record_product_publication_date() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.status = 'published' THEN
   INSERT INTO public.product_publication_dates (product_id, published_at) VALUES (NEW.id, now()) ON CONFLICT (product_id) DO NOTHING;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_product_publication_date() FROM PUBLIC;
CREATE TRIGGER record_product_publication_date AFTER INSERT OR UPDATE OF status ON public.products FOR EACH ROW EXECUTE FUNCTION public.record_product_publication_date();
COMMENT ON TABLE public.product_publication_dates IS 'Admin-only first publication timestamps; historical dates predating tracking are unknown.';