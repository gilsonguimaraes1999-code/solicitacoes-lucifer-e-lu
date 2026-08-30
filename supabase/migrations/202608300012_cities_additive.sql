create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index cities_name_unique on public.cities (lower(trim(name)));
create index cities_active_name_idx on public.cities (active, lower(trim(name)));

create table public.request_cities (
  request_id uuid not null references public.requests(id) on delete cascade,
  city_id uuid not null references public.cities(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (request_id, city_id)
);

create index request_cities_city_idx on public.request_cities(city_id);

alter table public.user_permissions
add column can_manage_cities boolean not null default false;

create trigger cities_set_updated_at
before update on public.cities
for each row execute function public.set_updated_at();

do $$ begin
  if exists (
    select 1
    from public.requests
    where char_length(trim(requester_name)) < 2
  ) then
    raise exception 'requester_name legado inválido para backfill de cidades';
  end if;
end $$;

insert into public.cities(name, created_by)
select min(trim(requester_name)), min(created_by::text)::uuid
from public.requests
group by lower(trim(requester_name));

insert into public.request_cities(request_id, city_id)
select request.id, city.id
from public.requests request
join public.cities city
  on lower(trim(city.name)) = lower(trim(request.requester_name));

create or replace function public.has_city_management_permission()
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
      and permission.can_manage_cities
  )
$$;

create or replace function public.create_city(new_name text)
returns public.cities
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text := trim(new_name);
  result public.cities;
begin
  if not public.has_city_management_permission() then
    raise exception 'permissão negada' using errcode = '42501';
  end if;

  if normalized_name is null or char_length(normalized_name) not between 2 and 120 then
    raise exception 'nome da cidade inválido' using errcode = '23514';
  end if;

  insert into public.cities(name, created_by)
  values (normalized_name, auth.uid())
  returning * into result;

  return result;
end;
$$;

create or replace function public.rename_city(city_id uuid, new_name text)
returns public.cities
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text := trim(new_name);
  result public.cities;
begin
  if not public.has_city_management_permission() then
    raise exception 'permissão negada' using errcode = '42501';
  end if;

  if normalized_name is null or char_length(normalized_name) not between 2 and 120 then
    raise exception 'nome da cidade inválido' using errcode = '23514';
  end if;

  update public.cities
  set name = normalized_name
  where id = city_id
  returning * into result;

  if result.id is null then
    raise exception 'cidade não encontrada' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

create or replace function public.deactivate_city(city_id uuid)
returns public.cities
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.cities;
begin
  if not public.has_city_management_permission() then
    raise exception 'permissão negada' using errcode = '42501';
  end if;

  update public.cities
  set active = false
  where id = city_id
  returning * into result;

  if result.id is null then
    raise exception 'cidade não encontrada' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

create or replace function public.reactivate_city(city_id uuid)
returns public.cities
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.cities;
begin
  if not public.has_city_management_permission() then
    raise exception 'permissão negada' using errcode = '42501';
  end if;

  update public.cities
  set active = true
  where id = city_id
  returning * into result;

  if result.id is null then
    raise exception 'cidade não encontrada' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

create or replace function public.create_request_with_cities(
  new_title text,
  new_description text,
  new_assigned_to uuid,
  new_external_url text,
  new_position numeric,
  new_tags text[],
  new_city_ids uuid[]
)
returns public.requests
language plpgsql
security definer
set search_path = public
as $$
declare
  legacy_city_name text;
  older_min_position numeric;
  result public.requests;
begin
  if public.has_request_permission('create') is not true then
    raise exception 'permissão negada' using errcode = '42501';
  end if;

  if coalesce(cardinality(new_city_ids), 0) < 1
    or array_position(coalesce(new_city_ids, '{}'::uuid[]), null) is not null
    or (
      select count(*) <> count(distinct selected.city_id)
      from unnest(coalesce(new_city_ids, '{}'::uuid[])) as selected(city_id)
    ) then
    raise exception 'selecione pelo menos uma cidade distinta' using errcode = '23514';
  end if;

  perform city.id
  from public.cities city
  where city.id = any(new_city_ids)
  order by city.id
  for update;

  if (
    select count(*)
    from public.cities city
    where city.id = any(new_city_ids)
  ) <> cardinality(new_city_ids) then
    raise exception 'cidade não encontrada' using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.cities city
    where city.id = any(new_city_ids)
      and not city.active
  ) then
    raise exception 'cidade inativa não pode ser vinculada' using errcode = '23514';
  end if;

  select city.name
  into legacy_city_name
  from public.cities city
  where city.id = any(new_city_ids)
  order by lower(trim(city.name)), city.id
  limit 1;

  result := public.create_request(
    new_title,
    new_description,
    legacy_city_name,
    new_assigned_to,
    new_external_url,
    new_position,
    new_tags
  );

  insert into public.request_cities(request_id, city_id)
  select result.id, selected.city_id
  from unnest(new_city_ids) as selected(city_id);

  select min(request_row.position)
  into older_min_position
  from public.requests request_row
  where request_row.column_id = result.column_id
    and request_row.id <> result.id;

  if older_min_position > 0 then
    update public.requests
    set position = older_min_position / 2
    where id = result.id
    returning * into result;
  elsif older_min_position = 0 then
    with reordered as (
      select
        request_row.id,
        row_number() over (order by request_row.position, request_row.id) * 1024 as position
      from public.requests request_row
      where request_row.column_id = result.column_id
        and request_row.id <> result.id
    )
    update public.requests request_row
    set position = reordered.position
    from reordered
    where request_row.id = reordered.id;

    update public.requests
    set position = 0
    where id = result.id
    returning * into result;
  end if;

  return result;
