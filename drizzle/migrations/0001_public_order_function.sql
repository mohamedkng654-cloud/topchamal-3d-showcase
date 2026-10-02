create or replace function public.create_public_order(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  item jsonb; product_row public.products%rowtype; v_customer uuid; v_order uuid; v_number text;
  subtotal numeric(12,2) := 0; qty integer; line_total numeric(12,2);
  c_name text := trim(coalesce(payload->>'name',''));
  c_phone text := regexp_replace(trim(coalesce(payload->>'phone','')),'[^0-9+]','','g');
  c_city text := trim(coalesce(payload->>'city',''));
begin
  if c_name = '' or length(c_name) > 120 then raise exception 'Invalid customer name'; end if;
  if c_phone !~ '^(0[567][0-9]{8}|\+?212[567][0-9]{8})$' then raise exception 'Invalid Moroccan phone number'; end if;
  if c_city = '' or length(c_city) > 100 then raise exception 'Invalid city'; end if;
  if jsonb_typeof(payload->'lines') <> 'array' or jsonb_array_length(payload->'lines') = 0 or jsonb_array_length(payload->'lines') > 50 then raise exception 'Invalid order items'; end if;
  insert into public.customers (name, phone, city) values (c_name, c_phone, c_city) returning id into v_customer;
  insert into public.orders (customer_id, customer_name, phone, city) values (v_customer, c_name, c_phone, c_city) returning id, order_number into v_order, v_number;
  for item in select * from jsonb_array_elements(payload->'lines') loop
    qty := greatest(0, least(99, (item->>'quantity')::integer));
    if qty < 1 then raise exception 'Invalid item quantity'; end if;
    select * into product_row from public.products where slug = trim(item->>'slug') and status = 'published';
    if not found then raise exception 'Product is unavailable'; end if;
    line_total := coalesce(product_row.discount_price_mad, product_row.price_mad) * qty;
    subtotal := subtotal + line_total;
    insert into public.order_items (order_id, product_id, product_name, quantity, unit_price_mad, total_mad)
    values (v_order, product_row.id, product_row.name, qty, coalesce(product_row.discount_price_mad, product_row.price_mad), line_total);
  end loop;
  update public.orders set subtotal_mad = subtotal, total_mad = subtotal where id = v_order;
  return jsonb_build_object('order_number', v_number, 'total_mad', subtotal);
end; $$;
revoke all on function public.create_public_order(jsonb) from public;
grant execute on function public.create_public_order(jsonb) to anon, authenticated;