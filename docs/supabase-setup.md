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

## Rollout de cidades nas solicitações

Este rollout parte de uma produção com `001`–`011` já aplicadas e exige duas fases. Use uma conexão direta de administrador em `SUPABASE_DB_URL`, faça o backup previsto pela política da equipe e confirme o projeto vinculado com `npx supabase migration list` antes de executar SQL.

> **Proibido:** não execute um `npx supabase db push` completo ou sem revisar a fila antes de publicar a aplicação compatível com cidades. Um push cego pode aplicar `012` e `013` juntos, revogar os RPCs legados enquanto a aplicação antiga ainda os chama e interromper criação e edição de solicitações.

### Fase 1 — migration 012, aplicação e smoke test

1. Confirme que `001`–`011` estão alinhadas entre local e remoto e que `012` e `013` ainda estão pendentes. Se houver qualquer outra divergência, pare e investigue; não use `migration repair` para esconder schema não aplicado.
2. Aplique **somente** a migration aditiva `012`, em uma transação. O comando abaixo nomeia o arquivo diretamente e não percorre a fila de migrations:

```powershell
psql $env:SUPABASE_DB_URL -X -v ON_ERROR_STOP=1 --single-transaction `
  -f supabase/migrations/202608300012_cities_additive.sql
```

3. Depois de o `psql` terminar com código zero, registre `012` no histórico remoto e confira novamente a fila:

```powershell
npx supabase migration repair 202608300012 --status applied --linked
npx supabase migration list
npx supabase db push --linked --dry-run
```

O dry-run deve listar somente `202608300013_cities_lockdown.sql`. Não execute o push: nesta etapa, `013` deve continuar pendente.

4. Publique os commits da aplicação que usam exclusivamente `create_request_with_cities` e `update_request_with_cities`; aguarde o deploy ficar Ready antes de prosseguir.
5. Execute o smoke test pré-lockdown com contas de owner, membro autorizado e membro sem permissão:
   - crie uma solicitação com uma e com várias cidades, edite a seleção e recarregue a página para confirmar persistência;
   - no admin, crie e renomeie uma cidade, desative/reative a cidade e confirme os bloqueios de permissão;
   - em duas sessões, confirme que eventos Realtime de `cities` e `request_cities` atualizam nomes, status, vínculos, cartões e contagens sem duplicação;
   - confira logs da aplicação e do Supabase e interrompa o rollout se houver erro inesperado 4xx/5xx.

### Fase 2 — migration 013 e smoke test final

6. Somente depois de o deploy e todo o smoke test da fase 1 passarem, aplique **somente** a migration `013`:

```powershell
psql $env:SUPABASE_DB_URL -X -v ON_ERROR_STOP=1 --single-transaction `
  -f supabase/migrations/202608300013_cities_lockdown.sql
```

7. Depois de o `psql` terminar com código zero, registre `013` e confirme que não restou migration pendente:

```powershell
npx supabase migration repair 202608300013 --status applied --linked
npx supabase migration list
npx supabase db push --linked --dry-run
```

8. Repita o smoke test de criação, edição, administração e Realtime. Confirme também que `authenticated` não executa mais `create_request(text,text,text,uuid,text,numeric,text[])` nem `update_request_content(uuid,text,text,text,uuid,text,text[])`, enquanto `create_request_with_cities(text,text,uuid,text,numeric,text[],uuid[])` e `update_request_with_cities(uuid,text,text,uuid,text,text[],uuid[])` continuam executáveis.

### Recuperação e rollback

- Se a aplicação ou o smoke test falhar antes de `013`, não aplique o lockdown. A migration `012` é aditiva: mantenha-a aplicada, restaure a versão anterior da aplicação se necessário e corrija o deploy antes de retomar. Não marque `013` como aplicada.
- Se `013` já estiver aplicada e for indispensável restaurar temporariamente a aplicação antiga, reverta primeiro o efeito do lockdown em uma transação auditada:

```sql
begin;
grant execute on function public.create_request(text,text,text,uuid,text,numeric,text[]) to authenticated;
grant execute on function public.update_request_content(uuid,text,text,text,uuid,text,text[]) to authenticated;
commit;
```

