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
