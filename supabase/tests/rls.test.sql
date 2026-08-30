begin;
select plan(86);

select has_table('public', 'profiles', 'profiles existe');
select has_table('public', 'user_permissions', 'user_permissions existe');
select has_table('public', 'requests', 'requests existe');
select col_is_pk('public', 'profiles', 'id', 'profiles.id é chave primária');
select col_is_pk('public', 'user_permissions', 'user_id', 'permissões têm uma linha por usuário');
select has_function('public', 'is_approved', array['uuid'], 'função de aprovação existe');
select has_function('public', 'update_request_content', array['uuid','text','text','text','uuid','text'], 'RPC de edição existe');
select hasnt_function('public', 'move_request', array['uuid','text','numeric'], 'RPC legada de movimentação foi removida');

select has_function('public', 'has_column_management_permission', array[]::text[], 'função de permissão de colunas existe');
select has_function('public', 'create_board_column', array['text','uuid','numeric'], 'RPC de criação de coluna existe');
select has_function('public', 'rename_board_column', array['uuid','text'], 'RPC de renomeação de coluna existe');
select has_function('public', 'reorder_board_column', array['uuid','numeric'], 'RPC de ordenação de coluna existe');
select has_function('public', 'delete_board_column', array['uuid'], 'RPC de exclusão de coluna existe');
select has_function('public', 'create_request', array['text','text','text','uuid','text','numeric'], 'RPC de criação de solicitação existe');
select has_function('public', 'move_request', array['uuid','uuid','numeric'], 'RPC move por coluna existe');

select function_privs_are('public', 'has_column_management_permission', array[]::text[], 'authenticated', array['EXECUTE'], 'autenticados consultam permissão de colunas');
select function_privs_are('public', 'has_column_management_permission', array[]::text[], 'public', array[]::text[], 'público não consulta permissão de colunas');
select function_privs_are('public', 'create_board_column', array['text','uuid','numeric'], 'authenticated', array['EXECUTE'], 'autenticados executam criação de coluna');
select function_privs_are('public', 'create_board_column', array['text','uuid','numeric'], 'public', array[]::text[], 'público não executa criação de coluna');
select function_privs_are('public', 'rename_board_column', array['uuid','text'], 'authenticated', array['EXECUTE'], 'autenticados executam renomeação de coluna');
select function_privs_are('public', 'rename_board_column', array['uuid','text'], 'public', array[]::text[], 'público não executa renomeação de coluna');
select function_privs_are('public', 'reorder_board_column', array['uuid','numeric'], 'authenticated', array['EXECUTE'], 'autenticados executam ordenação de coluna');
select function_privs_are('public', 'reorder_board_column', array['uuid','numeric'], 'public', array[]::text[], 'público não executa ordenação de coluna');
select function_privs_are('public', 'delete_board_column', array['uuid'], 'authenticated', array['EXECUTE'], 'autenticados executam exclusão de coluna');
select function_privs_are('public', 'delete_board_column', array['uuid'], 'public', array[]::text[], 'público não executa exclusão de coluna');
select function_privs_are('public', 'create_request', array['text','text','text','uuid','text','numeric'], 'authenticated', array['EXECUTE'], 'autenticados executam criação de solicitação');
select function_privs_are('public', 'create_request', array['text','text','text','uuid','text','numeric'], 'public', array[]::text[], 'público não executa criação de solicitação');
select function_privs_are('public', 'move_request', array['uuid','uuid','numeric'], 'authenticated', array['EXECUTE'], 'autenticados executam movimento por coluna');
select function_privs_are('public', 'move_request', array['uuid','uuid','numeric'], 'public', array[]::text[], 'público não executa movimento por coluna');
select function_privs_are('public', 'update_request_content', array['uuid','text','text','text','uuid','text'], 'authenticated', array['EXECUTE'], 'autenticados executam edição de solicitação');
select function_privs_are('public', 'update_request_content', array['uuid','text','text','text','uuid','text'], 'public', array[]::text[], 'público não executa edição de solicitação');
select is(
  to_regprocedure('public.move_request(uuid,text,numeric)'),
  null::regprocedure,
  'catálogo não localiza a sobrecarga legada de movimentação'
);
select is_empty(
  $$
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'move_request'
      and oidvectortypes(procedure.proargtypes) = 'uuid, text, numeric'
  $$,
  'catálogo não contém a sobrecarga legada de movimentação'
);