Depois, restaure a aplicação anterior e repita os smokes de criação e edição. Registre esse `GRANT` como uma nova migration de recuperação; não apague nem edite `013` e não use `migration repair` para declarar um estado diferente do schema real. A reabertura dos RPCs legados reduz as garantias de cidades e deve durar apenas até a aplicação city-aware voltar a ser publicada e um novo lockdown revisado ser aplicado.

## Reparação do catálogo inicial de cidades — migration 014

A migration `202608300014_repair_canonical_cities.sql` corrige exclusivamente o catálogo produzido pela `012`. Imediatamente após sua aplicação, o catálogo contém, ativas, somente estas 14 cidades: `Nobre`, `Santa`, `Maresia`, `Grande`, `Fronteira`, `Real`, `Prime`, `Malta`, `Liberty99`, `District99`, `Krown`, `KNG`, `Royal` e `Orizon`. UUIDs e vínculos de nomes canônicos já existentes são preservados. Vínculos com outros nomes e as respectivas cidades são removidos sem tentar inferir uma cidade substituta; `requests.requester_name` permanece intacto. A migration não altera RPCs, permissões ou restrições de criação, portanto o catálogo volta a aceitar cidades dinâmicas normalmente depois do commit.

Esse reparo remove dados relacionais. Faça backup e agende uma janela curta de manutenção. Se a Supabase CLI estiver disponível e o projeto correto estiver vinculado, confirme que `001`–`013` estão alinhadas no histórico remoto e que `014` e `015` são as únicas migrations pendentes. A `015` deve permanecer pendente nesta etapa:

```powershell
npx supabase migration list
npx supabase db push --linked --dry-run
```

O dry-run deve listar `202608300014_repair_canonical_cities.sql` antes de `202608300015_custom_board_columns.sql`, sem nenhuma outra migration. Sem CLI, registre essa limitação no controle de mudanças e preserve a reconciliação do histórico como pendência antes de qualquer futuro `db push`; isso não impede o rollout manual pelo SQL Editor. Em seguida, faça um inventário dos dados que serão removidos e guarde o resultado junto ao registro do rollout:

```sql
select city.id, city.name, count(link.request_id) as request_links
from public.cities city
left join public.request_cities link on link.city_id = city.id
where lower(trim(city.name)) not in (
  'nobre', 'santa', 'maresia', 'grande', 'fronteira', 'real', 'prime',
  'malta', 'liberty99', 'district99', 'krown', 'kng', 'royal', 'orizon'
)
group by city.id, city.name
order by lower(trim(city.name)), city.id;
```

Interrompa o rollout se algum nome fora da lista representar uma cidade válida que precise ser conservada: a decisão de mapeamento deve ser revisada em uma nova migration, nunca improvisada durante a execução. Com a aplicação em manutenção, aplique somente `014`. O arquivo já delimita sua própria transação, bloqueia escritas concorrentes nas tabelas envolvidas e aborta integralmente se as validações de catálogo, vínculos preservados ou `requester_name` falharem:

```powershell
psql $env:SUPABASE_DB_URL -X -v ON_ERROR_STOP=1 `
  -f supabase/migrations/202608300014_repair_canonical_cities.sql
```

Como alternativa completa quando `psql` não estiver disponível, abra o SQL Editor do projeto correto, cole **todo** o conteúdo de `supabase/migrations/202608300014_repair_canonical_cities.sql`, execute-o uma única vez e guarde o resultado da execução. Não copie apenas trechos: a migration contém sua própria transação e validações.

Após uma execução bem-sucedida por `psql` ou SQL Editor, valide a `014` antes de seguir para a `015`:

```sql
select name
from public.cities
where active
order by name;

