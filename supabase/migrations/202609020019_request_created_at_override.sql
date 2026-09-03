begin;

drop function if exists public.create_request_with_cities(text,text,uuid,text,numeric,text[],uuid[]);
drop function if exists public.update_request_with_cities(uuid,text,text,uuid,text,text[],uuid[]);

create function public.create_request_with_cities(
  new_title text,
  new_description text,
  new_assigned_to uuid,
  new_external_url text,
  new_position numeric,
  new_tags text[],
  new_city_ids uuid[],
  new_created_at_local timestamp without time zone default null
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

  if new_created_at_local is not null then
    update public.requests
    set created_at = new_created_at_local at time zone 'America/Sao_Paulo'
    where id = result.id
    returning * into result;
  end if;

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

create function public.update_request_with_cities(
  request_id uuid,
  new_title text,
  new_description text,
  new_assigned_to uuid,
  new_external_url text,
  new_tags text[],
  new_city_ids uuid[],
  new_created_at_local timestamp without time zone default null
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

  if new_created_at_local is not null then
    update public.requests
    set created_at = new_created_at_local at time zone 'America/Sao_Paulo'
    where id = result.id
    returning * into result;
  end if;

  delete from public.request_cities existing_link
  where existing_link.request_id = result.id;

  insert into public.request_cities(request_id, city_id)
  select result.id, selected.city_id
  from unnest(new_city_ids) as selected(city_id);

  return result;
end;
$$;

revoke all on function public.create_request_with_cities(text,text,uuid,text,numeric,text[],uuid[],timestamp without time zone) from public;
revoke all on function public.update_request_with_cities(uuid,text,text,uuid,text,text[],uuid[],timestamp without time zone) from public;

grant execute on function public.create_request_with_cities(text,text,uuid,text,numeric,text[],uuid[],timestamp without time zone) to authenticated;
grant execute on function public.update_request_with_cities(uuid,text,text,uuid,text,text[],uuid[],timestamp without time zone) to authenticated;

commit;
