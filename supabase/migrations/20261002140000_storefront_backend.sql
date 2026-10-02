-- TopChamal public storefront backend: catalog seed and validated cash-on-delivery orders.
-- Apply after 20261001000000_admin_dashboard.sql.

insert into public.categories (name, slug, sort_order)
values
  ('آلات القهوة', 'cofee-machine', 1),
  ('الخلاطات', 'blender', 2),
  ('العجانات', 'robot-cuiseur', 3),
  ('طنجرات الضغط', 'cocotte', 4),
  ('عصارات', 'presse', 5),
  ('قلايات هوائية', 'air-fryer', 6),
  ('مكانس كهربائية', 'aspirateur', 7),
  ('مراوح', 'ventilateur', 8),
  ('آلات البانيني', 'sandwich-makter-panini', 9),
  ('ترموسات', 'thermos', 10),
  ('صفائح الطبخ', 'plaque-de-cuisson', 11),
  ('محضرات الطعام', 'food-processors', 12)
on conflict (slug) do update set name = excluded.name;

create or replace function public.create_public_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  product_row public.products%rowtype;
  customer_id uuid;
  order_id uuid;
  order_number text;
  subtotal numeric(12,2) := 0;
  item_quantity integer;
  item_total numeric(12,2);
  customer_name text := trim(coalesce(payload->>'name', ''));
  customer_phone text := regexp_replace(trim(coalesce(payload->>'phone', '')), '[^0-9+]', '', 'g');
  customer_city text := trim(coalesce(payload->>'city', ''));
begin
  if customer_name = '' or length(customer_name) > 120 then
    raise exception 'Invalid customer name';
  end if;
  if customer_phone !~ '^(0[567][0-9]{8}|\+?212[567][0-9]{8})$' then
    raise exception 'Invalid Moroccan phone number';
  end if;
  if customer_city = '' or length(customer_city) > 100 then
    raise exception 'Invalid city';
  end if;
  if jsonb_typeof(payload->'lines') <> 'array' or jsonb_array_length(payload->'lines') = 0 then
    raise exception 'Order must contain at least one item';
  end if;
  if jsonb_array_length(payload->'lines') > 50 then
    raise exception 'Too many order items';
  end if;

  insert into public.customers (name, phone, email, address, city)
  values (customer_name, customer_phone, nullif(trim(payload->>'email'), ''), nullif(trim(payload->>'address'), ''), customer_city)
  returning id into customer_id;

  insert into public.orders (customer_id, customer_name, phone, email, address, city, payment_method)
  values (customer_id, customer_name, customer_phone, nullif(trim(payload->>'email'), ''), nullif(trim(payload->>'address'), ''), customer_city, 'cash_on_delivery')
  returning id, order_number into order_id, order_number;

  for item in select * from jsonb_array_elements(payload->'lines') loop
    item_quantity := greatest(0, least(99, (item->>'quantity')::integer));
    if item_quantity < 1 then raise exception 'Invalid item quantity'; end if;
    select * into product_row from public.products
    where slug = trim(item->>'slug') and status = 'published';
    if not found then raise exception 'Product is unavailable'; end if;
    if product_row.stock < item_quantity then raise exception 'Product is out of stock'; end if;
    item_total := coalesce(product_row.discount_price_mad, product_row.price_mad) * item_quantity;
    subtotal := subtotal + item_total;
    insert into public.order_items (order_id, product_id, product_name, quantity, unit_price_mad, total_mad)
    values (order_id, product_row.id, product_row.name, item_quantity, coalesce(product_row.discount_price_mad, product_row.price_mad), item_total);
  end loop;

  update public.orders
  set subtotal_mad = subtotal, total_mad = subtotal
  where id = order_id;

  return jsonb_build_object('order_number', order_number, 'total_mad', subtotal);
end;
$$;

revoke all on function public.create_public_order(jsonb) from public;
grant execute on function public.create_public_order(jsonb) to anon, authenticated;


