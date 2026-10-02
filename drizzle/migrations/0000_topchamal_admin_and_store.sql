create type public.admin_role as enum ('owner', 'admin', 'editor');
create type public.product_status as enum ('draft', 'published', 'archived');
create type public.order_status as enum ('new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled');

create table public.admins (
  user_id uuid primary key,
  email text not null,
  display_name text,
  role public.admin_role not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique, description text, image_url text,
  is_active boolean not null default true, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique, description text,
  price_mad numeric(12,2) not null check (price_mad >= 0),
  discount_price_mad numeric(12,2),
  category_id uuid references public.categories(id) on delete set null,
  image_urls text[] not null default '{}',
  stock integer not null default 0 check (stock >= 0),
  sku text unique, brand text,
  status public.product_status not null default 'draft',
  is_featured boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null, phone text not null, email text, address text, city text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('TC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null, phone text not null, email text, address text, city text,
  subtotal_mad numeric(12,2) not null default 0, delivery_fee_mad numeric(12,2) not null default 0,
  total_mad numeric(12,2) not null default 0,
  payment_method text not null default 'cash_on_delivery',
  status public.order_status not null default 'new',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null, quantity integer not null check (quantity > 0),
  unit_price_mad numeric(12,2) not null, total_mad numeric(12,2) not null
);

grant select on public.admins to authenticated;
grant select, insert, update, delete on public.categories, public.products, public.customers, public.orders, public.order_items to authenticated;
grant select on public.categories, public.products to anon;
grant all on public.admins, public.categories, public.products, public.customers, public.orders, public.order_items to service_role;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admins where user_id = auth.uid() and is_active = true); $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

create trigger touch_updated_at before update on public.admins for each row execute function public.touch_updated_at();
create trigger touch_updated_at before update on public.categories for each row execute function public.touch_updated_at();
create trigger touch_updated_at before update on public.products for each row execute function public.touch_updated_at();
create trigger touch_updated_at before update on public.customers for each row execute function public.touch_updated_at();
create trigger touch_updated_at before update on public.orders for each row execute function public.touch_updated_at();

alter table public.admins enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "admins read own profile" on public.admins for select to authenticated using (user_id = auth.uid());
create policy "admins manage categories" on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public reads active categories" on public.categories for select using (is_active = true);
create policy "admins manage products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public reads published products" on public.products for select using (status = 'published');
create policy "admins manage customers" on public.customers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage orders" on public.orders for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage order items" on public.order_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.categories (name, slug, sort_order) values
  ('آلات القهوة','cofee-machine',1),('الخلاطات','blender',2),('العجانات','robot-cuiseur',3),('طنجرات الضغط','cocotte',4),
  ('عصارات','presse',5),('مكانس كهربائية','aspirateur',7),('مراوح','ventilateur',8),('آلات البانيني','sandwich-makter-panini',9),
  ('ترموسات','thermos',10),('صفائح الطبخ','plaque-de-cuisson',11),('محضرات الطعام','food-processors',12);

insert into public.products (name, slug, price_mad, discount_price_mad, category_id, stock, status) values
  ('NESPRESSO C40 EU2','nespresso-c40-eu2',999,null,(select id from public.categories where slug='cofee-machine'),100,'published'),
  ('CAFETIERE NESPRESSO INISSIA D40 NOIR','cafetiere-nespresso-inissia-d40-noir',999,null,(select id from public.categories where slug='cofee-machine'),100,'published'),
  ('BLENDER MOULINEX','blender-moulinex',999,null,(select id from public.categories where slug='blender'),100,'published'),
  ('Robot Petrin KVC3100 - KENWOOD','robot-petrin-kvc3100-kenwood',3699,null,(select id from public.categories where slug='robot-cuiseur'),100,'published'),
  ('COCOTTE INOX 8L','cocotte-inox-8l',899,1159,(select id from public.categories where slug='cocotte'),100,'published'),
  ('COCOTTE INOX 6L','cocotte-inox-6l',799,999,(select id from public.categories where slug='cocotte'),100,'published'),
  ('elite aspirateur vc 5006h','elite-aspirateur-vc-5006h',580,800,(select id from public.categories where slug='aspirateur'),100,'published'),
  ('SANDWICH MAKTER PANINI ELITE','sandwich-makter-panini-elite',299,369,(select id from public.categories where slug='sandwich-makter-panini'),100,'published'),
  ('PRESSE ORANGES ELITE GTM8115','presse-oranges-elite-gtm8115',169,189,(select id from public.categories where slug='presse'),100,'published');