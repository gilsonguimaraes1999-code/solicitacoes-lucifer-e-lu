-- Run explicitly with psql against an empty, disposable Supabase database.
-- Keeping the complete phase setup inside this transaction proves the legacy
-- backfill and additive behavior without persisting schema or fixture data.
\set ON_ERROR_STOP on
begin;

\ir ../migrations/202608290001_schema.sql
\ir ../migrations/202608290002_security.sql
\ir ../migrations/202608290003_realtime.sql
\ir ../migrations/202608290004_grants.sql
\ir fixtures/legacy-before-005.sql
\ir ../migrations/202608290005_board_columns.sql
\ir ../migrations/202608290006_board_column_rpcs.sql

select plan(21);

select results_eq(
  $$
    select request.status, column_target.system_key
    from public.requests request
    join public.board_columns column_target on column_target.id = request.column_id
    where request.id = '00000000-0000-0000-0000-000000000502'
  $$,
  $$ values ('in_progress'::text, 'in_progress'::text) $$,
  '005 backfills a legacy request into its matching system column'
);

select ok(
  has_table_privilege('authenticated', 'public.requests', 'insert'),
  'the additive phase retains authenticated direct INSERT compatibility'
);

select has_function(
  'public',
  'move_request',
  array['uuid','text','numeric'],
  'the additive phase retains the legacy move RPC'
);

select function_privs_are(
  'public',
  'move_request',
  array['uuid','text','numeric'],
  'authenticated',
  array['EXECUTE'],
  'authenticated retains access to the legacy move RPC'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '00000000-0000-0000-0000-000000000503',
    'approved-assignee-additive@example.com',
    '{"full_name":"Responsável aprovado aditivo"}'
  ),
  (
    '00000000-0000-0000-0000-000000000504',
    'unapproved-additive@example.com',
    '{"full_name":"Usuário não aprovado aditivo"}'
  );

update public.profiles
set approval_status = 'approved'
where id = '00000000-0000-0000-0000-000000000503';

insert into public.board_columns (
  id, name, kind, assignee_id, position, created_by
) values (
  '00000000-0000-0000-0000-000000000505',
  'Responsável aprovado aditivo',
  'assignee',
  '00000000-0000-0000-0000-000000000503',
  4096,
  '00000000-0000-0000-0000-000000000501'
);

select throws_ok(
  $$
    insert into public.requests (
      title, requester_name, assigned_to, status, position, created_by
    ) values (
      'Posição acima do limite seguro',
      'Solicitante privilegiado',
      '00000000-0000-0000-0000-000000000503',
      'pending',
      9007199254740992,
      '00000000-0000-0000-0000-000000000501'
    )
  $$,
  '23514',
  null,
  'the table constraint rejects positions above the JavaScript-safe bound'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"00000000-0000-0000-0000-000000000501","role":"authenticated"}';
set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000501';

select results_eq(
  $$ select count(*)::bigint from public.board_columns $$,
  array[4::bigint],
  'an approved authenticated user reads board columns through RLS'
);

select lives_ok(
  $$
    insert into public.requests (
      id, title, requester_name, assigned_to, status, position, created_by
    ) values (
      '00000000-0000-0000-0000-000000000506',
      'Insert legado pendente',
      'Solicitante legado',
      '00000000-0000-0000-0000-000000000503',
      'pending',
      1024,
      '00000000-0000-0000-0000-000000000501'
    )
  $$,
  'an approved legacy client can still insert without column_id'
);

select results_eq(
  $$
    select column_target.kind, column_target.system_key
    from public.requests request
    join public.board_columns column_target on column_target.id = request.column_id
    where request.id = '00000000-0000-0000-0000-000000000506'
  $$,
  $$ values ('system'::text, 'pending'::text) $$,
  'the legacy direct INSERT finishes in the pending system column'
);

select throws_ok(
  $$
    insert into public.requests (
      title, requester_name, assigned_to, status, position, created_by
    ) values (
      'Insert direto NaN',
      'Solicitante direto',
      '00000000-0000-0000-0000-000000000503',
      'pending',
      'NaN'::numeric,
      '00000000-0000-0000-0000-000000000501'
    )
  $$,
  '42501',
  null,
  'RLS rejects a legacy direct INSERT with a NaN position'
);

