alter table public.orders add column if not exists code_released boolean not null default false;

create or replace function public.guard_code_released()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_trusted() then return new; end if;
  if tg_op = 'INSERT' then
    new.code_released := false;
  else
    new.code_released := old.code_released;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_code_released on public.orders;
create trigger guard_code_released
before insert or update on public.orders
for each row execute function public.guard_code_released();

create or replace function public.admin_approve_order(order_id text, code_message text, code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  found_order public.orders;
  now_ms bigint := public.now_ms();
  released boolean;
begin
  if not public.is_admin() then
    raise exception 'Only admins can approve orders';
  end if;
  if code is null or code !~ '^[A-Za-z0-9]{6}$' then
    return 'no_code';
  end if;

  select * into found_order from public.orders o where o.id = admin_approve_order.order_id for update;
  if not found then
    return 'missing';
  end if;
  if found_order.status not in ('pending_review', 'rejected') then
    return 'already_done';
  end if;

  released := exists (select 1 from public.orders o where lower(o.code) = lower(admin_approve_order.code) and o.code_released);
  if exists (select 1 from public.orders o where lower(o.code) = lower(admin_approve_order.code) and not o.code_released)
    or (not released and exists (
      select 1 from public.messages m
      where m.sender = 'admin' and m.kind <> 'deleted' and m.text ~* ('\m' || admin_approve_order.code || '\M')
    )) then
    return 'code_used';
  end if;

  update public.orders o
  set status = 'completed', reviewed_at = now_ms, code = admin_approve_order.code, code_unused = false
  where o.id = found_order.id;

  insert into public.messages (id, customer_id, sender, kind, text, order_id, created_at)
  values (substr(md5(random()::text || clock_timestamp()::text), 1, 14), found_order.customer_id, 'admin', 'code', code_message, found_order.id, now_ms);

  update public.conversations c
  set active_order_id = case when c.active_order_id = found_order.id then null else c.active_order_id end,
      stage = 'code_delivered',
      unread_by_admin = 0,
      last_message_at = now_ms
  where c.customer_id = found_order.customer_id;

  update public.notifications n set read = true where n.customer_id = found_order.customer_id;
  return 'approved';
end;
$$;
