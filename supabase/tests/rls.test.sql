begin;
select plan(8);

select has_table('public', 'profiles', 'profiles existe');
select has_table('public', 'user_permissions', 'user_permissions existe');
select has_table('public', 'requests', 'requests existe');
select col_is_pk('public', 'profiles', 'id', 'profiles.id é chave primária');
select col_is_pk('public', 'user_permissions', 'user_id', 'permissões têm uma linha por usuário');
select has_function('public', 'is_approved', array['uuid'], 'função de aprovação existe');
select has_function('public', 'update_request_content', array['uuid','text','text','text','uuid','text'], 'RPC de edição existe');
select has_function('public', 'move_request', array['uuid','text','numeric'], 'RPC de movimentação existe');

select * from finish();
rollback;
