begin;

-- Prevent request/city writes while the repair snapshots and reconciles the
-- existing relationships. The management RPCs remain unchanged and become
-- available again as soon as this transaction commits.
lock table public.cities, public.requests, public.request_cities
in share row exclusive mode;

create temporary table canonical_city_seed (
  name text primary key
) on commit drop;

insert into canonical_city_seed(name)
values
  ('Nobre'),
  ('Santa'),
  ('Maresia'),
  ('Grande'),
  ('Fronteira'),
  ('Real'),
  ('Prime'),
  ('Malta'),
  ('Liberty99'),
  ('District99'),
  ('Krown'),
  ('KNG'),
  ('Royal'),
  ('Orizon');

-- These snapshots make preservation requirements executable: canonical links
-- and the compatibility text must be byte-for-byte unchanged by this repair.
create temporary table canonical_links_before
on commit drop
as
select link.request_id, link.city_id
from public.request_cities link
join public.cities city on city.id = link.city_id
join canonical_city_seed canonical
  on lower(trim(canonical.name)) = lower(trim(city.name));

create temporary table requester_names_before
on commit drop
as
select request_row.id, request_row.requester_name
from public.requests request_row;

-- Reuse an existing case-insensitive city row whenever present so its UUID and
-- request relationships survive. Missing canonical rows are seeded.
update public.cities city
set name = canonical.name,
    active = true
from canonical_city_seed canonical
where lower(trim(city.name)) = lower(trim(canonical.name));

insert into public.cities(name, active)
select canonical.name, true
from canonical_city_seed canonical
where not exists (
  select 1
  from public.cities city
  where lower(trim(city.name)) = lower(trim(canonical.name))
);

-- Legacy requester_name values were previously turned into city rows by 012.
-- There is no trustworthy mapping from those free-form values to this seed, so
-- remove their relationships instead of guessing a replacement.
delete from public.request_cities link
using public.cities city
where city.id = link.city_id
  and not exists (
    select 1
    from canonical_city_seed canonical
    where lower(trim(canonical.name)) = lower(trim(city.name))
  );

delete from public.cities city
where not exists (
  select 1
  from canonical_city_seed canonical
  where lower(trim(canonical.name)) = lower(trim(city.name))
);

do $$
begin
  if (select count(*) from public.cities) <> 14
    or exists (
      select 1
      from canonical_city_seed canonical
      left join public.cities city
        on city.name = canonical.name
       and city.active
      where city.id is null
    ) then
    raise exception 'city repair failed: expected exactly the 14 canonical active cities';
  end if;

  if exists (
    select 1
    from public.request_cities link
    join public.cities city on city.id = link.city_id
    where not exists (
      select 1
      from canonical_city_seed canonical
      where canonical.name = city.name
    )
  ) then
    raise exception 'city repair failed: a request still references a non-canonical city';
  end if;

  if exists (
    select request_id, city_id
    from canonical_links_before
    except
    select request_id, city_id
    from public.request_cities
  ) or exists (
    select request_id, city_id
    from public.request_cities
    except
    select request_id, city_id
    from canonical_links_before
  ) then
    raise exception 'city repair failed: canonical request relationships changed';
  end if;

  if exists (
    select 1
    from requester_names_before snapshot
    full join public.requests request_row on request_row.id = snapshot.id
    where request_row.id is null
       or snapshot.id is null
       or request_row.requester_name is distinct from snapshot.requester_name
  ) then
    raise exception 'city repair failed: legacy requester_name values changed';
  end if;
end
$$;

commit;
