# Configuração do Supabase

1. Crie um projeto Supabase e copie a URL, a chave anon e a service role para um `.env.local` que nunca será versionado.
2. Instale a Supabase CLI e vincule o projeto: `npx supabase link --project-ref SEU_PROJECT_REF`.
3. Revise as migrations antes de aplicá-las. Para um projeto novo, sem aplicação legada em uso, `npx supabase db push` aplica todas as migrations pendentes. Para atualizar uma produção existente de `004` para as colunas de responsáveis, não use `db push` na primeira fase: ele também alcançaria `007`. Siga o procedimento de duas fases abaixo.
4. Em Authentication → Providers, mantenha apenas Email habilitado. Senha é o método principal; não habilite Google nem outros provedores sociais.
5. Se desejar confirmação de e-mail, mantenha “Confirm email” habilitado. O callback da aplicação já trata o código.
6. Em Authentication → URL Configuration, configure a Site URL e os redirects:
   - `http://localhost:3000/auth/callback`
   - `https://SEU-DOMINIO.vercel.app/auth/callback`
7. Cadastre a conta que será owner pelo formulário ou pelo painel Auth.
8. Execute o bootstrap com acesso administrativo ao PostgreSQL:

```powershell
psql "SUA_CONNECTION_STRING" -v owner_email="owner@empresa.com" -f supabase/scripts/bootstrap-owner.sql
```

9. Confirme em Database → Replication que `profiles`, `user_permissions`, `requests` e `board_columns` estão na publicação `supabase_realtime`. As migrations `202608290003_realtime.sql` e `202608290005_board_columns.sql` fazem isso de modo idempotente.
10. Teste com uma conta member: antes da aprovação ela deve ver apenas `/pending`; depois da aprovação, o dashboard.

Nunca use a service role em variável `NEXT_PUBLIC_*`, no navegador ou em logs.

## Rollout de colunas de responsáveis

As colunas `Pendente`, `Em progresso` e `Concluído` são fixas. Colunas extras são opcionais, vinculadas a um único perfil aprovado. O owner sempre pode usar `Gerenciar colunas`; membros aprovados precisam de `can_manage_columns = true`.

Use uma conexão direta de administrador em `SUPABASE_DB_URL`; não coloque a senha no repositório nem no histórico do shell. Antes de começar, faça o backup previsto pela política da equipe e interrompa o rollout se `npx supabase migration list` não mostrar `001`–`004` no remoto e `005`–`008` apenas no repositório local.

### Fase 1 — schema aditivo e aplicação nova

1. Antes de alterar o schema, valide as posições legadas em uma transação somente-leitura:

```powershell
psql $env:SUPABASE_DB_URL -X -v ON_ERROR_STOP=1 `
  -f supabase/scripts/verify-board-columns-legacy.sql
```

O resultado deve mostrar `unsafe_positions = 0`. O preflight interrompe o rollout se encontrar `NaN`, infinito ou valor acima de `9007199254740991` (`Number.MAX_SAFE_INTEGER`); corrija esses dados por um procedimento revisado antes de continuar.

2. Aplique somente `005` e `006`, juntas e em uma única transação. Este comando não lê a fila de migrations e, portanto, não pode avançar para `007`:

```powershell
psql $env:SUPABASE_DB_URL -X -v ON_ERROR_STOP=1 --single-transaction `
  -f supabase/migrations/202608290005_board_columns.sql `
  -f supabase/migrations/202608290006_board_column_rpcs.sql
```

3. Apenas depois de o `psql` terminar com código zero, registre exatamente essas duas versões no histórico remoto. `migration repair` altera somente o histórico; não executa SQL nem desfaz schema:

```powershell
npx supabase migration repair 202608290005 202608290006 --status applied --linked
npx supabase migration list
npx supabase db push --linked --dry-run
```

O `migration list` deve alinhar `001`–`006`, e o dry-run deve listar somente `202608290007_board_columns_lockdown.sql` e `202608300008_service_role_admin_grants.sql`, nesta ordem. Se mostrar qualquer outra migration, não execute o push: confira o projeto vinculado e repare o histórico somente depois de comparar o schema real.

4. Execute o preflight aditivo somente-leitura:

```powershell
psql $env:SUPABASE_DB_URL -X -v ON_ERROR_STOP=1 `
  -f supabase/scripts/verify-board-columns-additive.sql
```

Ele exige três colunas de sistema, backfill completo, posições finitas e seguras para JavaScript, `status` coerente, permissão nova, os RPCs novos e os dois caminhos legados ainda disponíveis. Qualquer exceção interrompe o rollout.

5. Publique a aplicação que usa `create_request` e `move_request(uuid,uuid,numeric)` e aguarde o deploy ficar Ready.
6. Com uma conta owner, verifique: as três colunas fixas; criação de uma lista de responsável; duas solicitações consecutivas nessa lista sem empate de posição; movimento para `Em progresso` preservando o responsável; chips `Todos`, `Em progresso` e do responsável; drag-and-drop com persistência após recarga; bloqueio de exclusão de lista ocupada; e liberação de `Gerenciar colunas` a um membro aprovado após atualizar a permissão.

### Fase 2 — lockdown

7. Confirme novamente que somente `007` e `008` estão pendentes e então aplique a fila. A `008` restaura os grants server-only necessários para listar, aprovar e editar usuários:

```powershell
npx supabase db push --linked --dry-run
npx supabase db push --linked
npx supabase migration list
```

Não continue se o dry-run listar algo além de `202608290007_board_columns_lockdown.sql` e `202608300008_service_role_admin_grants.sql`. Depois do push, `001`–`008` devem aparecer alinhadas no histórico local e remoto. No smoke test, aprove uma conta pendente, altere o nome e salve permissões; recarregue a página e confirme que os três valores persistiram.
8. Repita criação e movimentação, confira logs de Vercel e Supabase para erros 4xx/5xx e confirme que Realtime não duplica colunas ou cartões. Confirme também que `authenticated` já não possui INSERT direto em `public.requests` e que `move_request(uuid,text,numeric)` não existe.

Em incidente ou falha antes do lockdown, mantenha `007` sem aplicar e corrija/republique a aplicação; não marque `007` como aplicada nem use `migration repair` para esconder uma execução incompleta. O `requests.status` legado continua nulo em listas de responsável e sincronizado com a chave da coluna fixa; ele não deve ser removido nesta entrega.
