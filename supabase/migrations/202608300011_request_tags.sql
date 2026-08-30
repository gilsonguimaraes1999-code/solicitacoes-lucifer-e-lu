alter table public.requests
add column tags text[] not null default '{}'::text[];

create or replace function public.request_tags_are_valid(value text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(cardinality(value), 0) <= 6
    and array_position(coalesce(value, '{}'::text[]), null) is null
    and coalesce(value <@ array['f1', 'loja', 'jogo', 'hub', 'growth', 'outros']::text[], false)
    and (
      select count(*) = count(distinct tag)
      from unnest(coalesce(value, '{}'::text[])) as tag
    );
$$;

alter table public.requests
add constraint requests_tags_valid check (public.request_tags_are_valid(tags));

create or replace function public.create_request(
  new_title text,
  new_description text,
  new_requester_name text,
  new_assigned_to uuid,
  new_external_url text,
  new_position numeric,
  new_tags text[]
)
returns public.requests
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.requests;
begin
  if coalesce(cardinality(new_tags), 0) < 1 or not public.request_tags_are_valid(new_tags) then
    raise exception 'selecione pelo menos uma tag válida' using errcode = '23514';
  end if;

  result := public.create_request(
    new_title,
    new_description,
    new_requester_name,
    new_assigned_to,
    new_external_url,
    new_position
  );

  update public.requests
  set tags = new_tags
  where id = result.id
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
  new_external_url text,
  new_tags text[]
)
returns public.requests
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.requests;
begin
  if coalesce(cardinality(new_tags), 0) < 1 or not public.request_tags_are_valid(new_tags) then
    raise exception 'selecione pelo menos uma tag válida' using errcode = '23514';
  end if;

  result := public.update_request_content(
    request_id,
    new_title,
    new_description,
    new_requester_name,
    new_assigned_to,
    new_external_url
  );

  update public.requests
  set tags = new_tags
  where id = result.id
  returning * into result;

  return result;
end;
$$;

revoke execute on function public.create_request(text,text,text,uuid,text,numeric) from authenticated;
revoke execute on function public.update_request_content(uuid,text,text,text,uuid,text) from authenticated;
revoke all on function public.create_request(text,text,text,uuid,text,numeric,text[]) from public;
revoke all on function public.update_request_content(uuid,text,text,text,uuid,text,text[]) from public;
grant execute on function public.create_request(text,text,text,uuid,text,numeric,text[]) to authenticated;
grant execute on function public.update_request_content(uuid,text,text,text,uuid,text,text[]) to authenticated;
