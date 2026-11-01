create or replace function public.blocked_email_reason(check_email text)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(c.block_reason, '')
  from public.customers c
  join auth.users u on u.id = c.id
  where c.blocked and lower(u.email) = lower(trim(check_email))
  limit 1;
$$;

revoke all on function public.blocked_email_reason(text) from public;
grant execute on function public.blocked_email_reason(text) to anon, authenticated;