select ok(has_schema_privilege('authenticated', 'public', 'usage'), 'usuários autenticados acessam o schema público');
select ok(has_table_privilege('authenticated', 'public.profiles', 'select'), 'usuários autenticados podem ler perfis conforme RLS');
select ok(has_table_privilege('authenticated', 'public.user_permissions', 'select'), 'usuários autenticados podem ler permissões conforme RLS');
select ok(has_table_privilege('authenticated', 'public.requests', 'select'), 'usuários autenticados podem ler solicitações conforme RLS');
select ok(not has_table_privilege('authenticated', 'public.requests', 'insert'), 'usuários autenticados não inserem solicitações diretamente');
select ok(has_table_privilege('authenticated', 'public.requests', 'delete'), 'usuários autenticados podem excluir solicitações conforme RLS');

select has_table('public', 'board_columns', 'board_columns existe');
select has_column('public', 'requests', 'column_id', 'requests possui column_id');
select has_column('public', 'user_permissions', 'can_manage_columns', 'permissão de colunas existe');
select ok(has_table_privilege('authenticated', 'public.board_columns', 'select'), 'autenticados leem colunas');
select results_eq(
  $$ select count(*)::bigint from public.board_columns where kind = 'system' $$,
  array[3::bigint],
  'existem três colunas de sistema'
);
select is_empty(
  $$ select id from public.requests where column_id is null $$,
  'todas as solicitações foram migradas'
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-000000000201',
  'legacy-move@example.com',
  '{"full_name":"Movimentador legado"}'
);

update public.profiles
set role = 'owner', approval_status = 'approved'
where id = '00000000-0000-0000-0000-000000000201';

insert into public.requests (
  id, title, requester_name, assigned_to, status, position, created_by
) values (
  '00000000-0000-0000-0000-000000000202',
  'Solicitação legada',
  'Solicitante legado',
  '00000000-0000-0000-0000-000000000201',
  'pending',
  1024,
  '00000000-0000-0000-0000-000000000201'
);

do $$ begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000201',
    true
  );
end $$;

select throws_ok(
  $$
    select public.move_request(
      '00000000-0000-0000-0000-000000000202',
      'in_progress'::text,
      2048
    )
  $$,
  '42883',
  null,
  'RPC legada de movimentação foi removida após o lockdown'
);

insert into public.board_columns (
  id, name, kind, assignee_id, position, created_by
) values (
  '00000000-0000-0000-0000-000000000203',
  'Movimentador legado',
  'assignee',
  '00000000-0000-0000-0000-000000000201',
  4096,
  '00000000-0000-0000-0000-000000000201'
);

update public.requests
set column_id = '00000000-0000-0000-0000-000000000203'
where id = '00000000-0000-0000-0000-000000000202';

select results_eq(
  $$
    select request.status, request.column_id, column_target.kind
    from public.requests request
    join public.board_columns column_target on column_target.id = request.column_id
    where request.id = '00000000-0000-0000-0000-000000000202'
  $$,
  $$
    values (
      null::text,
      '00000000-0000-0000-0000-000000000203'::uuid,
      'assignee'::text
    )
  $$,
  'movimento canônico para responsável preserva column_id e status nulo'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000301', 'owner-rpc@example.com', '{"full_name":"Owner RPC"}'),
  ('00000000-0000-0000-0000-000000000302', 'manager-rpc@example.com', '{"full_name":"Gestor RPC"}'),
  ('00000000-0000-0000-0000-000000000303', 'member-rpc@example.com', '{"full_name":"Membro RPC"}'),
  ('00000000-0000-0000-0000-000000000304', 'mover-rpc@example.com', '{"full_name":"Movimentador RPC"}'),
  ('00000000-0000-0000-0000-000000000305', 'plain-rpc@example.com', '{"full_name":"Membro sem permissão"}'),
  ('00000000-0000-0000-0000-000000000306', 'pending-rpc@example.com', '{"full_name":"Membro pendente"}'),
  ('00000000-0000-0000-0000-000000000307', 'boundary-rpc@example.com', '{"full_name":"Responsável limite"}'),
  ('00000000-0000-0000-0000-000000000308', 'below-rpc@example.com', '{"full_name":"Responsável abaixo"}'),
  ('00000000-0000-0000-0000-000000000309', 'nan-rpc@example.com', '{"full_name":"Responsável NaN"}');

update public.profiles
set role = 'owner', approval_status = 'approved'
where id = '00000000-0000-0000-0000-000000000301';

update public.profiles
set approval_status = 'approved'
where id in (
  '00000000-0000-0000-0000-000000000302',
  '00000000-0000-0000-0000-000000000303',
  '00000000-0000-0000-0000-000000000304',
  '00000000-0000-0000-0000-000000000305',
  '00000000-0000-0000-0000-000000000307',
  '00000000-0000-0000-0000-000000000308',
  '00000000-0000-0000-0000-000000000309'
);

update public.user_permissions
set can_manage_columns = true
where user_id in (
  '00000000-0000-0000-0000-000000000302',
  '00000000-0000-0000-0000-000000000306'
);

update public.user_permissions
set can_edit_requests = true, can_move_requests = true
where user_id = '00000000-0000-0000-0000-000000000304';

do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);
end $$;

