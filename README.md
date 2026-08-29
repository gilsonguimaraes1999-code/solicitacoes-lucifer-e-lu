# Solicitações — Kanban da equipe

Aplicação Next.js em português para cadastrar e acompanhar solicitações em três status fixos: Pendente, Em progresso e Concluído.

## Recursos

- E-mail e senha com Supabase Auth, recuperação de senha e sessão por cookies.
- Cadastro público com aprovação, rejeição e suspensão pelo owner.
- Quadro Kanban com `dnd-kit`, ordem persistida, atualização otimista e rollback.
- CRUD sob permissões independentes de criar, editar, mover e excluir.
- Busca por título, solicitante ou responsável e filtro por responsável.
- Painel de usuários com pesquisa, filtros por cada status, contagens, indicadores visuais e permissões individuais.
- Realtime para solicitações, perfis e permissões.
- PostgreSQL com migrations, constraints, índices, RLS e RPCs seguras.
- Service role limitada a Route Handlers server-only.

## Requisitos

- Node.js 22 ou superior.
- pnpm 11 ou superior.
- Projeto Supabase.
- Supabase CLI e Docker para testes locais do banco.

## Instalação local

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

Preencha `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE
OWNER_EMAIL=owner@empresa.com
```

Não versione `.env.local`.

## Banco, Auth e primeiro owner

As migrations estão em `supabase/migrations` e devem ser aplicadas em ordem. Consulte [docs/supabase-setup.md](docs/supabase-setup.md) para criação do projeto, Auth, redirects, Realtime, aplicação das migrations e bootstrap idempotente do primeiro owner.

## Comandos de qualidade

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
npx supabase db reset
npx supabase test db
pnpm test:e2e
```

Os E2E precisam de um Supabase local/de teste configurado para fluxos autenticados. Nunca execute testes destrutivos contra produção.

## Deploy

Consulte [docs/deploy-vercel.md](docs/deploy-vercel.md). O repositório está preparado para importação pela Vercel, mas migrations e variáveis precisam ser configuradas separadamente.

## Segurança

- Senhas são gerenciadas exclusivamente pelo Supabase Auth.
- RLS é ativada em todas as tabelas.
- Edição e movimentação são RPCs separadas para validar permissões diferentes.
- O owner não pode suspender, rejeitar ou remover o próprio acesso.
- Links externos aceitam somente HTTP/HTTPS e abrem com `noopener noreferrer`.
- A service role nunca é exposta ao bundle cliente.
