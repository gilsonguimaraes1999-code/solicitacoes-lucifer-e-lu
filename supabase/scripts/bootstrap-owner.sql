\if :{?owner_email}
\else
  \echo 'Uso: psql ... -v owner_email=owner@example.com -f supabase/scripts/bootstrap-owner.sql'
  \quit
\endif

create temporary table bootstrap_owner_target on commit drop as
select id from auth.users where lower(email) = lower(:'owner_email');

do $$ begin
  if (select count(*) from bootstrap_owner_target) <> 1 then
    raise exception 'O e-mail informado precisa corresponder a exatamente um usuário';
  end if;
end $$;

update public.profiles set role = 'owner', approval_status = 'approved'
where id = (select id from bootstrap_owner_target);

update public.user_permissions set can_create_requests = true, can_edit_requests = true,
  can_move_requests = true, can_delete_requests = true
where user_id = (select id from bootstrap_owner_target);