select ok(public.has_column_management_permission(), 'owner aprovado gerencia colunas');

select results_eq(
  $$
    select created.name, created.kind, created.assignee_id, created.position, created.created_by
    from public.create_board_column(
      '  Gestão  ',
      '00000000-0000-0000-0000-000000000302',
      4096
    ) created
  $$,
  $$
    values (
      'Gestão'::text,
      'assignee'::text,
      '00000000-0000-0000-0000-000000000302'::uuid,
      4096::numeric,
      '00000000-0000-0000-0000-000000000301'::uuid
    )
  $$,
  'owner cria coluna vinculada com dados normalizados'
);

do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000302', true);
end $$;

select ok(public.has_column_management_permission(), 'membro aprovado com permissão gerencia colunas');

select results_eq(
  $$
    select created.name, created.kind, created.assignee_id, created.position, created.created_by
    from public.create_board_column(
      'Operações',
      '00000000-0000-0000-0000-000000000303',
      5120
    ) created
  $$,
  $$
    values (
      'Operações'::text,
      'assignee'::text,
      '00000000-0000-0000-0000-000000000303'::uuid,
      5120::numeric,
      '00000000-0000-0000-0000-000000000302'::uuid
    )
  $$,
  'membro autorizado cria coluna vinculada'
);

do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000305', true);
end $$;

select ok(not public.has_column_management_permission(), 'membro aprovado sem permissão não gerencia colunas');

select throws_ok(
  $$ select public.create_board_column('Bloqueada', '00000000-0000-0000-0000-000000000305', 6144) $$,
  '42501',
  null,
  'membro sem permissão não cria coluna'
);

do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000306', true);
end $$;

select ok(not public.has_column_management_permission(), 'membro não aprovado não gerencia colunas mesmo com permissão gravada');

do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);
end $$;

select throws_ok(
  $$ select public.create_board_column('Duplicada', '00000000-0000-0000-0000-000000000302', 6144) $$,
  '23505',
  null,
  'responsável não recebe segunda coluna'
);

select throws_ok(
  $$ select public.create_board_column(' ', '00000000-0000-0000-0000-000000000305', 6144) $$,
  '23514',
  null,
  'nome inválido é recusado'
);

select throws_ok(
  $$ select public.create_board_column('Negativa', '00000000-0000-0000-0000-000000000305', -1) $$,
  '23514',
  null,
  'posição negativa é recusada na criação'
);

select throws_ok(
  $$ select public.create_board_column('No limite', '00000000-0000-0000-0000-000000000307', 3072) $$,
  '23514',
  null,
  'coluna de responsável não pode empatar com a última coluna de sistema'
);

select throws_ok(
  $$ select public.create_board_column('Abaixo do limite', '00000000-0000-0000-0000-000000000308', 2048) $$,
  '23514',
  null,
  'coluna de responsável não pode ficar antes da última coluna de sistema'
);

select throws_ok(
  $$ select public.create_board_column('Posição NaN', '00000000-0000-0000-0000-000000000309', 'NaN'::numeric) $$,
  '23514',
  null,
  'criação de coluna recusa posição NaN'
);

select throws_ok(
  $$ select public.create_board_column('Pendente', '00000000-0000-0000-0000-000000000306', 6144) $$,
  '23514',
  null,
  'responsável não aprovado é recusado'
);

select results_eq(
  $$
    select renamed.name, renamed.assignee_id
    from public.rename_board_column(
      (select id from public.board_columns where assignee_id = '00000000-0000-0000-0000-000000000303'),
      '  Entregas  '
    ) renamed
  $$,
  $$ values ('Entregas'::text, '00000000-0000-0000-0000-000000000303'::uuid) $$,
  'renomeação devolve coluna atualizada'
);

