alter table public.customers add column if not exists block_device boolean not null default false;

create or replace function public.guard_block_device()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_trusted() then
    new.block_device := case when tg_op = 'UPDATE' then old.block_device else false end;
  end if;
  if not new.blocked then new.block_device := false; end if;
  return new;
end;
$$;

drop trigger if exists guard_block_device on public.customers;
create trigger guard_block_device
before insert or update on public.customers
for each row execute function public.guard_block_device();

create or replace function public.blocked_email_device(check_email text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(bool_or(c.block_device), false)
  from public.customers c
  join auth.users u on u.id = c.id
  where c.blocked and lower(u.email) = lower(trim(check_email));
$$;

revoke all on function public.blocked_email_device(text) from public;
grant execute on function public.blocked_email_device(text) to anon, authenticated;
