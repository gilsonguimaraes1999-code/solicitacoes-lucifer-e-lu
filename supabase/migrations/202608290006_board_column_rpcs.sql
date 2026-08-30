create or replace function public.has_column_management_permission()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_owner() or exists (
    select 1
    from public.user_permissions permission
    join public.profiles profile on profile.id = permission.user_id
    where permission.user_id = auth.uid()
      and profile.approval_status = 'approved'
      and permission.can_manage_columns
  )
$$;

create or replace function public.create_board_column(
  new_name text,
  target_assignee uuid,
  new_position numeric
)
returns public.board_columns
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text := trim(new_name);
  max_system_position numeric;
  result public.board_columns;
begin
  if not public.has_column_management_permission() then
    raise exception 'permissão negada' using errcode = '42501';
  end if;

  if normalized_name is null or char_length(normalized_name) not between 2 and 80 then
    raise exception 'nome da coluna inválido' using errcode = '23514';
  end if;

  if new_position is null
    or new_position < 0
    or new_position > 9007199254740991
    or new_position in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric) then
    raise exception 'posição da coluna inválida' using errcode = '23514';
  end if;

  select max(position)
  into max_system_position
  from public.board_columns
  where kind = 'system';

  if max_system_position is null or new_position <= max_system_position then
    raise exception 'posição da coluna deve vir após as colunas de sistema' using errcode = '23514';
  end if;

  if not public.is_approved(target_assignee) then
    raise exception 'responsável precisa estar aprovado' using errcode = '23514';
  end if;

  insert into public.board_columns (
    name,
    kind,
    assignee_id,
    position,
    created_by
  )
  values (
    normalized_name,
    'assignee',
    target_assignee,
    new_position,
    auth.uid()
  )
  returning * into result;

  return result;
end;
$$;

create or replace function public.rename_board_column(
  column_id uuid,
  new_name text
)
returns public.board_columns
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text := trim(new_name);
  target public.board_columns;
  result public.board_columns;
begin
  if not public.has_column_management_permission() then
    raise exception 'permissão negada' using errcode = '42501';
  end if;

  if normalized_name is null or char_length(normalized_name) not between 2 and 80 then
    raise exception 'nome da coluna inválido' using errcode = '23514';
  end if;

  select *
  into target
  from public.board_columns
  where id = column_id
  for update;

  if not found then
    raise exception 'coluna não encontrada' using errcode = 'P0002';
  end if;

  if target.kind = 'system' then
    raise exception 'colunas de sistema são imutáveis' using errcode = '23514';
  end if;

  update public.board_columns
  set name = normalized_name
  where id = column_id
  returning * into result;

  return result;
end;
$$;

create or replace function public.reorder_board_column(
  column_id uuid,
  new_position numeric
)
returns public.board_columns
language plpgsql
security definer
set search_path = public
as $$
declare
  max_system_position numeric;
  target public.board_columns;
  result public.board_columns;
begin
  if not public.has_column_management_permission() then
    raise exception 'permissão negada' using errcode = '42501';
  end if;

  if new_position is null
    or new_position < 0
    or new_position > 9007199254740991
    or new_position in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric) then
    raise exception 'posição da coluna inválida' using errcode = '23514';
  end if;

  select max(position)
  into max_system_position
  from public.board_columns
  where kind = 'system';

  if max_system_position is null or new_position <= max_system_position then
    raise exception 'posição da coluna deve vir após as colunas de sistema' using errcode = '23514';
  end if;

  select *
  into target
  from public.board_columns
  where id = column_id
  for update;

  if not found then
    raise exception 'coluna não encontrada' using errcode = 'P0002';
  end if;

  if target.kind = 'system' then
    raise exception 'colunas de sistema são imutáveis' using errcode = '23514';
  end if;

  update public.board_columns
  set position = new_position
  where id = column_id
  returning * into result;

  return result;
end;
$$;

create or replace function public.delete_board_column(column_id uuid)
returns public.board_columns
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.board_columns;
  result public.board_columns;
