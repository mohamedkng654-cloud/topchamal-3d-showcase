-- Complete the documented Supabase migration path for features previously defined only in Drizzle,
-- keep admin-only AI settings private, and preserve inventory safety for public checkout.

-- Shared story records used by the storefront and /admin/stories.
create table if not exists public.store_stories (
  id text primary key,
  content jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.store_stories to anon;
grant select, insert, update, delete on public.store_stories to authenticated;
grant all on public.store_stories to service_role;
alter table public.store_stories enable row level security;

drop policy if exists "public reads live stories" on public.store_stories;
create policy "public reads live stories" on public.store_stories
  for select to anon, authenticated
  using (is_active and (expires_at is null or expires_at > now()));

drop policy if exists "admins manage stories" on public.store_stories;
create policy "admins manage stories" on public.store_stories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists touch_updated_at on public.store_stories;
create trigger touch_updated_at before update on public.store_stories
  for each row execute function public.touch_updated_at();

create index if not exists store_stories_live_idx
  on public.store_stories (is_active, expires_at);

-- Preserve existing story content when moving from the old single-JSON-array storage.
insert into public.store_stories (id, content, is_active, expires_at, created_at)
select
  story->>'id',
  story,
  coalesce((story->>'is_active')::boolean, true),
  nullif(story->>'expires_at', '')::timestamptz,
  coalesce(nullif(story->>'created_at', '')::timestamptz, now())
from public.site_content,
  lateral jsonb_array_elements(
    case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end
  ) as stories(story)
where key = 'stories'
  and story->>'id' is not null
on conflict (id) do nothing;

comment on table public.store_stories is
  'Shared story records; independent writes prevent concurrent administrators overwriting other stories.';

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'store_stories'
     ) then
    execute 'alter publication supabase_realtime add table public.store_stories';
  end if;
exception when undefined_object then
  -- Local or self-hosted deployments may not include Supabase Realtime.
  null;
end $$;

-- Admin-only first-publication timestamps consumed by /admin/products.
create table if not exists public.product_publication_dates (
  product_id uuid primary key references public.products(id) on delete cascade,
  published_at timestamptz not null default now()
);

revoke all on table public.product_publication_dates from public, anon;
grant select on public.product_publication_dates to authenticated;
grant all on public.product_publication_dates to service_role;
alter table public.product_publication_dates enable row level security;

drop policy if exists "admins read publication dates" on public.product_publication_dates;
create policy "admins read publication dates" on public.product_publication_dates
  for select to authenticated
  using (public.is_admin());

create or replace function public.record_product_publication_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' then
    insert into public.product_publication_dates (product_id, published_at)
    values (new.id, now())
    on conflict (product_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.record_product_publication_date() from public;
drop trigger if exists record_product_publication_date on public.products;
create trigger record_product_publication_date
  after insert or update of status on public.products
  for each row execute function public.record_product_publication_date();

comment on table public.product_publication_dates is
  'Admin-only first publication timestamps; historical dates predating tracking are unknown.';

-- admin_ai_settings is read by authenticated administrators only. It can contain provider
-- configuration, so never expose that row through the anonymous storefront read policy.
alter table public.site_content
  drop constraint if exists site_content_key_check;
alter table public.site_content
  add constraint site_content_key_check
  check (key in ('site_settings', 'stories', 'admin_ai_settings'));

drop policy if exists "public reads site content" on public.site_content;
create policy "public reads site content" on public.site_content
  for select to anon, authenticated
  using (key in ('site_settings', 'stories'));

-- Keep the public checkout RPC's stock check and decrement in one row-locked transaction.
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
  if jsonb_typeof(payload->'lines') <> 'array'
     or jsonb_array_length(payload->'lines') = 0 then
    raise exception 'Order must contain at least one item';
  end if;
  if jsonb_array_length(payload->'lines') > 50 then
    raise exception 'Too many order items';
  end if;

  insert into public.customers (name, phone, email, address, city)
  values (customer_name, customer_phone, customer_email, customer_address, customer_city)
  returning id into customer_id;

  insert into public.orders (customer_id, customer_name, phone, email, address, city, payment_method)
  values (
    customer_id,
    customer_name,
    customer_phone,
    customer_email,
    customer_address,
    customer_city,
    'cash_on_delivery'
  )
  returning id, order_number into order_id, order_number;

  for item in select value from jsonb_array_elements(payload->'lines') as lines(value) loop
    if jsonb_typeof(item) <> 'object' or coalesce(trim(item->>'slug'), '') = '' then
      raise exception 'Invalid order item';
    end if;
    if item->>'quantity' is null or item->>'quantity' !~ '^[0-9]+$' then
      raise exception 'Invalid item quantity';
    end if;
    begin
      item_quantity := (item->>'quantity')::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Invalid item quantity';
    end;
    if item_quantity < 1 or item_quantity > 99 then
      raise exception 'Invalid item quantity';
    end if;

    -- The row lock serializes concurrent checkouts for this product.
    select * into product_row
    from public.products
    where slug = trim(item->>'slug')
      and status = 'published'
      and (not is_quick_listing or (expires_at is not null and expires_at > now()))
    for update;
    if not found then
      raise exception 'Product is unavailable';
    end if;
    if product_row.stock < item_quantity then
      raise exception 'Product is out of stock';
    end if;

    item_total := coalesce(product_row.discount_price_mad, product_row.price_mad) * item_quantity;
    subtotal := subtotal + item_total;
    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price_mad,
      total_mad
    )
    values (
      order_id,
      product_row.id,
      product_row.name,
      item_quantity,
      coalesce(product_row.discount_price_mad, product_row.price_mad),
      item_total
    );
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

notify pgrst, 'reload schema';
