create or replace function public.claim_initial_admin()
returns public.admins
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.admins;
  current_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if exists (select 1 from public.admins) then
    raise exception 'An admin account already exists';
  end if;

  current_email := coalesce(auth.jwt() ->> 'email', '');
  if current_email = '' then
    raise exception 'Authenticated email is required';
  end if;

  insert into public.admins (user_id, email, display_name, role, is_active)
  values (auth.uid(), current_email, current_email, 'owner', true)
  returning * into claimed;

  return claimed;
end;
$$;

revoke all on function public.claim_initial_admin() from public;
grant execute on function public.claim_initial_admin() to authenticated;