select throws_ok(
  $$
    insert into public.requests (
      title, requester_name, assigned_to, status, position, created_by
    ) values (
      'Insert direto infinito',
      'Solicitante direto',
      '00000000-0000-0000-0000-000000000503',
      'pending',
      'Infinity'::numeric,
      '00000000-0000-0000-0000-000000000501'
    )
  $$,
  '42501',
  null,
  'RLS rejects a legacy direct INSERT with an infinite position'
);

select throws_ok(
  $$
    insert into public.requests (
      title, requester_name, assigned_to, status, position, column_id, created_by
    ) values (
      'Insert direto em progresso',
      'Solicitante direto',
      '00000000-0000-0000-0000-000000000503',
      'in_progress',
      1024,
      (select id from public.board_columns where system_key = 'in_progress'),
      '00000000-0000-0000-0000-000000000501'
    )
  $$,
  '42501',
  null,
  'RLS rejects a direct INSERT into a non-pending system column'
);

select throws_ok(
  $$
    insert into public.requests (
      title, requester_name, assigned_to, position, column_id, created_by
    ) values (
      'Insert direto no responsável',
      'Solicitante direto',
      '00000000-0000-0000-0000-000000000503',
      1024,
      '00000000-0000-0000-0000-000000000505',
      '00000000-0000-0000-0000-000000000501'
    )
  $$,
  '42501',
  null,
  'RLS rejects a direct INSERT into an assignee column'
);

select results_eq(
  $$
    select target.kind, target.assignee_id
    from public.create_request(
      'RPC append A',
      null,
      'Solicitante RPC',
      '00000000-0000-0000-0000-000000000503',
      null,
      1024
    ) created
    join public.board_columns target on target.id = created.column_id
  $$,
  $$
    values (
      'assignee'::text,
      '00000000-0000-0000-0000-000000000503'::uuid
    )
  $$,
  'the security-definer create RPC routes to the assignee column'
);

select lives_ok(
  $$
    select public.create_request(
      'RPC append B',
      null,
      'Solicitante RPC',
      '00000000-0000-0000-0000-000000000503',
      null,
      1024
    )
  $$,
  'the create RPC accepts a repeated legacy client position'
);

select results_eq(
  $$
    select title, position
    from public.requests
    where title in ('RPC append A', 'RPC append B')
    order by position
  $$,
  $$
    values
      ('RPC append A'::text, 1024::numeric),
      ('RPC append B'::text, 2048::numeric)
  $$,
  'the create RPC appends atomically inside the resolved destination'
);

select lives_ok(
  $$
    select public.move_request(
      '00000000-0000-0000-0000-000000000502',
      'completed',
      2048
    )
  $$,
  'the legacy move RPC remains usable before lockdown'
);

select results_eq(
  $$
    select request.status, column_target.system_key
    from public.requests request
    join public.board_columns column_target on column_target.id = request.column_id
    where request.id = '00000000-0000-0000-0000-000000000502'
  $$,
  $$ values ('completed'::text, 'completed'::text) $$,
  'the legacy move RPC updates canonical and compatibility columns together'
);

set local "request.jwt.claims" =
  '{"sub":"00000000-0000-0000-0000-000000000504","role":"authenticated"}';
set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000504';

select is_empty(
  $$ select id from public.board_columns $$,
  'an unapproved authenticated user cannot read board columns through RLS'
);

select is_empty(
  $$ select id from public.requests $$,
  'an unapproved authenticated user cannot read requests through RLS'
);

select throws_ok(
  $$
    insert into public.requests (
      title, requester_name, assigned_to, status, position, created_by
    ) values (
      'Insert não aprovado',
      'Solicitante bloqueado',
      '00000000-0000-0000-0000-000000000503',
      'pending',
      1024,
      '00000000-0000-0000-0000-000000000504'
    )
  $$,
  '42501',
  null,
  'RLS rejects a direct INSERT from an unapproved authenticated user'
);

select throws_ok(
  $$
    select public.create_request(
      'RPC não aprovada',
      null,
      'Solicitante bloqueado',
      '00000000-0000-0000-0000-000000000503',
      null,
      1024
    )
  $$,
  '42501',
  null,
  'the create RPC rejects an unapproved authenticated user'
);

reset role;
select * from finish();
rollback;
