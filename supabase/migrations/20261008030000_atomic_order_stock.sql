-- Make public checkout inventory-safe and prevent overselling under concurrent orders.
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
  customer_email text := nullif(trim(coalesce(payload->>'email', '')), '');
  customer_address text := nullif(trim(coalesce(payload->>'address', '')), '');
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
  if customer_email is not null and length(customer_email) > 254 then
    raise exception 'Invalid email';
  end if;
  if customer_address is not null and length(customer_address) > 300 then
    raise exception 'Invalid address';
  end if;
  if jsonb_typeof(payload->'lines') <> 'array' or jsonb_array_length(payload->'lines') = 0 then
    raise exception 'Order must contain at least one item';
  end if;
  if jsonb_array_length(payload->'lines') > 50 then
    raise exception 'Too many order items';
  end if;

  insert into public.customers (name, phone, email, address, city)
  values (customer_name, customer_phone, customer_email, customer_address, customer_city)
  returning id into customer_id;

  insert into public.orders (customer_id, customer_name, phone, email, address, city, payment_method)
  values (customer_id, customer_name, customer_phone, customer_email, customer_address, customer_city, 'cash_on_delivery')
  returning id, order_number into order_id, order_number;

  for item in select * from jsonb_array_elements(payload->'lines') loop
    if jsonb_typeof(item) <> 'object' or coalesce(item->>'slug', '') = '' then
      raise exception 'Invalid order item';
    end if;
    begin
      item_quantity := (item->>'quantity')::integer;
    exception when invalid_text_representation then
      raise exception 'Invalid item quantity';
    end;
    if item_quantity < 1 or item_quantity > 99 then
      raise exception 'Invalid item quantity';
    end if;

    -- Lock the row so concurrent checkouts cannot sell the same stock.
    select * into product_row
    from public.products
    where slug = trim(item->>'slug') and status = 'published'
    for update;
    if not found then
      raise exception 'Product is unavailable';
    end if;
    if product_row.stock < item_quantity then
      raise exception 'Product is out of stock';
    end if;

    item_total := coalesce(product_row.discount_price_mad, product_row.price_mad) * item_quantity;
    subtotal := subtotal + item_total;
    insert into public.order_items (order_id, product_id, product_name, quantity, unit_price_mad, total_mad)
    values (order_id, product_row.id, product_row.name, item_quantity, coalesce(product_row.discount_price_mad, product_row.price_mad), item_total);
    update public.products
    set stock = stock - item_quantity
    where id = product_row.id;
  end loop;

  update public.orders
  set subtotal_mad = subtotal, total_mad = subtotal
  where id = order_id;

  return jsonb_build_object('order_number', order_number, 'total_mad', subtotal);
end;
$$;

revoke all on function public.create_public_order(jsonb) from public;
grant execute on function public.create_public_order(jsonb) to anon, authenticated;