select count(*) as noncanonical_links
from public.request_cities link
join public.cities city on city.id = link.city_id
where city.name not in (
  'Nobre', 'Santa', 'Maresia', 'Grande', 'Fronteira', 'Real', 'Prime',
  'Malta', 'Liberty99', 'District99', 'Krown', 'KNG', 'Royal', 'Orizon'
);
```

O primeiro resultado deve conter exatamente as 14 cidades canônicas e o segundo deve ser `0`. Solicitações que só possuíam vínculos removidos ficam sem cidade; a aplicação deve exibir `Não definida`. Não as associe em massa: revise cada caso e selecione uma cidade somente quando houver informação de negócio confiável.

Executar SQL manualmente **não** atualiza `supabase_migrations.schema_migrations`. Se a CLI estiver disponível, somente depois de confirmar o sucesso do SQL da `014`, reconcilie esta versão e confira a fila:

```powershell
npx supabase migration repair 202608300014 --status applied --linked
npx supabase migration list
npx supabase db push --linked --dry-run
```

O `migration list` deve alinhar `001`–`014`; o dry-run deve listar apenas `202608300015_custom_board_columns.sql`. Não execute `db push` nesta etapa. Se a CLI continuar indisponível, não tente editar o histórico manualmente: mantenha a reconciliação de `014` registrada como pendência obrigatória antes de um futuro `db push` e prossiga somente pelo SQL Editor para a validação e a `015` descritas abaixo. Faça o smoke test com uma conta autorizada: abra solicitações que já tinham vínculos canônicos, crie uma cidade temporária pela interface e confirme que ela aparece no seletor. Renomeie, desative e reative essa cidade para provar que a gestão continua dinâmica.

Se a execução falhar, a própria transação faz rollback e a versão `014` não deve ser marcada como aplicada. Depois do commit, a recuperação exige restaurar o backup ou aplicar uma nova migration revisada; não edite `012`–`014` e não use `migration repair` para mascarar divergência entre histórico e schema.

## Rollout de listas personalizadas — migration 015

Execute esta etapa somente depois de aplicar e validar a reparação de cidades `014`. A migration `202608300015_custom_board_columns.sql` é aditiva: permite `board_columns.kind = 'custom'`, exige que listas personalizadas não tenham `system_key` nem `assignee_id`, adiciona `create_custom_board_column(text,numeric)` e permite reordenar também as listas de sistema. Ela não libera renomear nem excluir listas de sistema.

1. Com o backup, o preflight e a validação da `014` registrados, confirme pela CLI, quando disponível, que `001`–`014` estão alinhadas e que apenas a `015` aparece pendente. Sem CLI, mantenha a pendência de reconciliação de `014` registrada e não faça `db push` até resolvê-la.

```powershell
npx supabase migration list
npx supabase db push --linked --dry-run
```

2. Aplique somente a `015`, depois de validar a `014`. O arquivo já delimita sua própria transação:

```powershell
psql $env:SUPABASE_DB_URL -X -v ON_ERROR_STOP=1 `
  -f supabase/migrations/202608300015_custom_board_columns.sql
```

Quando não houver `psql`, abra o SQL Editor do projeto correto, cole **todo** o conteúdo de `supabase/migrations/202608300015_custom_board_columns.sql`, execute-o uma única vez e guarde o resultado. Essa execução manual também não atualiza `supabase_migrations.schema_migrations`.

3. Após uma execução bem-sucedida por `psql` ou SQL Editor, valide no banco antes de publicar:

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.board_columns'::regclass
  and conname in ('board_columns_kind_check', 'board_columns_shape')
order by conname;

select
  to_regprocedure('public.create_custom_board_column(text,numeric)') as create_custom,
  to_regprocedure('public.reorder_board_column(uuid,numeric)') as reorder_column;
