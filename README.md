# Topchamal — 3D showroom

Arabic-first appliance storefront with procedural 3D models, real product photos, and a local cart. No backend or YouCan runtime is required.

## Run the preview

```bash
bun install
bun run dev
```

## Build for any static host

```bash
bun run build:static
```

Upload the contents of `dist-static/` to any static hosting service. The generated `index.html` includes a readable HTML product catalog for search engines and works with JavaScript disabled. The interactive storefront hydrates in the browser.

## Edit products

Edit `src/data/products.json`. Each product contains `id`, `name`, `category`, `price`, `oldPrice`, `image`, `description`, and `source`. Product and category photographs from the public Topchamal website have been downloaded into independent CDN-hosted assets tracked in `src/assets/catalog/`; the live storefront does not fetch images from YouCan. Display prices were captured on 29 September 2026 and should be confirmed before taking orders.

## Admin AI assistant

The authenticated admin at `/admin/products` can use OpenAI to generate product descriptions, SEO slugs, and tags. Configure `OPENAI_API_KEY` as a **server-only deployment secret**; never use a `VITE_` variable for it. `OPENAI_MODEL` defaults to `gpt-5-mini` and can be changed to another model supported by the configured OpenAI-compatible endpoint. Apply `drizzle/migrations/0002_product_tags.sql` before saving generated tags.

This project is designed to use **Lovable Cloud**, not a separately owned Supabase project. Enable Cloud from **More → Cloud**, then ask Lovable to create/apply the store schema and migrations in the Cloud database. Admin access is explicit: normal customers can use the storefront without admin access, while trusted staff must be created in Cloud Users and added to `public.admins` with the appropriate `role`.

Example owner assignment in the Lovable Cloud SQL editor (replace the email):

```sql
insert into public.admins (user_id, email, display_name, role, is_active)
select id, email, email, 'owner'::public.admin_role, true
from auth.users
where email = 'owner@example.com'
on conflict (user_id) do update set role = 'owner', is_active = true;
```

## WhatsApp destination

The public Topchamal site did not provide a phone number. As shipped, checkout opens a pre-filled WhatsApp share dialog so the customer can select the store contact manually; this does not automatically send an order. Once the store's confirmed WhatsApp number is known, change the URL in `src/routes/index.tsx` from `https://api.whatsapp.com/send?text=` to `https://wa.me/212XXXXXXXXX?text=`. Do not publish a fabricated phone number.

The countdown is a rolling presentation timer, not a verified sale deadline. Confirm promotions and policies with the store before publishing. Footer policy links currently point to source-site paths for verification and may require replacement with local policy pages.

## 3D assets

Appliances are assembled procedurally in `src/components/Showroom3D.tsx`. For optional GLB assets later, place the file in public storage and load it with Drei's `useGLTF` inside a Suspense boundary in the scene.
