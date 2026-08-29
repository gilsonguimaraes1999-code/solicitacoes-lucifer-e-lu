# Configuração do Supabase

1. Crie um projeto Supabase e copie a URL, a chave anon e a service role para um `.env.local` que nunca será versionado.
2. Instale a Supabase CLI e vincule o projeto: `npx supabase link --project-ref SEU_PROJECT_REF`.
3. Revise e aplique as migrations: `npx supabase db push`.
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

9. Confirme em Database → Replication que `profiles`, `user_permissions` e `requests` estão na publicação `supabase_realtime`. A migration `202608290003_realtime.sql` faz isso de modo idempotente.
10. Teste com uma conta member: antes da aprovação ela deve ver apenas `/pending`; depois da aprovação, o dashboard.

Nunca use a service role em variável `NEXT_PUBLIC_*`, no navegador ou em logs.
