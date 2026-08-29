create or replace function public.is_approved(target uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = target and approval_status = 'approved') $$;

create or replace function public.is_owner(target uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = target and role = 'owner' and approval_status = 'approved') $$;

create or replace function public.has_request_permission(permission_name text)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_owner() or exists (
    select 1 from public.user_permissions p
    join public.profiles u on u.id = p.user_id
    where p.user_id = auth.uid() and u.approval_status = 'approved'
      and case permission_name
        when 'create' then p.can_create_requests
        when 'edit' then p.can_edit_requests
        when 'move' then p.can_move_requests
        when 'delete' then p.can_delete_requests
        else false end
  )
$$;

alter table public.profiles enable row level security;
alter table public.user_permissions enable row level security;
alter table public.requests enable row level security;

create or replace function public.protect_owner_account()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.id = auth.uid() and old.role = 'owner' and (new.role <> 'owner' or new.approval_status <> 'approved') then
    raise exception 'owner não pode remover o próprio acesso' using errcode = '42501';
  end if;
  return new;
end; $$;

create trigger profiles_protect_owner before update on public.profiles
for each row execute function public.protect_owner_account();

create policy profiles_read_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_read_approved on public.profiles for select to authenticated using (public.is_approved() and approval_status = 'approved');
create policy profiles_owner_all on public.profiles for select to authenticated using (public.is_owner());
create policy profiles_owner_update on public.profiles for update to authenticated using (public.is_owner()) with check (public.is_owner());

create policy permissions_read_self on public.user_permissions for select to authenticated using (user_id = auth.uid());
create policy permissions_owner_read on public.user_permissions for select to authenticated using (public.is_owner());
create policy permissions_owner_update on public.user_permissions for update to authenticated using (public.is_owner()) with check (public.is_owner());

create policy requests_approved_read on public.requests for select to authenticated using (public.is_approved());
create policy requests_permission_insert on public.requests for insert to authenticated
with check (public.has_request_permission('create') and created_by = auth.uid() and public.is_approved(assigned_to));
create policy requests_permission_delete on public.requests for delete to authenticated
using (public.has_request_permission('delete'));

revoke update on public.requests from authenticated;

create or replace function public.update_request_content(
  request_id uuid, new_title text, new_description text, new_requester_name text, new_assigned_to uuid, new_external_url text
) returns public.requests language plpgsql security definer set search_path = public as $$
declare result public.requests;
begin
  if not public.has_request_permission('edit') then raise exception 'permission denied' using errcode = '42501'; end if;
  if not public.is_approved(new_assigned_to) then raise exception 'responsável precisa estar aprovado' using errcode = '23514'; end if;
  if new_external_url is not null and new_external_url !~* '^https?://[^[:space:]]+$' then raise exception 'URL inválida' using errcode = '23514'; end if;
  update public.requests set title = trim(new_title), description = nullif(trim(new_description), ''),
    requester_name = trim(new_requester_name), assigned_to = new_assigned_to,
    external_url = nullif(trim(new_external_url), '') where id = request_id returning * into result;
  if result.id is null then raise exception 'solicitação não encontrada' using errcode = 'P0002'; end if;
  return result;
end; $$;

create or replace function public.move_request(request_id uuid, new_status text, new_position numeric)
returns public.requests language plpgsql security definer set search_path = public as $$
declare result public.requests;
begin
  if not public.has_request_permission('move') then raise exception 'permission denied' using errcode = '42501'; end if;
  if new_status not in ('pending', 'in_progress', 'completed') or new_position < 0 then raise exception 'movimento inválido' using errcode = '23514'; end if;
  perform 1 from public.requests where id = request_id for update;
  update public.requests set status = new_status, position = new_position where id = request_id returning * into result;
  if result.id is null then raise exception 'solicitação não encontrada' using errcode = 'P0002'; end if;
  return result;
end; $$;

create or replace function public.admin_update_user(target_user uuid, new_name text default null, new_status text default null)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare result public.profiles;
begin
  if not public.is_owner() then raise exception 'permission denied' using errcode = '42501'; end if;
  if target_user = auth.uid() and new_status is not null and new_status <> 'approved' then
    raise exception 'owner não pode bloquear a própria conta' using errcode = '42501';
  end if;
  update public.profiles set
    full_name = coalesce(nullif(trim(new_name), ''), full_name),
    approval_status = coalesce(new_status, approval_status)
  where id = target_user returning * into result;
  return result;
end; $$;

revoke all on function public.update_request_content(uuid,text,text,text,uuid,text) from public;
revoke all on function public.move_request(uuid,text,numeric) from public;
revoke all on function public.admin_update_user(uuid,text,text) from public;
grant execute on function public.update_request_content(uuid,text,text,text,uuid,text) to authenticated;
grant execute on function public.move_request(uuid,text,numeric) to authenticated;
grant execute on function public.admin_update_user(uuid,text,text) to authenticated;