```

Os dois constraints devem existir: `board_columns_kind_check` aceita somente `system`, `assignee` e `custom`; `board_columns_shape` exige `system_key` e veda responsável para `system`, exige responsável e veda chave de sistema para `assignee`, e deixa ambos nulos para `custom`. As duas funções devem resolver. Como um usuário autorizado, crie uma lista personalizada pela RPC `create_custom_board_column(text,numeric)`, confirme que ela retorna `kind = 'custom'` sem chave de sistema ou responsável, e remova-a se estiver vazia. Confirme também que `reorder_board_column(uuid,numeric)` reordena uma coluna de sistema, enquanto `rename_board_column` e `delete_board_column` continuam recusando uma coluna de sistema.

4. Se a CLI estiver disponível e o SQL da `015` foi confirmado, reconcilie somente essa versão e confira que não há migrations pendentes:

```powershell
npx supabase migration repair 202608300015 --status applied --linked
npx supabase migration list
npx supabase db push --linked --dry-run
```

O `migration list` deve alinhar `001`–`015` e o dry-run não deve listar migrations. Se a CLI continuar indisponível, não tente inserir ou alterar `supabase_migrations.schema_migrations` pelo SQL Editor: registre a reconciliação de `014` e `015` como pendência obrigatória antes do próximo `db push`. Isso não bloqueia a publicação manual da aplicação já validada.

5. Só então publique a versão da aplicação correspondente à migration `015` e aguarde o deploy ficar Ready. Não publique uma aplicação que ainda presume que as três listas de sistema ficam sempre na mesma posição.

6. No smoke test final, com um usuário autorizado, crie os dois tipos em `+ Adicionar outra lista` (`Responsável` e `Personalizada`); o responsável deve vir apenas da lista de perfis aprovados e cada solicitação deve exigir exatamente um responsável. Renomeie e exclua uma lista personalizada vazia, confirme que as listas de sistema não mostram essas ações e reordene listas de sistema, de responsável e personalizadas pelo cabeçalho. Arraste um cartão entre listas, force uma falha de rede para conferir a restauração otimista, recarregue para confirmar persistência e confirme que o preview de coluna é distinto do preview de cartão. Por fim, verifique que o cabeçalho permanece visível e que os cartões usam rolagem interna após aproximadamente cinco itens.

Em caso de falha da `015`, a transação faz rollback e ela não deve ser marcada como aplicada. Depois do commit, corrija o problema em uma nova migration revisada; não edite `015` nem use `migration repair` para declarar um schema que não existe.

## Rollout de ordem manual das cidades — migration 016

Execute esta etapa somente depois de aplicar e validar a `015`. A migration `202608310016_city_ordering.sql` envolve toda a mudança em `BEGIN/COMMIT`: cria `public.cities.position`, faz o backfill determinístico das cidades existentes, adiciona o constraint `cities_position_safe`, cria o índice `cities_position_id_idx`, passa `create_city(text)` a anexar novas cidades no fim da ordem sob lock e expõe `reorder_city(uuid,uuid,uuid)` para owner ou usuários aprovados com `can_manage_cities = true`. A RPC recebe os vizinhos desejados (`before_city_id`/`after_city_id`), valida adjacência contra a ordem atual, serializa concorrência e renormaliza atomicamente todas as posições em passos de `1024`.

1. Antes de executar SQL, confirme pela CLI, quando disponível, que `001`–`015` estão alinhadas e que apenas a `016` aparece pendente. Não publique o frontend novo enquanto `cities.position` e `reorder_city` ainda não existirem no ambiente de destino.

```powershell
npx supabase migration list
npx supabase db push --linked --dry-run
```

O dry-run deve listar somente `202608310016_city_ordering.sql`. Se a CLI não estiver disponível, registre explicitamente essa limitação e mantenha a reconciliação do histórico como pendência obrigatória antes do próximo `db push`; isso não autoriza um push cego.

2. Aplique somente a `016`. O arquivo pode ser executado diretamente sem percorrer a fila:

```powershell
psql $env:SUPABASE_DB_URL -X -v ON_ERROR_STOP=1 `
  -f supabase/migrations/202608310016_city_ordering.sql
```

Quando `psql` não estiver disponível, abra o SQL Editor do projeto correto, cole **todo** o conteúdo de `supabase/migrations/202608310016_city_ordering.sql`, execute-o uma única vez e guarde o resultado. Essa execução manual também não atualiza `supabase_migrations.schema_migrations`.

3. Valide o schema e os contratos antes de publicar:

```sql
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cities'
  and column_name = 'position';

select
  conname,
  pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.cities'::regclass
  and conname = 'cities_position_safe';

select
  to_regprocedure('public.reorder_city(uuid,uuid,uuid)') as reorder_city,
  to_regclass('public.cities_position_id_idx') as cities_position_id_idx;

select id, name, position
from public.cities
order by position, name, id;
```

