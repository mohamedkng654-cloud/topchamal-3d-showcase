-- Seed the current published catalog into the shared database.
-- The slug upserts make this migration safe to apply more than once.
insert into public.categories (name, slug, sort_order, is_active)
values ('عصارات', 'presse', 5, true)
on conflict (slug) do update set name = excluded.name, is_active = true;

insert into public.categories (name, slug, sort_order, is_active)
values ('الخلاطات', 'blender', 2, true)
on conflict (slug) do update set name = excluded.name, is_active = true;

insert into public.products
  (name, slug, description, price_mad, discount_price_mad, category_id, image_urls, stock, status, is_featured)
select
  'Bonana PN-66 Mixeur / Mélangeur 2 en 1',
  'bonana-pn66-blender',
  'Mixeur Bonana PN-66 avec bol en verre de 1,5 L, cinq vitesses, fonction ice crush, lames en acier inoxydable et moulin à café.',
  249, null, c.id, array['/bonana-pn66.jpg'], 10, 'published', false
from public.categories c where c.slug = 'blender'
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  price_mad = excluded.price_mad,
  image_urls = excluded.image_urls,
  status = 'published';

insert into public.products
  (name, slug, description, price_mad, discount_price_mad, category_id, image_urls, stock, status, is_featured)
select
  'Bonana BO-JC2018H Presse-agrumes électrique inox',
  'bonana-bo-jc2018h-juicer',
  'Presse-agrumes électrique Bonana BO-JC2018H en acier inoxydable, avec poignée pratique, filtre inoxydable détachable, bec verseur anti-goutte et extraction maximale pour des jus frais rapidement.',
  279, null, c.id, array['/bonana-bo-jc2018h.jpg'], 10, 'published', false
from public.categories c where c.slug = 'presse'
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  price_mad = excluded.price_mad,
  image_urls = excluded.image_urls,
  status = 'published';
