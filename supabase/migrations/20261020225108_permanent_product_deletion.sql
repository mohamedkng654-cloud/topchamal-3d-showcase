-- Preserve order-line snapshots while allowing permanent catalog deletion.
-- The order_items.product_id foreign key uses ON DELETE SET NULL, so order history remains readable.
create table if not exists public.deleted_product_slugs (
  slug text primary key,
  deleted_at timestamptz not null default now()
);
alter table public.deleted_product_slugs enable row level security;

-- Older installs blocked hard deletion for products referenced by orders; remove that guard.
drop trigger if exists products_prevent_ordered_delete on public.products;
drop function if exists public.prevent_ordered_product_delete();

create or replace function public.remember_deleted_product_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.deleted_product_slugs (slug)
  values (old.slug)
  on conflict (slug) do nothing;
  return old;
end;
$$;

drop trigger if exists products_remember_deleted_slug on public.products;
create trigger products_remember_deleted_slug
before delete on public.products
for each row execute function public.remember_deleted_product_slug();

-- Prevent old seed scripts or other inserts from silently resurrecting a deleted slug.
create or replace function public.block_deleted_product_slug_reinsert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.deleted_product_slugs d
    where d.slug = new.slug
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists products_block_deleted_slug_reinsert on public.products;
create trigger products_block_deleted_slug_reinsert
before insert on public.products
for each row execute function public.block_deleted_product_slug_reinsert();