O primeiro resultado deve mostrar `numeric`, `is_nullable = NO` e default `1024`. O constraint e a função devem resolver. A listagem final deve sair em ordem determinística por `position`, `name` e `id`, sem posições nulas, zero, infinitas ou acima de `9007199254740991`.

4. Faça o smoke test do comportamento novo com uma conta owner e, quando aplicável, uma conta aprovada com `can_manage_cities = true`:
  - reordene cidades no admin com `Mover ... para cima/baixo`, recarregue e confirme persistência; valide pelo SQL Editor ou `psql` que a RPC devolve a ordem canônica completa, não apenas a linha movida;
   - confirme que um usuário sem `can_manage_cities` não consegue reordenar, criar, renomear, desativar nem reativar cidades;
   - abra o formulário de solicitação e valide que o seletor de cidades segue a ordem persistida, não uma ordenação alfabética local;
   - confira que o menu de ações continua aparecendo nas listas do sistema apenas com mover para esquerda/direita, que a prévia de arraste fica contida na moldura central do quadro e que o seletor customizado de status da conta substitui o `select` nativo sem reintroduzir brilho dourado externo nos botões primários.

5. Se a CLI estiver disponível e o SQL da `016` foi confirmado, reconcilie somente essa versão e confirme que não restou migration pendente:

```powershell
npx supabase migration repair 202608310016 --status applied --linked
npx supabase migration list
npx supabase db push --linked --dry-run
```

O `migration list` deve alinhar `001`–`016` e o dry-run não deve listar migrations. Se a CLI continuar indisponível, não tente alterar `supabase_migrations.schema_migrations` manualmente: registre a reconciliação de `016` como pendência obrigatória antes do próximo `db push`.

6. Só então publique o frontend que consulta `cities` por `position`, `name` e `id` e chama `reorder_city(uuid,uuid,uuid)`. Não publique antes disso: o novo painel e os seletores dependem desses contratos. Esta documentação descreve o procedimento; ela não significa que a `016` já foi aplicada em qualquer ambiente remoto.

Se a execução da `016` falhar, trate o resultado como schema não aplicado. Corrija o problema em uma nova migration revisada ou restaure o backup conforme a política da equipe; não edite a `016` nem use `migration repair` para mascarar divergência entre histórico e schema real.

## Rollout da data manual das solicitações — migration 019

A migration `202609020019_request_created_at_override.sql` troca as RPCs canônicas de criação e edição por assinaturas com o parâmetro final opcional `new_created_at_local timestamp without time zone`. O banco interpreta o valor em `America/Sao_Paulo`; `null` usa a data atual ao criar e preserva `requests.created_at` ao editar.

1. Confirme que as migrations anteriores do ambiente estão aplicadas e revise a fila antes de executar qualquer SQL.
2. Aplique a `019` inteira em uma transação. Quando não houver CLI/`psql`, cole todo o arquivo no SQL Editor do projeto correto e execute uma única vez.
3. Valide as assinaturas antes de publicar o frontend:

```sql
select
  to_regprocedure('public.create_request_with_cities(text,text,uuid,text,numeric,text[],uuid[],timestamp without time zone)') as create_with_date,
  to_regprocedure('public.update_request_with_cities(uuid,text,text,uuid,text,text[],uuid[],timestamp without time zone)') as update_with_date,
  to_regprocedure('public.create_request_with_cities(text,text,uuid,text,numeric,text[],uuid[])') as obsolete_create,
  to_regprocedure('public.update_request_with_cities(uuid,text,text,uuid,text,text[],uuid[])') as obsolete_update;
```

As duas primeiras colunas devem resolver; as duas últimas devem retornar `null`. Só então publique o frontend que envia `new_created_at_local`. No smoke test, crie uma solicitação sem data manual, outra com data passada e segundos, outra com data futura, edite sem alterar a data e depois edite ativando a alteração. Confirme que todos os horários exibidos correspondem ao fuso de São Paulo.
