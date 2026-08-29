grant usage on schema public to authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.user_permissions to authenticated;
grant select, insert, delete on table public.requests to authenticated;


