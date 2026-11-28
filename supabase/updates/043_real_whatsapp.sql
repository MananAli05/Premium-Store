create or replace function public.reject_fake_whatsapp()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  rest text := substr(new.whatsapp, 3);
begin
  if new.whatsapp is null or new.whatsapp is not distinct from (case when tg_op = 'UPDATE' then old.whatsapp end) then
    return new;
  end if;
  if rest ~ '(\d)\1{3}' or (select count(distinct digit) from regexp_split_to_table(rest, '') as digit) <= 3 then
    raise exception 'Please enter your real WhatsApp number.';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_fake_whatsapp on public.customers;
create trigger reject_fake_whatsapp
before insert or update of whatsapp on public.customers
for each row execute function public.reject_fake_whatsapp();
