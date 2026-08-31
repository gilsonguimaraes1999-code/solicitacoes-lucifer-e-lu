begin;

alter table public.board_columns add column if not exists color text;

update public.board_columns
set color = case
  when kind = 'assignee' then '#a78bfa'
  when kind = 'custom' then '#d4af37'
  when system_key = 'in_progress' then '#60a5fa'
  when system_key = 'completed' then '#34d399'
  else '#d4af37'
end
where color is null;

alter table public.board_columns
  alter column color set default '#d4af37',
  alter column color set not null,
  add constraint board_columns_color_check check (color ~ '^#[0-9a-fA-F]{6}$');

create or replace function public.create_board_column(
  new_name text,
  target_assignee uuid,
  new_position numeric,
  new_color text
)
returns public.board_columns
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.board_columns;
begin
  if new_color is null or new_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'cor da coluna inválida' using errcode = '23514';
  end if;

  result := public.create_board_column(new_name, target_assignee, new_position);
  update public.board_columns set color = lower(new_color) where id = result.id returning * into result;
  return result;
end;
$$;

create or replace function public.create_custom_board_column(
  new_name text,
  new_position numeric,
  new_color text
)
returns public.board_columns
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.board_columns;
begin
  if new_color is null or new_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'cor da coluna inválida' using errcode = '23514';
  end if;

  result := public.create_custom_board_column(new_name, new_position);
  update public.board_columns set color = lower(new_color) where id = result.id returning * into result;
  return result;
end;
$$;

create or replace function public.rename_board_column(
  column_id uuid,
  new_name text,
  new_color text
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

  if new_color is null or new_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'cor da coluna inválida' using errcode = '23514';
  end if;

  select * into target from public.board_columns where id = column_id for update;
  if not found then
    raise exception 'coluna não encontrada' using errcode = 'P0002';
  end if;

  if target.kind = 'assignee' and normalized_name is distinct from target.name then
    raise exception 'colunas de responsável acompanham o nome do usuário' using errcode = '23514';
  end if;

  update public.board_columns
  set name = case when target.kind = 'assignee' then target.name else normalized_name end,
      color = lower(new_color)
  where id = column_id
  returning * into result;

  return result;
end;
$$;

revoke all on function public.create_board_column(text,uuid,numeric,text) from public;
revoke all on function public.create_custom_board_column(text,numeric,text) from public;
revoke all on function public.rename_board_column(uuid,text,text) from public;
grant execute on function public.create_board_column(text,uuid,numeric,text) to authenticated;
grant execute on function public.create_custom_board_column(text,numeric,text) to authenticated;
grant execute on function public.rename_board_column(uuid,text,text) to authenticated;

commit;