-- Seed the current storefront catalog. Re-running this migration is safe by slug.
insert into public.products (name, slug, description, price_mad, discount_price_mad, category_id, image_urls, stock, status, is_featured)
values
  ('NESPRESSO C40 EU2', 'nespresso-c40-eu2', 'منتج من تشكيلة Topchamal.', 999.00, null, (select id from public.categories where slug = 'cofee-machine'), array['/__l5e/assets-v1/ea24dab1-b8a7-43a0-aeff-14b1ec22c65b/nespresso-c40-eu2.webp'], 100, 'published', false),
  ('Machine expresso à capsule Nespresso Pixie C60-US-TI-NE au Maroc', 'machine-expresso-a-capsule-nespresso-pixie-c60-us-ti-ne-au-maroc', 'منتج من تشكيلة Topchamal.', 1099.00, null, (select id from public.categories where slug = 'cofee-machine'), array['/__l5e/assets-v1/42c7b42d-44cc-4e28-adbc-feaffc6dd1c1/machine-expresso-a-capsule-nespresso-pixie-c60-us-ti-ne-au-maroc.webp'], 100, 'published', false),
  ('Machine à Café Nespresso CITIZ & MILK Occasion', 'machine-a-cafe-nespresso-citiz-and-milk-occasion', 'منتج من تشكيلة Topchamal.', 1399.00, null, (select id from public.categories where slug = 'cofee-machine'), array['/__l5e/assets-v1/798fe44f-d944-4d31-b2a8-d965e3a79a7b/machine-a-cafe-nespresso-citiz-and-milk-occasion.webp'], 100, 'published', false),
  ('CAFETIERE NESPRESSO INISSIA D40 NOIR', 'cafetiere-nespresso-inissia-d40-noir', 'منتج من تشكيلة Topchamal.', 999.00, null, (select id from public.categories where slug = 'cofee-machine'), array['/__l5e/assets-v1/d97ab023-3f3d-43a4-88b2-0658f3164579/cafetiere-nespresso-inissia-d40-noir.webp'], 100, 'published', false),
  ('Cafetière et expresso Nespresso Vertuo de Breville Aeroccino, noir', 'cafetiere-et-expresso-nespresso-vertuo-de-breville-aeroccino-noir', 'منتج من تشكيلة Topchamal.', 1399.00, null, (select id from public.categories where slug = 'cofee-machine'), array['/__l5e/assets-v1/a49d7810-dd58-457e-abab-36a61484f3e7/cafetiere-et-expresso-nespresso-vertuo-de-breville-aeroccino-noir.webp'], 100, 'published', false),
  ('Blender Moulinex Avec Moulin à épices', 'blender-moulinex-avec-moulin-a-epices-1', 'منتج من تشكيلة Topchamal.', 999.00, null, (select id from public.categories where slug = 'blender'), array['/__l5e/assets-v1/d40e57f8-4fdb-4802-897a-343bf7fea600/blender-moulinex-avec-moulin-a-epices-1.webp'], 100, 'published', false),
  ('BLENDER MOULINEX', 'blender-moulinex', 'منتج من تشكيلة Topchamal.', 999.00, null, (select id from public.categories where slug = 'blender'), array['/__l5e/assets-v1/4194d0dd-0c39-495f-8114-fa07e4829649/blender-moulinex.webp'], 100, 'published', false),
  ('MOULINEX BLENDER LM42R810+BOL GRATUIT', 'moulinex-blender-lm42r810bol-gratuit', 'منتج من تشكيلة Topchamal.', 849.00, null, (select id from public.categories where slug = 'blender'), array['/__l5e/assets-v1/537ad188-755f-451d-93ba-24390150e593/moulinex-blender-lm42r810bol-gratuit.webp'], 100, 'published', false),
  ('Blender Moulinex Avec Moulin à épices', 'blender-moulinex-avec-moulin-a-epices', 'منتج من تشكيلة Topchamal.', 549.00, null, (select id from public.categories where slug = 'blender'), array['/__l5e/assets-v1/887a45cf-ceb1-417f-9873-1b06ded14187/blender-moulinex-avec-moulin-a-epices.webp'], 100, 'published', false),
  ('PETRIN KENWOOD 6.7L 1200W + BLENDER PLASTIC SILVER', 'petrin-kenwood-67l-1200w-blender-plastic-silver', 'منتج من تشكيلة Topchamal.', 4299.00, null, (select id from public.categories where slug = 'robot-cuiseur'), array['/__l5e/assets-v1/87f22e82-e19d-4f1a-8c44-72db5fe4ac66/petrin-kenwood-67l-1200w-blender-plastic-silver.webp'], 100, 'published', false),
  ('PETRIN KMIX KENWOOD BOL 1000 W - INOX/ROUGE', 'petrin-kmix-kenwood-bol-1000-w-inoxrouge', 'منتج من تشكيلة Topchamal.', 4199.00, null, (select id from public.categories where slug = 'robot-cuiseur'), array['/__l5e/assets-v1/e812eae8-18bb-46a5-b0d6-a4c7a2487267/petrin-kmix-kenwood-bol-1000-w-inoxrouge.webp'], 100, 'published', false),
  ('Robot Petrin KVC3100 - KENWOOD', 'robot-petrin-kvc3100-kenwood', 'منتج من تشكيلة Topchamal.', 3699.00, null, (select id from public.categories where slug = 'robot-cuiseur'), array['/__l5e/assets-v1/479086a8-8425-4900-9ad3-a971fe3fb139/robot-petrin-kvc3100-kenwood.webp'], 100, 'published', false),
  ('COCOTTE INOX  8L', 'cocotte-inox-8l', 'منتج من تشكيلة Topchamal.', 899.00, 1159.00, (select id from public.categories where slug = 'cocotte'), array['/__l5e/assets-v1/22f4d29b-5497-4ed6-a1b6-fa4d8500ebf8/cocotte-inox-8l.webp'], 100, 'published', false),
  ('COCOTTE INOX 6L', 'cocotte-inox-6l', 'منتج من تشكيلة Topchamal.', 799.00, 999.00, (select id from public.categories where slug = 'cocotte'), array['/__l5e/assets-v1/230f12d1-caab-4428-88fe-2b45e5c96695/cocotte-inox-6l.webp'], 100, 'published', false),
  ('COCOTTE INOX 4L', 'cocotte-inox-4l', 'منتج من تشكيلة Topchamal.', 699.00, 789.99, (select id from public.categories where slug = 'cocotte'), array['/__l5e/assets-v1/9d66799e-b425-4928-9e7c-b6785e65687d/cocotte-inox-4l.webp'], 100, 'published', false),
  ('COCOTTE INIX ELITE 3L', 'cocotte-inix-elite-3l', 'منتج من تشكيلة Topchamal.', 580.00, 650.00, (select id from public.categories where slug = 'cocotte'), array['/__l5e/assets-v1/9319232c-9782-413e-b154-1de453c153ba/cocotte-inix-elite-3l.webp'], 100, 'published', false),
  ('elite aspirateur vc 5006h', 'elite-aspirateur-vc-5006h', 'منتج من تشكيلة Topchamal.', 580.00, 800.00, (select id from public.categories where slug = 'aspirateur'), array['/__l5e/assets-v1/6e5274e7-8151-4834-b6a3-566f0b0d67b7/elite-aspirateur-vc-5006h.webp'], 100, 'published', false),
  ('SANDWICH MAKTER PANINI ELITE', 'sandwich-makter-panini-elite', 'منتج من تشكيلة Topchamal.', 299.00, 369.00, (select id from public.categories where slug = 'sandwich-makter-panini'), array['/__l5e/assets-v1/3771441d-9f1c-42ad-9700-f44d6b1a2696/sandwich-makter-panini-elite.webp'], 100, 'published', false),
  ('PRESSE ORANGES ELITE GTM8115', 'presse-oranges-elite-gtm8115', 'منتج من تشكيلة Topchamal.', 169.00, 189.00, (select id from public.categories where slug = 'presse'), array['/__l5e/assets-v1/ec29d4e4-8efd-4792-a69d-758254d5dfbd/presse-oranges-elite-gtm8115.webp'], 100, 'published', false),
  ('PRESSE ORANGES ELITE 8113 40W', 'presse-oranges-elite-8113-40w', 'منتج من تشكيلة Topchamal.', 119.00, 189.00, (select id from public.categories where slug = 'presse'), array['/__l5e/assets-v1/6fb4af1c-f560-431c-9e1f-059002a24ec2/presse-oranges-elite-8113-40w.webp'], 100, 'published', false),
  ('PRESSE ORANGES ELITE 200WATT REF VB6016 6C FILTREEN INOX', 'presse-oranges-elite-200watt-ref-vb6016-6c-filtreen-inox', 'منتج من تشكيلة Topchamal.', 249.00, 350.00, (select id from public.categories where slug = 'presse'), array['/__l5e/assets-v1/2d9aa9f7-1ec3-4870-bd7f-fc424606ab63/presse-oranges-elite-200watt-ref-vb6016-6c-filtreen-inox.webp'], 100, 'published', false),
  ('PRESSE ORANGES ELITE JE 632F', 'presse-oranges-elite-je-632f', 'منتج من تشكيلة Topchamal.', 249.00, 319.00, (select id from public.categories where slug = 'presse'), array['/__l5e/assets-v1/7a2c9e5e-cbf6-4e20-bdd3-903d8eb2b024/presse-oranges-elite-je-632f.webp'], 100, 'published', false),
  ('PRESSE ORANGES ELITE JE 623C 12C', 'presse-oranges-elite-je-623c-12c', 'منتج من تشكيلة Topchamal.', 129.00, 198.98, (select id from public.categories where slug = 'presse'), array['/__l5e/assets-v1/fe2754c7-6db3-412f-922a-8a1d47e652ad/presse-oranges-elite-je-623c-12c.webp'], 100, 'published', false)
on conflict (slug) do update set name = excluded.name, description = excluded.description, price_mad = excluded.price_mad, discount_price_mad = excluded.discount_price_mad, category_id = excluded.category_id, image_urls = excluded.image_urls, status = excluded.status;
