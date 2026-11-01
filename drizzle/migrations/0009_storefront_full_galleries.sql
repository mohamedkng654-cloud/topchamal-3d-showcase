-- Storefront product picture galleries.
--
-- 1. get_storefront_products() now reports whether the first picture is embedded
--    (has_inline_image) and lists every non-embedded picture (gallery_urls) so the
--    storefront can show the full gallery instead of only the first image.
-- 2. get_storefront_product_images(slug) returns ALL pictures of one published
--    product in order, including embedded (data:) photos, for lazy gallery loading.

-- The function was already rebuilt on the live database with the same SQL;
-- recreate it here so the migration history matches.
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
  gallery_urls text[],
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
    coalesce(
      array(
        select u
        from unnest(p.image_urls) with ordinality as t(u, ord)
        where u is not null and not u like 'data:%'
        order by ord
      ),
      '{}'
    ) as gallery_urls,
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

revoke all on function public.get_storefront_products() from public;
grant execute on function public.get_storefront_products() to anon, authenticated;

create or replace function public.get_storefront_product_images(product_slug text)
returns table (image_url text, sort_order int)
language sql
stable
security invoker
set search_path = public
as $$
  select u, ord
  from public.products as p
  cross join unnest(p.image_urls) with ordinality as t(u, ord)
  where p.slug = product_slug
    and p.status = 'published'
    and (not p.is_quick_listing or p.expires_at > now())
    and u is not null
  order by ord;
$$;

revoke all on function public.get_storefront_product_images(text) from public;
grant execute on function public.get_storefront_product_images(text) to anon, authenticated;

notify pgrst, 'reload schema';