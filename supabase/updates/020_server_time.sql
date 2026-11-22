create or replace function public.set_server_time()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  latest bigint;
begin
  if tg_table_name = 'messages' then
    select max(created_at) into latest from public.messages where customer_id = new.customer_id;
    new.created_at := greatest(now_ms, coalesce(latest, 0) + 1);
  else
    new.created_at := now_ms;
  end if;
  return new;
end;
$$;
drop trigger if exists set_server_time on public.messages;
create trigger set_server_time
before insert on public.messages
for each row execute function public.set_server_time();

drop trigger if exists set_server_time on public.tickets;
create trigger set_server_time
before insert on public.tickets
for each row execute function public.set_server_time();

drop trigger if exists set_server_time on public.notifications;
create trigger set_server_time
before insert on public.notifications
for each row execute function public.set_server_time();
