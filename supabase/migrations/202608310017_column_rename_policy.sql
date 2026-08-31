begin;

alter table public.board_columns
  drop constraint if exists board_columns_name_check;

alter table public.board_columns
  add constraint board_columns_name_check check (char_length(trim(name)) between 2 and 120);

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
  assignee_name text;
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

  select full_name
  into assignee_name
  from public.profiles
  where id = target_assignee;

  insert into public.board_columns (
    name,
    kind,
    assignee_id,
    position,
    created_by
  )
  values (
    assignee_name,
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

  if target.kind = 'assignee' then
    raise exception 'colunas de responsável acompanham o nome do usuário' using errcode = '23514';
  end if;

  update public.board_columns
  set name = normalized_name
  where id = column_id
  returning * into result;

  return result;
end;
$$;

create or replace function public.sync_assignee_board_column_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.full_name is distinct from old.full_name then
    update public.board_columns
    set name = new.full_name
    where kind = 'assignee'
      and assignee_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_assignee_board_column_name on public.profiles;
create trigger sync_assignee_board_column_name
after update of full_name on public.profiles
for each row
execute function public.sync_assignee_board_column_name();

update public.board_columns as target
set name = profile.full_name
from public.profiles as profile
where target.kind = 'assignee'
  and target.assignee_id = profile.id
  and target.name is distinct from profile.full_name;

revoke all on function public.sync_assignee_board_column_name() from public;

commit;
