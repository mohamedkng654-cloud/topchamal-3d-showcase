-- TopChamal admin foundation for Supabase.
-- Apply this migration in Supabase SQL Editor, then create the first admin user
-- in Authentication > Users and insert its UUID into public.admins.

create extension if not exists "pgcrypto";

create type public.admin_role as enum ('owner', 'admin', 'editor');
create type public.product_status as enum ('draft', 'published', 'archived');
create type public.order_status as enum ('new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled');
create type public.discount_type as enum ('percentage', 'fixed');

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role public.admin_role not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price_mad numeric(12,2) not null check (price_mad >= 0),
  discount_price_mad numeric(12,2) check (discount_price_mad is null or discount_price_mad >= 0),
  category_id uuid references public.categories(id) on delete set null,
  image_urls text[] not null default '{}',
  stock integer not null default 0 check (stock >= 0),
  sku text unique,
  brand text,
  status public.product_status not null default 'draft',
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  address text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('TC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  phone text not null,
  email text,
  address text,
  city text,
  subtotal_mad numeric(12,2) not null default 0 check (subtotal_mad >= 0),
  delivery_fee_mad numeric(12,2) not null default 0 check (delivery_fee_mad >= 0),
  total_mad numeric(12,2) not null default 0 check (total_mad >= 0),
  payment_method text not null default 'cash_on_delivery',
  status public.order_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price_mad numeric(12,2) not null check (unit_price_mad >= 0),
  total_mad numeric(12,2) not null check (total_mad >= 0)
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type public.discount_type not null,
  discount_value numeric(12,2) not null check (discount_value >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  minimum_order_mad numeric(12,2) not null default 0,
  usage_limit integer,
  usage_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  body text,
  entity_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.store_settings (
  id boolean primary key default true check (id),
  store_name text not null default 'TopChamal',
  store_description text,
  logo_url text,
  favicon_url text,
  email text not null default 'topchamalfnidaq@gmail.com',
  whatsapp text not null default '0716313000',
  phone text,
  address text,
  city text,
  business_hours jsonb not null default '{}'::jsonb,
  instagram_url text,
  facebook_url text,
  tiktok_url text,
  youtube_url text,
  other_social_links jsonb not null default '[]'::jsonb,
  delivery_fee_mad numeric(12,2) not null default 0,
  free_delivery_threshold_mad numeric(12,2),
  delivery_areas text[] not null default '{}',
  delivery_information text,
  footer_text text,
  copyright_text text,
  updated_at timestamptz not null default now()
);

create table public.homepage_sections (
  id uuid primary key default gen_random_uuid(),
  section_key text not null unique,
  title text,
  body text,
  image_url text,
  product_ids uuid[] not null default '{}',
  category_ids uuid[] not null default '{}',
  is_enabled boolean not null default true,
  sort_order integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id) values (true) on conflict (id) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where user_id = auth.uid() and is_active = true
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['admins','categories','products','customers','orders','coupons','store_settings','homepage_sections'] loop
    execute format('drop trigger if exists touch_updated_at on public.%I', table_name);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', table_name);
  end loop;
end $$;

alter table public.admins enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.coupons enable row level security;
alter table public.notifications enable row level security;
alter table public.store_settings enable row level security;
alter table public.homepage_sections enable row level security;

create policy "admins can read own admin profile" on public.admins for select using (user_id = auth.uid());
create policy "admins manage categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy "public reads active categories" on public.categories for select using (is_active = true);
create policy "admins manage products" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "public reads published products" on public.products for select using (status = 'published');
create policy "admins manage customers" on public.customers for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage orders" on public.orders for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage order items" on public.order_items for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage coupons" on public.coupons for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage notifications" on public.notifications for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage settings" on public.store_settings for all using (public.is_admin()) with check (public.is_admin());
create policy "public reads store settings" on public.store_settings for select using (true);
create policy "admins manage homepage" on public.homepage_sections for all using (public.is_admin()) with check (public.is_admin());
create policy "public reads enabled homepage" on public.homepage_sections for select using (is_enabled = true);

create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_status_idx on public.products(status);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists notifications_unread_idx on public.notifications(is_read, created_at desc);
