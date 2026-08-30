revoke insert on table public.requests from authenticated;
drop function if exists public.move_request(uuid,text,numeric);
