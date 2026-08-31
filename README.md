# Solicitações — Kanban da equipe

Aplicação Next.js em português para cadastrar e acompanhar solicitações em colunas: as três listas de sistema `Pendente`, `Em progresso` e `Concluído`, listas opcionais vinculadas a responsáveis e listas personalizadas.

## Recursos

- E-mail e senha com Supabase Auth, recuperação de senha e sessão por cookies.
- Cadastro público com aprovação, rejeição e suspensão pelo owner.
- Quadro Kanban com `dnd-kit`, arraste de coluna pelo cabeçalho, arraste de cartão pelo próprio cartão, ordem persistida, atualização otimista e rollback.
- Colunas de sistema protegidas, listas por responsável (no máximo uma por perfil aprovado) e listas personalizadas sem responsável.
- `+ Adicionar outra lista` permite escolher `Responsável` ou `Personalizada`.
- Cada lista mantém o cabeçalho visível e exibe rolagem vertical interna após aproximadamente cinco cartões.
- Toda solicitação exige exatamente um responsável aprovado na criação e na edição.
- Filtros em chips por coluna, combinados com a busca textual, sem alterar os cartões.
- CRUD sob permissões independentes de criar, editar, mover e excluir.
- Busca por título, solicitante ou responsável, combinada com o chip da coluna selecionada.
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

As migrations estão em `supabase/migrations` e devem ser aplicadas em ordem. Para uma base que já chegou à `013`, o rollout atual exige backup e preflight, aplicação e validação da reparação de cidades `014`, aplicação da migration de listas personalizadas `015`, validação das RPCs/constraints e só então publicação da aplicação correspondente. Use os comandos exatos de [docs/supabase-setup.md](docs/supabase-setup.md); não execute `db push` às cegas durante etapas intermediárias.

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

## Colunas e permissões

- `Pendente`, `Em progresso` e `Concluído` são listas de sistema: podem ser reordenadas, mas não renomeadas nem excluídas.
- `+ Adicionar outra lista` oferece os tipos `Responsável` e `Personalizada`. A lista de responsável usa um único perfil aprovado ainda sem vínculo; a personalizada tem nome livre e não tem responsável.
- `Gerenciar colunas` é nativo do owner. Um membro aprovado só recebe esse controle quando a permissão `can_manage_columns` estiver habilitada no painel administrativo.
- Os chips `Todos`, das colunas fixas e das colunas de responsáveis apenas filtram a visualização; a busca continua combinada com o chip selecionado.
- A localização canônica é `requests.column_id`. As ações `Mover para` no diálogo e o arrastar/soltar movem o cartão pela coluna de destino; alterar conteúdo ou responsável não remove um cartão de uma lista personalizada escolhida manualmente.
- O responsável é obrigatório na criação e edição; o seletor visual permite somente uma escolha aprovada.

O campo legado `requests.status` permanece temporariamente sincronizado para compatibilidade. Não remova a coluna nem o trigger de sincronização nesta entrega.

## Segurança

- Senhas são gerenciadas exclusivamente pelo Supabase Auth.
- RLS é ativada em todas as tabelas.
- Edição e movimentação são RPCs separadas para validar permissões diferentes.
- O owner não pode suspender, rejeitar ou remover o próprio acesso.
- Links externos aceitam somente HTTP/HTTPS e abrem com `noopener noreferrer`.
- A service role nunca é exposta ao bundle cliente.
