-- Replace expired Lovable-only asset URLs with versioned local product images.
-- The predicate makes the migration safe to re-run and preserves secondary images.
WITH image_fixes(slug, image_url) AS (
  VALUES
    (
      'nespresso-c40-eu2',
      '/products/nespresso-c40-eu2.webp'
    ),
    (
      'machine-a-cafe-nespresso-citiz-and-milk-occasion',
      '/products/machine-a-cafe-nespresso-citiz-and-milk-occasion.webp'
    ),
    (
      'machine-expresso-a-capsule-nespresso-pixie-c60-us-ti-ne-au-maroc',
      '/products/machine-expresso-a-capsule-nespresso-pixie-c60-us-ti-ne-au-maroc.webp'
    )
)
UPDATE public.products AS product
SET image_urls =
  ARRAY[image_fixes.image_url]::text[] ||
  CASE
    WHEN COALESCE(array_length(product.image_urls, 1), 0) > 1
      THEN product.image_urls[2:array_length(product.image_urls, 1)]
    ELSE ARRAY[]::text[]
  END
FROM image_fixes
WHERE product.slug = image_fixes.slug
  AND product.image_urls[1] LIKE '/__l5e/assets-v1/%';
