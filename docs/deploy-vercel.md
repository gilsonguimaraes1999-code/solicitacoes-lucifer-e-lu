# Publicação na Vercel

1. Envie o código validado ao GitHub.
2. Na Vercel, escolha Add New → Project e importe `gilsonguimaraes1999-code/solicitacoes-lucifer-e-lu`.
3. Mantenha o preset Next.js e o comando de build padrão.
4. Cadastre `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `OWNER_EMAIL` em Production e Preview conforme necessário.
5. Publique o projeto.
6. Copie o domínio final para Authentication → URL Configuration no Supabase e adicione `/auth/callback`.
7. Faça o smoke test: cadastro, login, página de aprovação, aprovação pelo owner, CRUD, movimentação, filtros, suspensão e sincronização em duas sessões.

O deploy não aplica migrations automaticamente. Aplique-as ao projeto Supabase antes do smoke test.
