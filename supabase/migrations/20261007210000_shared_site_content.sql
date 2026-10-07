-- Shared editable content for the public storefront.
-- Admin writes are protected by the same public.is_admin() function used by the catalog.
create table if not exists public.site_content (
  key text primary key check (key in ('site_settings', 'stories')),
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_site_content_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_site_content_updated_at on public.site_content;
create trigger touch_site_content_updated_at
before update on public.site_content
for each row execute function public.touch_site_content_updated_at();

alter table public.site_content enable row level security;

drop policy if exists "admins manage site content" on public.site_content;
create policy "admins manage site content"
on public.site_content for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "public reads site content" on public.site_content;
create policy "public reads site content"
on public.site_content for select
using (true);

insert into public.site_content (key, value)
values ('stories', '[]'::jsonb)
on conflict (key) do nothing;

create index if not exists site_content_updated_at_idx
on public.site_content (updated_at desc);

-- Visitors receive changes without a full page refresh when Realtime is enabled.
do $$
declare
  table_name text;
begin
  for table_name in select unnest(array['site_content', 'products', 'categories']) loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
exception when undefined_object then
  -- Self-hosted/local projects may not have Supabase Realtime installed.
  null;
end $$;
