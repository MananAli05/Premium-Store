create or replace function public.save_changes(ops jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  op jsonb;
  target text;
  key_column text;
  columns text;
  assignments text;
begin
  for op in select value from jsonb_array_elements(ops) loop
    target := op->>'table';
    if target not in ('customers', 'conversations', 'orders', 'messages', 'tickets', 'notifications') then
      raise exception 'Unknown table %', target;
    end if;
    key_column := case when target = 'conversations' then 'customer_id' else 'id' end;

    if op->>'kind' = 'insert' then
      select string_agg(distinct format('%I', name), ', ') into columns
      from jsonb_array_elements(op->'rows') as item(value), jsonb_object_keys(item.value) as name;

      begin
        execute format(
          'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_recordset(null::public.%1$I, $1)',
          target, columns
        ) using op->'rows';
      exception
        when unique_violation then
          null;
        when raise_exception then
          if sqlerrm <> 'This account is blocked' then
            raise;
          end if;
      end;

    elsif op->>'kind' = 'update' then
      select string_agg(format('%1$I = changed.%1$I', name), ', ') into assignments
      from jsonb_object_keys(op->'row') as name
      where name <> key_column;

      if assignments is not null then
        execute format(
          'update public.%1$I as saved set %2$s from jsonb_populate_record(null::public.%1$I, $1) as changed where saved.%3$I = changed.%3$I',
          target, assignments, key_column
        ) using op->'row';
      end if;

    elsif op->>'kind' = 'delete' then
      execute format('delete from public.%I where %I::text = any($1)', target, key_column)
      using array(select jsonb_array_elements_text(op->'ids'));

    else
      raise exception 'Unknown change %', op->>'kind';
    end if;
  end loop;
end;
$$;

revoke all on function public.save_changes(jsonb) from public, anon;
grant execute on function public.save_changes(jsonb) to authenticated;
