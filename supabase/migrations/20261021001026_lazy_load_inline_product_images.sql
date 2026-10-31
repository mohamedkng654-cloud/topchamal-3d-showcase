-- Keep the catalog response lean while allowing its two legacy inline images to load
-- only when their cards approach the viewport.
drop function if exists public.get_storefront_products();

create function public.get_storefront_products()
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  price_mad numeric,
  discount_price_mad numeric,
  image_url text,
  has_inline_image boolean,
  stock integer,
  is_quick_listing boolean,
  expires_at timestamptz,
  category_slug text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.slug,
    p.description,
    p.price_mad,
    p.discount_price_mad,
    case
      when p.image_urls[1] is null or p.image_urls[1] like 'data:%' then null
      else p.image_urls[1]
    end as image_url,
    coalesce(p.image_urls[1] like 'data:image/%', false) as has_inline_image,
    p.stock,
    p.is_quick_listing,
    p.expires_at,
    c.slug as category_slug
  from public.products as p
  left join public.categories as c on c.id = p.category_id
  where p.status = 'published'
    and (not p.is_quick_listing or p.expires_at > now())
  order by p.created_at desc, p.id asc;
$$;

create or replace function public.get_storefront_product_image(product_slug text)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select p.image_urls[1]
  from public.products as p
  where p.slug = product_slug
    and p.status = 'published'
    and (not p.is_quick_listing or p.expires_at > now())
    and p.image_urls[1] like 'data:image/%'
  limit 1;
$$;

revoke all on function public.get_storefront_products() from public;
revoke all on function public.get_storefront_product_image(text) from public;
grant execute on function public.get_storefront_products() to anon, authenticated;
grant execute on function public.get_storefront_product_image(text) to anon, authenticated;
notify pgrst, 'reload schema';
