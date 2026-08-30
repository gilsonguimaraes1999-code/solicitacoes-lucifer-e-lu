\set ON_ERROR_STOP on

begin read only;

do $$
begin
  if (
    select count(*) <> 3
      or count(*) filter (where system_key = 'pending') <> 1
      or count(*) filter (where system_key = 'in_progress') <> 1
      or count(*) filter (where system_key = 'completed') <> 1
    from public.board_columns
    where kind = 'system'
  ) then
    raise exception 'preflight failed: expected exactly the three system columns';
  end if;

  if exists (select 1 from public.requests where column_id is null) then
    raise exception 'preflight failed: requests.column_id backfill is incomplete';
  end if;

  if exists (
    select 1
    from public.requests
    where position > 9007199254740991
       or position in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  ) then
    raise exception 'preflight failed: request position is not finite and JavaScript-safe';
  end if;

  if exists (
    select 1
    from public.requests request
    join public.board_columns target_column on target_column.id = request.column_id
    where (target_column.kind = 'system' and request.status is distinct from target_column.system_key)
       or (target_column.kind = 'assignee' and request.status is not null)
  ) then
    raise exception 'preflight failed: legacy status disagrees with the canonical column';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_permissions'
      and column_name = 'can_manage_columns'
      and data_type = 'boolean'
  ) then
    raise exception 'preflight failed: can_manage_columns is missing';
  end if;

  if to_regprocedure('public.create_request(text,text,text,uuid,text,numeric)') is null
    or to_regprocedure('public.move_request(uuid,uuid,numeric)') is null
    or to_regprocedure('public.move_request(uuid,text,numeric)') is null then
    raise exception 'preflight failed: additive RPC set is incomplete';
  end if;

  if not has_table_privilege('authenticated', 'public.requests', 'insert') then
    raise exception 'preflight failed: legacy direct INSERT was locked down too early';
  end if;
end
$$;

select
  (select count(*) from public.board_columns where kind = 'system') as system_columns,
  (select count(*) from public.requests where column_id is null) as requests_without_column,
  has_table_privilege('authenticated', 'public.requests', 'insert') as legacy_insert_available,
  to_regprocedure('public.move_request(uuid,text,numeric)') is not null as legacy_move_available,
  to_regprocedure('public.create_request(text,text,text,uuid,text,numeric)') is not null as create_rpc_available;

rollback;
