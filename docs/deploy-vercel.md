# Publicação na Vercel

1. Envie o código validado ao GitHub.
2. Na Vercel, escolha Add New → Project e importe `gilsonguimaraes1999-code/solicitacoes-lucifer-e-lu`.
3. Mantenha o preset Next.js e o comando de build padrão.
4. Cadastre `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `OWNER_EMAIL` em Production e Preview conforme necessário. Nunca exponha a service role em `NEXT_PUBLIC_*`, no navegador, no repositório ou em logs.
5. Antes da publicação de colunas de responsáveis, conclua a Fase 1 de [Configuração do Supabase](supabase-setup.md#fase-1--schema-aditivo-e-aplicação-nova). Ela aplica `005`/`006` por `psql`, registra somente essas versões e exige que `db push --dry-run` mostre apenas `007` e `008`; não execute `db push` neste ponto.
6. Publique o projeto e aguarde o estado Ready na Vercel.
7. Copie o domínio final para Authentication → URL Configuration no Supabase e adicione `/auth/callback`.
8. Faça o smoke test: cadastro, login, página de aprovação, aprovação pelo owner, edição de nome e permissões com persistência após recarga, CRUD, movimentação, filtros, suspensão e sincronização em duas sessões. No fluxo de colunas, valide também as três listas fixas, criação de lista vinculada a responsável aprovado, destino inicial da solicitação, chips de filtro, movimento por status e drag-and-drop, bloqueio de exclusão de lista ocupada e a permissão `Gerenciar colunas` para membro aprovado.
9. Somente depois de o novo deploy estar Ready e o smoke test passar, execute a Fase 2 documentada: confira outra vez o dry-run e aplique `007` e `008` com `db push`. Repita criação e movimentação, confira logs da Vercel e do Supabase para 4xx/5xx e confirme que Realtime não duplica listas ou cartões.

O deploy não aplica migrations automaticamente. A ordem obrigatória é `005 + 006 (transação única) → registrar 005/006 → preflight → deploy/smoke → dry-run → 007 + 008`. Não aplique `007` antecipadamente: ela remove os caminhos legados de escrita. A coluna legada `requests.status` e seu trigger de sincronização permanecem nesta entrega para compatibilidade; uma remoção futura exige outro ciclo estável de produção.
