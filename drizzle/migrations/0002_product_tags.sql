alter table public.products
  add column if not exists tags text[] not null default '{}';

create index if not exists products_created_at_idx on public.products (created_at desc);
create index if not exists products_status_idx on public.products (status);