select results_eq(
  $$
    select reordered.position, reordered.assignee_id
    from public.reorder_board_column(
      (select id from public.board_columns where assignee_id = '00000000-0000-0000-0000-000000000303'),
      7168
    ) reordered
  $$,
  $$ values (7168::numeric, '00000000-0000-0000-0000-000000000303'::uuid) $$,
  'reordenação devolve coluna atualizada'
);

select results_eq(
  $$
    select reordered.position
    from public.reorder_board_column(
      (select id from public.board_columns where assignee_id = '00000000-0000-0000-0000-000000000303'),
      2560
    ) reordered
  $$,
  $$ values (2560::numeric) $$,
  'reordenação pode colocar responsável entre Em progresso e Concluído'
);

select results_eq(
  $$
    select reordered.position
    from public.reorder_board_column(
      (select id from public.board_columns where assignee_id = '00000000-0000-0000-0000-000000000303'),
      512
    ) reordered
  $$,
  $$ values (512::numeric) $$,
  'reordenação pode colocar responsável antes das colunas de sistema'
);

select throws_ok(
  $$
    select public.reorder_board_column(
      (select id from public.board_columns where assignee_id = '00000000-0000-0000-0000-000000000303'),
      'NaN'::numeric
    )
  $$,
  '23514',
  null,
  'reordenação recusa posição NaN'
);

select throws_ok(
  $$
    select public.rename_board_column(
      (select id from public.board_columns where system_key = 'pending'),
      'Outro nome'
    )
  $$,
  '23514',
  null,
  'coluna de sistema não pode ser renomeada'
);

select throws_ok(
  $$
    select public.reorder_board_column(
      (select id from public.board_columns where system_key = 'pending'),
      8192
    )
  $$,
  '23514',
  null,
  'coluna de sistema não pode ser reordenada'
);

select throws_ok(
  $$
    select public.delete_board_column(
      (select id from public.board_columns where system_key = 'pending')
    )
  $$,
  '23514',
  null,
  'coluna de sistema não pode ser excluída'
);

do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000305', true);
end $$;

select throws_ok(
  $$
    select public.create_request(
      'Pedido bloqueado',
      null,
      'Solicitante bloqueado',
      '00000000-0000-0000-0000-000000000302',
      null,
      1024
    )
  $$,
  '42501',
  null,
  'membro sem permissão não cria solicitação por RPC'
);

do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);
end $$;

select results_eq(
  $$
    select
      created.title,
      target.assignee_id = created.assigned_to,
      created.created_by,
      created.status
    from public.create_request(
      '  Pedido direcionado  ',
      '  Descrição  ',
      '  Solicitante  ',
      '00000000-0000-0000-0000-000000000302',
      'https://example.com/pedido',
      1024
    ) created
    join public.board_columns target on target.id = created.column_id
  $$,
  $$
    values (
      'Pedido direcionado'::text,
      true,
      '00000000-0000-0000-0000-000000000301'::uuid,
      null::text
    )
  $$,
  'solicitação nasce na coluna do responsável'
);

select lives_ok(
  $$
    select public.create_request(
      'Pedido direcionado repetido',
      null,
      'Solicitante repetido',
      '00000000-0000-0000-0000-000000000302',
      null,
      1024
    )
  $$,
  'criação aceita a posição legada repetida na mesma coluna'
);

select results_eq(
  $$
    select title, position
    from public.requests
    where title in ('Pedido direcionado', 'Pedido direcionado repetido')
    order by position
  $$,
  $$
    values
      ('Pedido direcionado'::text, 1024::numeric),
      ('Pedido direcionado repetido'::text, 2048::numeric)
  $$,
  'criação calcula posições de append sem empate na coluna resolvida'
);

select results_eq(
  $$
    select
      created.title,
      target.system_key,
      created.created_by,
      created.status
    from public.create_request(
      'Pedido pendente',
      null,
      'Solicitante fallback',
      '00000000-0000-0000-0000-000000000304',
      null,
      2048
    ) created
    join public.board_columns target on target.id = created.column_id
  $$,
  $$
    values (
      'Pedido pendente'::text,
      'pending'::text,
      '00000000-0000-0000-0000-000000000301'::uuid,
      'pending'::text
    )
  $$,
  'solicitação sem coluna vinculada nasce em Pendente'
);

