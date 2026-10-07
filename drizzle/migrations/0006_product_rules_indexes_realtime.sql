ALTER TABLE public.products ADD CONSTRAINT products_price_nonneg CHECK (price_mad >= 0);
ALTER TABLE public.products ADD CONSTRAINT products_discount_valid CHECK (discount_price_mad IS NULL OR (discount_price_mad >= 0 AND discount_price_mad <= price_mad));
ALTER TABLE public.products ADD CONSTRAINT products_stock_nonneg CHECK (stock >= 0);
ALTER TABLE public.products ADD CONSTRAINT products_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE public.products ADD CONSTRAINT products_name_required CHECK (length(trim(name)) > 0);
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_key_idx ON public.products (slug);
CREATE INDEX IF NOT EXISTS products_status_idx ON public.products (status);
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products (category_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS order_items_product_idx ON public.order_items (product_id);

CREATE OR REPLACE FUNCTION public.prevent_ordered_product_delete() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.order_items WHERE product_id = OLD.id) THEN
    RAISE EXCEPTION 'PRODUCT_HAS_ORDERS' USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END; $$;
CREATE TRIGGER products_prevent_ordered_delete BEFORE DELETE ON public.products FOR EACH ROW EXECUTE FUNCTION public.prevent_ordered_product_delete();

ALTER PUBLICATION supabase_realtime ADD TABLE public.products;