end;
$$;

create or replace function public.update_request_with_cities(
  request_id uuid,
  new_title text,
  new_description text,
  new_assigned_to uuid,
  new_external_url text,
  new_tags text[],
  new_city_ids uuid[]
)
returns public.requests
language plpgsql
security definer
set search_path = public
as $$
declare
  legacy_city_name text;
  result public.requests;
begin
  if public.has_request_permission('edit') is not true then
    raise exception 'permissão negada' using errcode = '42501';
  end if;

  if coalesce(cardinality(new_city_ids), 0) < 1
    or array_position(coalesce(new_city_ids, '{}'::uuid[]), null) is not null
    or (
      select count(*) <> count(distinct selected.city_id)
      from unnest(coalesce(new_city_ids, '{}'::uuid[])) as selected(city_id)
    ) then
    raise exception 'selecione pelo menos uma cidade distinta' using errcode = '23514';
  end if;

  perform city.id
  from public.cities city
  where city.id = any(new_city_ids)
  order by city.id
  for update;

  if (
    select count(*)
    from public.cities city
    where city.id = any(new_city_ids)
  ) <> cardinality(new_city_ids) then
    raise exception 'cidade não encontrada' using errcode = '23503';
  end if;

  perform 1
  from public.requests request_row
  where request_row.id = request_id
  for update;

  if not found then
    raise exception 'solicitação não encontrada' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.cities city
    where city.id = any(new_city_ids)
      and not city.active
      and not exists (
        select 1
        from public.request_cities existing_link
        where existing_link.request_id = $1
          and existing_link.city_id = city.id
      )
  ) then
    raise exception 'cidade inativa nova não pode ser vinculada' using errcode = '23514';
  end if;

  select city.name
  into legacy_city_name
  from public.cities city
  where city.id = any(new_city_ids)
  order by lower(trim(city.name)), city.id
  limit 1;

  result := public.update_request_content(
    request_id,
    new_title,
    new_description,
    legacy_city_name,
    new_assigned_to,
    new_external_url,
    new_tags
  );

  delete from public.request_cities existing_link
  where existing_link.request_id = result.id;

  insert into public.request_cities(request_id, city_id)
  select result.id, selected.city_id
  from unnest(new_city_ids) as selected(city_id);

  return result;
end;
$$;

alter table public.cities enable row level security;
alter table public.request_cities enable row level security;

create policy cities_read_approved on public.cities
for select to authenticated
using (public.is_approved());

create policy request_cities_read_approved on public.request_cities
for select to authenticated
using (public.is_approved());

revoke all on table public.cities from public, anon, authenticated;
revoke all on table public.request_cities from public, anon, authenticated;
grant select on table public.cities to authenticated;
grant select on table public.request_cities to authenticated;

revoke all on function public.has_city_management_permission() from public;
revoke all on function public.create_city(text) from public;
revoke all on function public.rename_city(uuid,text) from public;
revoke all on function public.deactivate_city(uuid) from public;
revoke all on function public.reactivate_city(uuid) from public;
revoke all on function public.create_request_with_cities(text,text,uuid,text,numeric,text[],uuid[]) from public;
revoke all on function public.update_request_with_cities(uuid,text,text,uuid,text,text[],uuid[]) from public;

grant execute on function public.has_city_management_permission() to authenticated;
grant execute on function public.create_city(text) to authenticated;
grant execute on function public.rename_city(uuid,text) to authenticated;
grant execute on function public.deactivate_city(uuid) to authenticated;
grant execute on function public.reactivate_city(uuid) to authenticated;
grant execute on function public.create_request_with_cities(text,text,uuid,text,numeric,text[],uuid[]) to authenticated;
grant execute on function public.update_request_with_cities(uuid,text,text,uuid,text,text[],uuid[]) to authenticated;

alter table public.cities replica identity full;
alter table public.request_cities replica identity full;

do $$ begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cities'
  ) then
    alter publication supabase_realtime add table public.cities;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'request_cities'
  ) then
    alter publication supabase_realtime add table public.request_cities;
  end if;
end $$;
