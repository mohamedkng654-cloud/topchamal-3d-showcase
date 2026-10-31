-- The base schema seeded a phone number despite no store destination being supplied.
-- Clear only that known placeholder, preserve any other owner-configured value, and keep future rows blank.
alter table public.store_settings
  alter column whatsapp set default '';

update public.store_settings
set whatsapp = ''
where id = true
  and whatsapp = '0716313000';
