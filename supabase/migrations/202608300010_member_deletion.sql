create or replace function public.prepare_member_deletion(target_user_id uuid, replacement_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
  replacement_is_owner boolean;
  pending_column_id uuid;
begin
  if target_user_id = replacement_user_id then
    raise exception 'a conta substituta precisa ser diferente da conta removida';
  end if;

  select role into target_role from public.profiles where id = target_user_id for update;
  if target_role is null then raise exception 'perfil alvo não encontrado'; end if;
  if target_role = 'owner' then raise exception 'a conta owner não pode ser excluída'; end if;

  select role = 'owner' and approval_status = 'approved'
    into replacement_is_owner
  from public.profiles
  where id = replacement_user_id;
  if replacement_is_owner is not true then raise exception 'a conta substituta precisa ser um owner aprovado'; end if;

  select id into pending_column_id from public.board_columns where system_key = 'pending';
  if pending_column_id is null then raise exception 'a coluna Pendente não foi encontrada'; end if;

  update public.requests
  set assigned_to = replacement_user_id,
      column_id = pending_column_id,
      status = 'pending'
  where assigned_to = target_user_id;

  update public.requests
  set column_id = pending_column_id,
      status = 'pending'
  where column_id in (select id from public.board_columns where assignee_id = target_user_id);

  update public.requests
  set created_by = replacement_user_id
  where created_by = target_user_id;

  delete from public.board_columns where assignee_id = target_user_id;
end;
$$;

revoke all on function public.prepare_member_deletion(uuid, uuid) from public;
grant execute on function public.prepare_member_deletion(uuid, uuid) to service_role;
