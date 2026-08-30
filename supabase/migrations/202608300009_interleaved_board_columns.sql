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

revoke all on function public.reorder_board_column(uuid,numeric) from public;
grant execute on function public.reorder_board_column(uuid,numeric) to authenticated;
