begin;
select plan(14);

select has_table('public', 'profiles', 'profiles existe');
select has_table('public', 'user_permissions', 'user_permissions existe');
select has_table('public', 'requests', 'requests existe');
select col_is_pk('public', 'profiles', 'id', 'profiles.id é chave primária');
select col_is_pk('public', 'user_permissions', 'user_id', 'permissões têm uma linha por usuário');
select has_function('public', 'is_approved', array['uuid'], 'função de aprovação existe');
select has_function('public', 'update_request_content', array['uuid','text','text','text','uuid','text'], 'RPC de edição existe');
select has_function('public', 'move_request', array['uuid','text','numeric'], 'RPC de movimentação existe');

select ok(has_schema_privilege('authenticated', 'public', 'usage'), 'usuários autenticados acessam o schema público');
select ok(has_table_privilege('authenticated', 'public.profiles', 'select'), 'usuários autenticados podem ler perfis conforme RLS');
select ok(has_table_privilege('authenticated', 'public.user_permissions', 'select'), 'usuários autenticados podem ler permissões conforme RLS');
select ok(has_table_privilege('authenticated', 'public.requests', 'select'), 'usuários autenticados podem ler solicitações conforme RLS');
select ok(has_table_privilege('authenticated', 'public.requests', 'insert'), 'usuários autenticados podem criar solicitações conforme RLS');
select ok(has_table_privilege('authenticated', 'public.requests', 'delete'), 'usuários autenticados podem excluir solicitações conforme RLS');

select * from finish();
rollback;

