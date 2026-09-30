# Supabase admin setup

This project now includes a placeholder-based Supabase foundation for the TopChamal admin area.

## Files added

- `.env.example` — safe configuration template; contains no secrets.
- `src/lib/supabase.ts` — browser Supabase client using `VITE_*` variables only.
- `src/lib/admin-auth.ts` — email/password login plus an `admins` table authorization check.
- `src/routes/admin.tsx` — protected admin layout and sidebar.
- `src/routes/admin/login.tsx` — `/admin/login` page.
- `src/routes/admin/index.tsx` — live KPI dashboard queries.
- `src/styles/admin.css` — responsive admin styling.
- `supabase/migrations/20261001000000_admin_dashboard.sql` — database schema and RLS policies.

## Configure locally

1. Copy `.env.example` to `.env.local`.
2. Replace `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with values from Supabase Project Settings → API.
3. Never put `SUPABASE_SERVICE_ROLE_KEY` in a `VITE_*` variable or browser code. Keep it server-side only if server functions are added later.
4. Run the SQL migration in the Supabase SQL Editor.
5. In Supabase Authentication → Users, create the first admin user. Choose the email and password yourself; the password is intentionally not stored in this repository.
6. Copy that user UUID into `public.admins`:

```sql
insert into public.admins (user_id, email, display_name, role)
values ('AUTH_USER_UUID', 'ADMIN_EMAIL', 'Store Owner', 'owner');
```

7. Start the app and open `/admin/login`.

## Security notes

- Customer-facing code never contains an admin password.
- Admin route access is checked against Supabase Auth and an active row in `public.admins`.
- CRUD tables use row-level security. Public reads are limited to published products, active categories, enabled homepage sections, and store settings.
- The service-role key is not required by the browser and must never be committed.
