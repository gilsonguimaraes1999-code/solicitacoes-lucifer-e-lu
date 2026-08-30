# Testes de banco por fase

`rls.test.sql` é o único arquivo SQL sob `supabase/tests`, portanto é a única suíte descoberta automaticamente por `npx supabase test db`. Ela valida o estado final depois de todas as migrations, incluindo o lockdown `007`.

`supabase/phased-tests/board-columns-additive.test.sql` fica deliberadamente fora da árvore autodetectada. Execute-o somente em um banco Supabase local ou hospedado descartável com o schema da aplicação vazio, nunca em produção. O runner carrega `001`–`004`, inclui explicitamente `supabase/phased-tests/fixtures/legacy-before-005.sql`, aplica `005`/`006`, confirma o backfill e testa RLS real. Toda a preparação e todas as asserções ficam no mesmo `BEGIN`/`ROLLBACK`, inclusive quando uma falha interrompe o `psql`:

```powershell
psql $env:TEST_DATABASE_URL -X -v ON_ERROR_STOP=1 `
  -f supabase/phased-tests/board-columns-additive.test.sql
```

O banco descartável precisa fornecer os schemas e papéis padrão do Supabase e ter a extensão pgTAP disponível. Não execute antes `db reset` com a árvore completa de migrations, porque isso aplicaria `007`. O teste troca de papel com `SET LOCAL ROLE authenticated`, configura as claims de autenticação e reverte schema e dados ao terminar; por isso, uma comparação executada apenas como `postgres` não substitui este teste.
