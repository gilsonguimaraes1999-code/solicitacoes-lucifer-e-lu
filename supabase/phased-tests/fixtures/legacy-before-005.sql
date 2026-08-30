-- Load after 202608290004_grants.sql and before
-- 202608290005_board_columns.sql in a disposable database.
insert into auth.users (id, email, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-000000000501',
  'legacy-before-columns@example.com',
  '{"full_name":"Owner legado antes das colunas"}'
);

update public.profiles
set role = 'owner', approval_status = 'approved'
where id = '00000000-0000-0000-0000-000000000501';

insert into public.requests (
  id,
  title,
  requester_name,
  assigned_to,
  status,
  position,
  created_by
) values (
  '00000000-0000-0000-0000-000000000502',
  'Legado antes das colunas',
  'Solicitante legado',
  '00000000-0000-0000-0000-000000000501',
  'in_progress',
  1024,
  '00000000-0000-0000-0000-000000000501'
);