begin
  if not public.has_column_management_permission() then
    raise exception 'permissão negada' using errcode = '42501';
  end if;

  select *
  into target
  from public.board_columns
  where id = column_id
  for update;

  if not found then
    raise exception 'coluna não encontrada' using errcode = 'P0002';
  end if;

  if target.kind = 'system' then
    raise exception 'colunas de sistema são imutáveis' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.requests request
    where request.column_id = $1
  ) then
    raise exception 'coluna possui solicitações' using errcode = '23503';
  end if;

  delete from public.board_columns
  where id = column_id
  returning * into result;

  return result;
end;
$$;

create or replace function public.create_request(
  new_title text,
  new_description text,
  new_requester_name text,
  new_assigned_to uuid,
  new_external_url text,
  new_position numeric
)
returns public.requests
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_title text := trim(new_title);
  normalized_description text := nullif(trim(new_description), '');
  normalized_requester_name text := trim(new_requester_name);
  normalized_external_url text := nullif(trim(new_external_url), '');
  target_column_id uuid;
  append_position numeric;
  result public.requests;
begin
  if not public.has_request_permission('create') then
    raise exception 'permissão negada' using errcode = '42501';
  end if;

  if normalized_title is null or char_length(normalized_title) not between 2 and 160 then
    raise exception 'título inválido' using errcode = '23514';
  end if;

  if normalized_description is not null and char_length(normalized_description) > 5000 then
    raise exception 'descrição inválida' using errcode = '23514';
  end if;

  if normalized_requester_name is null or char_length(normalized_requester_name) not between 2 and 160 then
    raise exception 'solicitante inválido' using errcode = '23514';
  end if;

  if not public.is_approved(new_assigned_to) then
    raise exception 'responsável precisa estar aprovado' using errcode = '23514';
  end if;

  if normalized_external_url is not null and (
    char_length(normalized_external_url) > 2048
    or normalized_external_url !~* '^https?://[^[:space:]]+$'
  ) then
    raise exception 'URL inválida' using errcode = '23514';
  end if;

  if new_position is null
    or new_position < 0
    or new_position > 9007199254740991
    or new_position in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric) then
    raise exception 'posição da solicitação inválida' using errcode = '23514';
  end if;

  select id
  into target_column_id
  from public.board_columns
  where assignee_id = new_assigned_to
  for update;

  if target_column_id is null then
    select id
    into target_column_id
    from public.board_columns
    where system_key = 'pending'
    for update;
  end if;

  if target_column_id is null then
    raise exception 'coluna de destino não encontrada' using errcode = '23503';
  end if;

  select coalesce(max(position), 0) + 1024
  into append_position
  from public.requests
  where column_id = target_column_id;

  if append_position > 9007199254740991 then
    raise exception 'posição segura esgotada na coluna de destino' using errcode = '23514';
  end if;

  insert into public.requests (
    title,
    description,
    requester_name,
    assigned_to,
    external_url,
    position,
    column_id,
    created_by
  )
  values (
    normalized_title,
    normalized_description,
    normalized_requester_name,
    new_assigned_to,
    normalized_external_url,
    append_position,
    target_column_id,
    auth.uid()
  )
  returning * into result;

  return result;
end;
$$;

create or replace function public.move_request(
  request_id uuid,
  new_column_id uuid,
  new_position numeric
)
returns public.requests
language plpgsql
security definer
set search_path = public
as $$
declare
  target_column_id uuid;
  result public.requests;
begin
  if not public.has_request_permission('move') then
    raise exception 'permissão negada' using errcode = '42501';
  end if;

  if new_position is null
    or new_position < 0
    or new_position > 9007199254740991
    or new_position in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric) then
    raise exception 'movimento inválido' using errcode = '23514';
  end if;

  select id
  into target_column_id
  from public.board_columns
  where id = new_column_id
  for key share;

  if not found then
    raise exception 'coluna de destino não encontrada' using errcode = '23503';
  end if;

  select *
  into result
  from public.requests
  where id = request_id
  for update;

  if not found then
    raise exception 'solicitação não encontrada' using errcode = 'P0002';
  end if;

  update public.requests
  set column_id = target_column_id,
      position = new_position
  where id = request_id
  returning * into result;

  return result;
