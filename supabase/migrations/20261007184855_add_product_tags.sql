-- Keep the shared products schema aligned with the admin catalog editor.
alter table public.products
  add column if not exists tags text[] not null default '{}';
