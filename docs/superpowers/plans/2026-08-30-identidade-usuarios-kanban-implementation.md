# Identidade visual, usuários e Kanban responsivo — plano de implementação

**Objetivo:** corrigir a administração de contas, aplicar a identidade preta/dourada fornecida e usar toda a largura da janela no Kanban sem rolagem horizontal.

**Arquitetura:** manter Next.js/Supabase, adicionar grants administrativos idempotentes, separar o painel de usuários em controles e modais, criar um shell visual compartilhado e substituir o trilho horizontal do quadro por CSS Grid responsivo.

**Spec:** `docs/superpowers/specs/2026-08-30-identidade-usuarios-kanban-design.md`

## Tarefa 1: regressão da API administrativa

**Arquivos:**
- Modificar: `tests/unit/admin-user-route.test.ts`
- Criar: `tests/unit/admin-users-list-route.test.ts`
- Criar: `supabase/migrations/202608300008_service_role_admin_grants.sql`
- Modificar: `app/api/admin/users/route.ts`
- Modificar: `app/api/admin/users/[id]/route.ts`

- [ ] Escrever testes que falhem quando erros de `profiles`/`user_permissions` forem ignorados e quando aprovação/renomeação não persistirem.
- [ ] Executar os testes focados e confirmar RED.
- [ ] Adicionar grants de `service_role`, validação de erros e respostas administrativas consistentes.
- [ ] Executar os testes focados e confirmar GREEN.

## Tarefa 2: sistema visual compartilhado

**Arquivos:**
- Copiar: `public/angel-a.png`, `public/favicon.ico`, `public/fundo-site-vetorial.svg`
- Criar: `components/brand/starfield-background.tsx`
- Criar: `components/layout/app-background.tsx`
- Modificar: `app/globals.css`, `app/layout.tsx`, `components/layout/site-header.tsx`
- Modificar: páginas/componentes de login, cadastro e pendência

- [ ] Criar testes de comportamento/acessibilidade para marca e navegação quando necessário.
- [ ] Aplicar tokens preto/dourado, fontes, painéis e fundos sem alterar fluxos de autenticação.
- [ ] Configurar título, metadata e favicon da aplicação.

## Tarefa 3: usuários e permissões

**Arquivos:**
- Modificar: `components/users/users-panel.tsx`
- Criar: componentes auxiliares em `components/users/`
- Modificar: `features/users/filter-users.ts`
- Criar/Modificar: testes em `tests/unit/`

- [ ] Escrever testes para pesquisa, filtros, ordenação, abertura do modal e salvamento de status/permissões.
- [ ] Confirmar RED.
- [ ] Implementar lista responsiva, modal de edição/aprovação, modal de nova conta e estados de operação.
- [ ] Confirmar GREEN.

## Tarefa 4: Kanban responsivo

**Arquivos:**
- Modificar: `components/kanban/kanban-board.tsx`
- Modificar: `components/kanban/kanban-column.tsx`
- Modificar: `components/kanban/column-actions.tsx`
- Modificar: `components/kanban/add-column.tsx`
- Modificar: testes do Kanban e colunas

- [ ] Escrever testes que exercitem o menu compacto e o bloco de adicionar lista.
- [ ] Confirmar RED.
- [ ] Implementar grade `auto-fit/minmax`, largura fluida, quebra vertical e menu de ações `•••`.
- [ ] Confirmar GREEN.

## Tarefa 5: validação e publicação

- [ ] Executar testes focados e suíte completa.
- [ ] Executar typecheck, lint e build.
- [ ] Rodar o site localmente e inspecionar login, usuários e dashboard em desktop e móvel.
- [ ] Revisar o diff e corrigir regressões.
- [ ] Aplicar a migration no único projeto Supabase em uso.
- [ ] Publicar os commits no GitHub e aguardar o deploy da Vercel.
- [ ] Verificar aprovação/edição e o layout no site de produção.