select throws_ok(
  $$
    select public.create_request(
      ' ', null, 'Solicitante',
      '00000000-0000-0000-0000-000000000304', null, 1024
    )
  $$,
  '23514',
  null,
  'título inválido é recusado'
);

select throws_ok(
  $$
    select public.create_request(
      'Pedido URL', null, 'Solicitante',
      '00000000-0000-0000-0000-000000000304', 'ftp://example.com', 1024
    )
  $$,
  '23514',
  null,
  'URL inválida é recusada'
);

select throws_ok(
  $$
    select public.create_request(
      'Pedido negativo', null, 'Solicitante',
      '00000000-0000-0000-0000-000000000304', null, -1
    )
  $$,
  '23514',
  null,
  'posição negativa é recusada na solicitação'
);

select throws_ok(
  $$
    select public.create_request(
      'Pedido NaN', null, 'Solicitante',
      '00000000-0000-0000-0000-000000000304', null, 'NaN'::numeric
    )
  $$,
  '23514',
  null,
  'criação de solicitação recusa posição NaN'
);

do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000304', true);
end $$;

select results_eq(
  $$
    select
      moved.column_id = target.id,
      moved.position,
      target.kind,
      moved.status
    from public.move_request(
      (select id from public.requests where title = 'Pedido pendente'),
      (select id from public.board_columns where assignee_id = '00000000-0000-0000-0000-000000000303'),
      1536
    ) moved
    join public.board_columns target on target.id = moved.column_id
  $$,
  $$ values (true, 1536::numeric, 'assignee'::text, null::text) $$,
  'movimento retorna a solicitação na nova coluna'
);

select throws_ok(
  $$
    select public.move_request(
      (select id from public.requests where title = 'Pedido pendente'),
      (select id from public.board_columns where system_key = 'pending'),
      -1
    )
  $$,
  '23514',
  null,
  'movimento com posição negativa é recusado'
);

select throws_ok(
  $$
    select public.move_request(
      (select id from public.requests where title = 'Pedido pendente'),
      (select id from public.board_columns where system_key = 'pending'),
      'NaN'::numeric
    )
  $$,
  '23514',
  null,
  'movimento recusa posição NaN'
);

select throws_ok(
  $$
    select public.move_request(
      (select id from public.requests where title = 'Pedido pendente'),
      '00000000-0000-0000-0000-000000000399',
      1024
    )
  $$,
  '23503',
  null,
  'movimento para coluna inexistente é recusado'
);

select results_eq(
  $$
    select
      edited.column_id = pending_column.id,
      edited.assigned_to,
      edited.status
    from public.update_request_content(
      (select id from public.requests where title = 'Pedido pendente'),
      'Pedido redirecionado',
      '',
      'Solicitante atualizado',
      '00000000-0000-0000-0000-000000000305',
      ''
    ) edited
    cross join public.board_columns pending_column
    where pending_column.system_key = 'pending'
  $$,
  $$
    values (
      true,
      '00000000-0000-0000-0000-000000000305'::uuid,
      'pending'::text
    )
  $$,
  'troca de responsável em coluna vinculada usa fallback Pendente'
);

select results_eq(
  $$
    select
      edited.column_id = pending_column.id,
      edited.assigned_to,
      edited.status
    from public.update_request_content(
      (select id from public.requests where title = 'Pedido redirecionado'),
      'Pedido fixo',
      null,
      'Solicitante fixo',
      '00000000-0000-0000-0000-000000000303',
      null
    ) edited
    cross join public.board_columns pending_column
    where pending_column.system_key = 'pending'
  $$,
  $$
    values (
      true,
      '00000000-0000-0000-0000-000000000303'::uuid,
      'pending'::text
    )
  $$,
  'troca de responsável em coluna fixa preserva column_id'
);

do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);
end $$;

select throws_ok(
  $$
    select public.delete_board_column(
      (select id from public.board_columns where assignee_id = '00000000-0000-0000-0000-000000000302')
    )
  $$,
  '23503',
  null,
  'coluna ocupada não pode ser excluída'
);

select results_eq(
  $$
    select deleted.assignee_id
    from public.delete_board_column(
      (select id from public.board_columns where assignee_id = '00000000-0000-0000-0000-000000000303')
    ) deleted
  $$,
  $$ values ('00000000-0000-0000-0000-000000000303'::uuid) $$,
  'coluna vazia é excluída e devolvida'
);

select * from finish();
rollback;
