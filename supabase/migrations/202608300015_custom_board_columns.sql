begin;

alter table public.board_columns
  drop constraint if exists board_columns_kind_check,
  drop constraint if exists board_columns_shape;

alter table public.board_columns
  add constraint board_columns_kind_check check (kind in ('system', 'assignee', 'custom')),
  add constraint board_columns_shape check (
    (kind = 'system' and system_key is not null and assignee_id is null)
    or (kind = 'assignee' and system_key is null and assignee_id is not null)
    or (kind = 'custom' and system_key is null and assignee_id is null)
  );

create or replace function public.create_custom_board_column(
  new_name text,
  new_position numeric
)
returns public.board_columns
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text := trim(new_name);
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

  insert into public.board_columns (name, kind, position, created_by)
  values (normalized_name, 'custom', new_position, auth.uid())
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

  select *
  into target
  from public.board_columns
  where id = column_id
  for update;

  if not found then
    raise exception 'coluna não encontrada' using errcode = 'P0002';
  end if;

  update public.board_columns
  set position = new_position
  where id = column_id
  returning * into result;

  return result;
end;
$$;

revoke all on function public.create_custom_board_column(text,numeric) from public;
grant execute on function public.create_custom_board_column(text,numeric) to authenticated;

commit;
