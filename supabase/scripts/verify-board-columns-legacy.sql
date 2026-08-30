\set ON_ERROR_STOP on

begin read only;

do $$
begin
  if exists (
    select 1
    from public.requests
    where position > 9007199254740991
       or position in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  ) then
    raise exception using
      errcode = '23514',
      message = 'preflight failed: requests.position contains a non-finite or JavaScript-unsafe value';
  end if;
end
$$;

select
  count(*) as request_count,
  max(position) as maximum_position,
  count(*) filter (
    where position > 9007199254740991
       or position in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  ) as unsafe_positions
from public.requests;

rollback;
