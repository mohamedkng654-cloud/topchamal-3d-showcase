alter table public.products
  add column if not exists tags text[] not null default '{}';
