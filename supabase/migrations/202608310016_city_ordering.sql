begin;

alter table public.cities add column position numeric;

with ranked as (
  select
    city.id,
    row_number() over (order by lower(trim(city.name)), city.id) * 1024 as position
  from public.cities city
)
update public.cities city
set position = ranked.position
from ranked
where ranked.id = city.id;

alter table public.cities
  alter column position set default 1024,
  alter column position set not null,
  add constraint cities_position_safe check (
    position > 0
    and position <= 9007199254740991
    and position not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  );

create index cities_position_id_idx on public.cities(position, name, id);

create or replace function public.create_city(new_name text)
returns public.cities
language plpgsql
security definer
set search_path = public
as $$
declare
  append_position numeric;
  normalized_name text := trim(new_name);
  result public.cities;
begin
  if not public.has_city_management_permission() then
    raise exception 'permissão negada' using errcode = '42501';
  end if;

  if normalized_name is null or char_length(normalized_name) not between 2 and 120 then
    raise exception 'nome da cidade inválido' using errcode = '23514';
  end if;

  lock table public.cities in share row exclusive mode;

  select coalesce(max(city.position), 0) + 1024
  into append_position
  from public.cities city;

  if append_position > 9007199254740991 then
    raise exception 'posição segura esgotada para cidades' using errcode = '23514';
  end if;

  insert into public.cities(name, position, created_by)
  values (normalized_name, append_position, auth.uid())
  returning * into result;

  return result;
end;
$$;

drop function if exists public.reorder_city(uuid, numeric);

create or replace function public.reorder_city(
  city_id uuid,
  before_city_id uuid default null,
  after_city_id uuid default null
)
returns setof public.cities
language plpgsql
security definer
set search_path = public
as $$
declare
  max_safe_position constant numeric := 9007199254740991;
  position_step constant numeric := 1024;
  moving_city public.cities;
  ordered_ids uuid[];
  reordered_ids uuid[];
  before_index integer;
  after_index integer;
  insertion_index integer;
  ordered_count integer;
begin
  if not public.has_city_management_permission() then
    raise exception 'permissão negada' using errcode = '42501';
  end if;

  if before_city_id is null and after_city_id is null then
    raise exception 'vizinhos da cidade são obrigatórios' using errcode = '23514';
  end if;

  if before_city_id = city_id or after_city_id = city_id then
    raise exception 'cidade não pode referenciar a si mesma como vizinha' using errcode = '23514';
  end if;

  if before_city_id is not null and after_city_id is not null and before_city_id = after_city_id then
    raise exception 'vizinhos da cidade devem ser distintos' using errcode = '23514';
  end if;

  lock table public.cities in share row exclusive mode;

  select *
  into moving_city
  from public.cities city
  where city.id = city_id
  for update;

  if not found then
    raise exception 'cidade não encontrada' using errcode = 'P0002';
  end if;

  select array_agg(city.id order by city.position, city.name, city.id)
  into ordered_ids
  from public.cities city
  where city.id <> city_id;

  ordered_count := coalesce(array_length(ordered_ids, 1), 0);

  if before_city_id is not null then
    before_index := array_position(ordered_ids, before_city_id);
    if before_index is null then
      raise exception 'cidade vizinha anterior não encontrada' using errcode = 'P0002';
    end if;
  end if;

  if after_city_id is not null then
    after_index := array_position(ordered_ids, after_city_id);
    if after_index is null then
      raise exception 'cidade vizinha posterior não encontrada' using errcode = 'P0002';
    end if;
  end if;

  if before_index is not null and after_index is not null and before_index + 1 <> after_index then
    raise exception 'vizinhas informadas não são adjacentes' using errcode = '23514';
  end if;

  insertion_index := case
    when after_index is not null then after_index
    when before_index is not null then before_index + 1
    else 1
  end;

  reordered_ids := coalesce(ordered_ids[1:insertion_index - 1], '{}'::uuid[])
    || array[city_id]
    || coalesce(ordered_ids[insertion_index:ordered_count], '{}'::uuid[]);

  if coalesce(array_length(reordered_ids, 1), 0)::numeric * position_step > max_safe_position then
    raise exception 'posição segura esgotada para cidades' using errcode = '23514';
  end if;

  return query
  with canonical_order as (
    select reordered_ids[sequence.ordinality] as id, sequence.ordinality
    from generate_subscripts(reordered_ids, 1) as sequence(ordinality)
  ),
  updated as (
    update public.cities city
    set position = canonical_order.ordinality * position_step
    from canonical_order
    where city.id = canonical_order.id
    returning city.*
  )
  select updated.*
  from updated
  order by updated.position, updated.name, updated.id;
end;
$$;

revoke all on function public.reorder_city(uuid,uuid,uuid) from public;
grant execute on function public.reorder_city(uuid,uuid,uuid) to authenticated;

commit;