end;
$$;

create or replace function public.update_request_content(
  request_id uuid,
  new_title text,
  new_description text,
  new_requester_name text,
  new_assigned_to uuid,
  new_external_url text
)
returns public.requests
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_title text := trim(new_title);
  normalized_description text := nullif(trim(new_description), '');
  normalized_requester_name text := trim(new_requester_name);
  normalized_external_url text := nullif(trim(new_external_url), '');
  current_request public.requests;
  current_column_kind text;
  target_column_id uuid;
  result public.requests;
begin
  if not public.has_request_permission('edit') then
    raise exception 'permissão negada' using errcode = '42501';
  end if;

  select request_row.*
  into current_request
  from public.requests request_row
  where request_row.id = request_id
  for update;

  if not found then
    raise exception 'solicitação não encontrada' using errcode = 'P0002';
  end if;

  select column_target.kind
  into current_column_kind
  from public.board_columns column_target
  where column_target.id = current_request.column_id;

  if normalized_title is null or char_length(normalized_title) not between 2 and 160 then
    raise exception 'título inválido' using errcode = '23514';
  end if;

  if normalized_description is not null and char_length(normalized_description) > 5000 then
    raise exception 'descrição inválida' using errcode = '23514';
  end if;

  if normalized_requester_name is null or char_length(normalized_requester_name) not between 2 and 160 then
    raise exception 'solicitante inválido' using errcode = '23514';
  end if;

  if not public.is_approved(new_assigned_to) then
    raise exception 'responsável precisa estar aprovado' using errcode = '23514';
  end if;

  if normalized_external_url is not null and (
    char_length(normalized_external_url) > 2048
    or normalized_external_url !~* '^https?://[^[:space:]]+$'
  ) then
    raise exception 'URL inválida' using errcode = '23514';
  end if;

  target_column_id := current_request.column_id;

  if current_column_kind = 'assignee'
    and new_assigned_to is distinct from current_request.assigned_to then
    select id
    into target_column_id
    from public.board_columns
    where assignee_id = new_assigned_to;

    if target_column_id is null then
      select id
      into target_column_id
      from public.board_columns
      where system_key = 'pending';
    end if;

    if target_column_id is null then
      raise exception 'coluna de destino não encontrada' using errcode = '23503';
    end if;
  end if;

  update public.requests
  set title = normalized_title,
      description = normalized_description,
      requester_name = normalized_requester_name,
      assigned_to = new_assigned_to,
      external_url = normalized_external_url,
      column_id = target_column_id
  where id = request_id
  returning * into result;

  return result;
end;
$$;

revoke all on function public.has_column_management_permission() from public;
revoke all on function public.create_board_column(text,uuid,numeric) from public;
revoke all on function public.rename_board_column(uuid,text) from public;
revoke all on function public.reorder_board_column(uuid,numeric) from public;
revoke all on function public.delete_board_column(uuid) from public;
revoke all on function public.create_request(text,text,text,uuid,text,numeric) from public;
revoke all on function public.move_request(uuid,uuid,numeric) from public;
revoke all on function public.update_request_content(uuid,text,text,text,uuid,text) from public;

grant execute on function public.has_column_management_permission() to authenticated;
grant execute on function public.create_board_column(text,uuid,numeric) to authenticated;
grant execute on function public.rename_board_column(uuid,text) to authenticated;
grant execute on function public.reorder_board_column(uuid,numeric) to authenticated;
grant execute on function public.delete_board_column(uuid) to authenticated;
grant execute on function public.create_request(text,text,text,uuid,text,numeric) to authenticated;
grant execute on function public.move_request(uuid,uuid,numeric) to authenticated;
grant execute on function public.update_request_content(uuid,text,text,text,uuid,text) to authenticated;
