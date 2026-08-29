# Kanban de Solicitações — Plano de Implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIO: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa por tarefa. Os passos usam checkboxes (`- [ ]`) para acompanhamento.

**Objetivo:** Entregar uma aplicação Next.js completa para gerenciamento de solicitações em Kanban, com Supabase Auth, PostgreSQL, RLS, Realtime, permissões individuais e administração de usuários.

**Arquitetura:** O App Router protege páginas no servidor e entrega estado inicial aos componentes clientes. Operações comuns usam o JWT do usuário sob RLS; edição e movimentação de solicitações são RPCs separadas; operações que exigem a API administrativa usam Route Handlers server-only. O cliente mantém estado otimista e reconcilia eventos Realtime por UUID.

**Stack:** Next.js App Router, TypeScript estrito, Tailwind CSS, Supabase SSR/JS, PostgreSQL, Supabase Realtime, `dnd-kit`, Zod, React Hook Form, Vitest, Testing Library e Playwright.

**Especificação:** `docs/superpowers/specs/2026-08-29-kanban-solicitacoes-design.md`

## Restrições globais

- Toda a interface e todas as mensagens para usuários devem estar em português do Brasil.
- Não usar Firebase, Google Apps Script, login social, login Google ou magic link como método principal.
- `SUPABASE_SERVICE_ROLE_KEY` só pode ser importada por módulos `server-only`.
- Toda autorização de dados deve ser validada no PostgreSQL por RLS ou RPC; controles visuais não são uma barreira de segurança.
- O banco só pode ser alterado por migrations versionadas ou pelo script administrativo documentado.
- Não criar dados falsos como substituto de Supabase em produção.
- Não implementar itens declarados fora do escopo na especificação.
- Não executar commit, push, deploy ou mudanças no projeto Supabase sem autorização explícita do usuário.

---

## Mapa de arquivos

```text
app/
  (auth)/layout.tsx
  (auth)/login/page.tsx
  (auth)/register/page.tsx
  (auth)/forgot-password/page.tsx
  (auth)/reset-password/page.tsx
  (private)/layout.tsx
  (private)/pending/page.tsx
  (private)/dashboard/page.tsx
  (private)/admin/users/page.tsx
  api/admin/users/route.ts
  api/admin/users/[id]/route.ts
  auth/callback/route.ts
  globals.css
  layout.tsx
  page.tsx
components/
  auth/auth-form-shell.tsx
  auth/login-form.tsx
  auth/register-form.tsx
  auth/password-forms.tsx
  kanban/kanban-board.tsx
  kanban/kanban-column.tsx
  kanban/request-card.tsx
  layout/app-header.tsx
  requests/request-dialog.tsx
  requests/request-details.tsx
  requests/request-filters.tsx
  users/permissions-editor.tsx
  users/users-panel.tsx
  ui/button.tsx, dialog.tsx, input.tsx, skeleton.tsx, toast.tsx
features/
  auth/actions.ts
  auth/guards.ts
  auth/schemas.ts
  requests/api.ts
  requests/ordering.ts
  requests/reducer.ts
  requests/schemas.ts
  requests/types.ts
  realtime/use-account-realtime.ts
  realtime/use-requests-realtime.ts
  users/api.ts
  users/schemas.ts
lib/
  env.ts
  errors.ts
  permissions.ts
  supabase/admin.ts
  supabase/browser.ts
  supabase/server.ts
  supabase/types.ts
middleware.ts
supabase/
  migrations/202608290001_schema.sql
  migrations/202608290002_security.sql
  migrations/202608290003_realtime.sql
  scripts/bootstrap-owner.sql
  tests/rls.test.sql
tests/
  setup.ts
  unit/ordering.test.ts
  unit/reducer.test.ts
  unit/schemas.test.ts
  integration/admin-users-route.test.ts
  e2e/auth.spec.ts
  e2e/permissions.spec.ts
  e2e/kanban.spec.ts
```

---

### Tarefa 1: Fundação Next.js e ferramentas de qualidade

**Arquivos:**
- Criar: estrutura gerada pelo Next.js na raiz
- Criar: `vitest.config.ts`
- Criar: `playwright.config.ts`
- Criar: `tests/setup.ts`
- Criar: `.env.example`
- Modificar: `package.json`
- Modificar: `tsconfig.json`

**Interfaces:**
- Produz: scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:watch`, `test:e2e`.
- Produz: alias `@/*` e ambiente de testes `jsdom`.

- [ ] **Passo 1: Inicializar o aplicativo**

Executar na raiz vazia:

```powershell
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-npm
```

- [ ] **Passo 2: Instalar dependências de produção e teste**

```powershell
npm install @supabase/ssr @supabase/supabase-js @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities zod react-hook-form @hookform/resolvers lucide-react
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
```

- [ ] **Passo 3: Configurar os scripts**

Adicionar a `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Passo 4: Criar as configurações de teste**

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "jsdom", setupFiles: ["./tests/setup.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

`tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Passo 5: Criar o contrato de ambiente**

`.env.example` deve conter somente:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OWNER_EMAIL=
```

- [ ] **Passo 6: Validar a fundação**

Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`. Registrar os resultados; não criar commit.

---

### Tarefa 2: Contratos de domínio, ambiente e clientes Supabase

**Arquivos:**
- Criar: `lib/env.ts`
- Criar: `lib/supabase/browser.ts`
- Criar: `lib/supabase/server.ts`
- Criar: `lib/supabase/admin.ts`
- Criar: `lib/supabase/types.ts`
- Criar: `features/requests/types.ts`
- Criar: `lib/permissions.ts`
- Testar: `tests/unit/env.test.ts`

**Interfaces:**
- Produz: `getPublicEnv()`, `getServerEnv()`, `createBrowserClient()`, `createServerClient()`, `createAdminClient()`.
- Produz: `Profile`, `UserPermissions`, `RequestRecord`, `RequestStatus`, `EffectivePermissions`.

- [ ] **Passo 1: Escrever o teste de ambiente que falha**

```ts
import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "@/lib/env";

describe("parsePublicEnv", () => {
  it("rejeita URL e chave vazias", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" })).toThrow();
  });
});
```

- [ ] **Passo 2: Executar e confirmar a falha**

Executar `npm test -- tests/unit/env.test.ts`. Esperado: falha porque `parsePublicEnv` não existe.

- [ ] **Passo 3: Implementar validação e clientes**

Usar Zod em `lib/env.ts`, `createBrowserClient` de `@supabase/ssr` no browser, cookies de `next/headers` no servidor e este limite no cliente admin:

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

export function createAdminClient() {
  const env = getServerEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

Definir `EffectivePermissions` com as quatro flags e uma função `effectivePermissions(profile, permissions)` que retorna tudo `true` para owner.

- [ ] **Passo 4: Gerar tipos inicialmente manuais e documentar regeneração**

Criar o shape de `Database` compatível com as três tabelas e RPCs. O README posterior deverá fornecer `npx supabase gen types typescript --project-id <project-ref> > lib/supabase/types.ts` como comando de regeneração.

- [ ] **Passo 5: Executar testes e checagem de tipos**

Executar `npm test -- tests/unit/env.test.ts` e `npm run typecheck`. Esperado: sucesso. Registrar checkpoint local sem commit.

---

### Tarefa 3: Schema, triggers, índices, Realtime e bootstrap do owner

**Arquivos:**
- Criar: `supabase/migrations/202608290001_schema.sql`
- Criar: `supabase/migrations/202608290003_realtime.sql`
- Criar: `supabase/scripts/bootstrap-owner.sql`

**Interfaces:**
- Produz: tabelas `profiles`, `user_permissions`, `requests`.
- Produz: enums por constraints textuais, trigger `handle_new_user`, trigger comum `set_updated_at`.
- Produz: script idempotente parametrizado por `OWNER_EMAIL`.

- [ ] **Passo 1: Escrever a migration de schema**

Incluir extensões e constraints de tamanho, chaves e índices. A criação automática deve seguir este contrato:

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)));

  insert into public.user_permissions (user_id) values (new.id);
  return new;
end;
$$;
```

Restringir `external_url` a `NULL` ou `https?://`; restringir `position >= 0`; usar `on delete restrict` para responsável e criador.

- [ ] **Passo 2: Escrever migration Realtime idempotente**

Configurar `replica identity full` e adicionar tabelas à publicação somente se ainda não estiverem presentes.

- [ ] **Passo 3: Escrever bootstrap seguro do owner**

O script deve falhar se o e-mail não existir ou se houver mais de um resultado, promover somente o perfil encontrado e ativar as quatro permissões. Aceitar `psql -v owner_email='email@dominio.com'` e nunca conter e-mail real.

- [ ] **Passo 4: Validar SQL localmente**

Se Supabase CLI/Docker estiverem disponíveis, executar `npx supabase start` e `npx supabase db reset`. Se não estiverem, registrar exatamente a dependência ausente e continuar sem alegar execução.

---

### Tarefa 4: Funções de autorização, RLS e RPCs

**Arquivos:**
- Criar: `supabase/migrations/202608290002_security.sql`
- Criar: `supabase/tests/rls.test.sql`

**Interfaces:**
- Produz: `is_approved()`, `is_owner()`, `has_request_permission(text)`.
- Produz: `update_request_content(uuid,text,text,text,uuid,text)`.
- Produz: `move_request(uuid,text,numeric)` e `admin_update_user(uuid,text,text,text)`.

- [ ] **Passo 1: Escrever testes SQL de negação e concessão**

Usar transações, `set local role authenticated` e claims JWT simuladas. Cobrir explicitamente:

```sql
select throws_ok(
  $$ insert into public.requests (title, requester_name, assigned_to, created_by, position)
     values ('X', 'Y', :'approved_user', :'no_create_user', 1) $$,
  '42501'
);
```

Adicionar casos para pendente sem leitura, aprovado com leitura, cada permissão independente, owner total, membro sem autopromoção e owner sem auto-suspensão.

- [ ] **Passo 2: Executar e confirmar falha**

Com banco local ativo, executar `npx supabase test db`. Esperado: falhas porque funções e políticas ainda não existem.

- [ ] **Passo 3: Implementar auxiliares sem recursão**

As funções devem ser `stable security definer set search_path = public, auth`, ter `execute` revogado de `public` e concedido a `authenticated`. Consultar diretamente as tabelas, sem reutilizar políticas recursivas.

- [ ] **Passo 4: Implementar políticas**

Habilitar e forçar RLS nas três tabelas. Criar políticas separadas para leitura do próprio perfil, leitura de aprovados, gestão por owner, leitura da própria permissão, gestão por owner, leitura/criação/exclusão de solicitações.

- [ ] **Passo 5: Implementar RPCs e revogar UPDATE direto**

`update_request_content` valida `can_edit_requests`, responsável aprovado e URL HTTP/HTTPS; altera apenas conteúdo. `move_request` valida `can_move_requests`, status e posição; renormaliza posições quando a distância dos vizinhos ficar abaixo do limite escolhido. Ambas retornam a linha atualizada e bloqueiam o card com `for update`.

- [ ] **Passo 6: Executar testes SQL**

Executar `npx supabase db reset` e `npx supabase test db`. Esperado: todos os casos passam. Registrar saída sem commit.

---

### Tarefa 5: Autenticação e recuperação de senha

**Arquivos:**
- Criar: `features/auth/schemas.ts`
- Criar: `features/auth/actions.ts`
- Criar: `components/auth/auth-form-shell.tsx`
- Criar: `components/auth/login-form.tsx`
- Criar: `components/auth/register-form.tsx`
- Criar: `components/auth/password-forms.tsx`
- Criar: páginas em `app/(auth)`
- Criar: `app/auth/callback/route.ts`
- Testar: `tests/unit/schemas.test.ts`

**Interfaces:**
- Produz: `loginSchema`, `registerSchema`, `forgotPasswordSchema`, `resetPasswordSchema`.
- Produz: Server Actions `login`, `register`, `sendPasswordReset`, `updatePassword`, `logout`.

- [ ] **Passo 1: Escrever testes Zod que falham**

Cobrir senha curta, confirmação divergente, nome vazio, e-mail inválido e cadastro válido.

```ts
expect(registerSchema.safeParse({
  fullName: "Ana Silva", email: "ana@example.com", password: "Segura123!", confirmPassword: "outra",
}).success).toBe(false);
```

- [ ] **Passo 2: Executar e confirmar falha**

Executar `npm test -- tests/unit/schemas.test.ts`. Esperado: módulos ausentes.

- [ ] **Passo 3: Implementar schemas e ações**

Validar novamente nas Server Actions. Em cadastro, enviar `options.data.full_name`. Mapear erros conhecidos para português e retornar `{ ok: false, message, fieldErrors? }`, nunca tokens ou senha.

- [ ] **Passo 4: Implementar páginas e callback**

Criar `/login`, `/register`, `/forgot-password`, `/reset-password` e `/auth/callback`. O callback deve validar `next` como caminho interno antes de redirecionar.

- [ ] **Passo 5: Testar UI dos formulários**

Adicionar testes Testing Library para labels, mensagens e estado de envio. Executar testes, lint e typecheck.

---

### Tarefa 6: Renovação de sessão, guards privados e página de aprovação

**Arquivos:**
- Criar: `middleware.ts`
- Criar: `features/auth/guards.ts`
- Criar: `app/(private)/layout.tsx`
- Criar: `app/(private)/pending/page.tsx`
- Criar: `features/realtime/use-account-realtime.ts`
- Criar: `components/layout/app-header.tsx`
- Testar: `tests/unit/guards.test.ts`

**Interfaces:**
- Produz: `requireUser()`, `requireApprovedProfile()`, `requireOwner()`.
- Produz: `useAccountRealtime(userId, initialProfile, initialPermissions)`.

- [ ] **Passo 1: Escrever testes de decisão de acesso**

Testar a função pura `resolvePrivateDestination(path, profile)` para `pending`, `rejected`, `suspended`, `approved member` e `approved owner`.

- [ ] **Passo 2: Confirmar falha e implementar guards**

Os guards consultam `auth.getUser()` e o perfil no servidor. Ausência de usuário redireciona a `/login`; conta não aprovada redireciona a `/pending`; não-owner tentando `/admin/users` redireciona a `/dashboard`.

- [ ] **Passo 3: Implementar middleware mínimo**

Renovar cookies com `@supabase/ssr` sem concentrar autorização apenas no middleware. Excluir assets e rotas estáticas do matcher.

- [ ] **Passo 4: Implementar `/pending` e monitor em tempo real**

Mostrar mensagem distinta por status. O hook assina somente as linhas do usuário em `profiles` e `user_permissions`, atualiza permissões e executa `router.replace('/pending')` ao perder aprovação ou `router.replace('/dashboard')` ao ser aprovado.

- [ ] **Passo 5: Verificar cleanup e duplicidade de canal**

Testar que `removeChannel` é chamado no cleanup e que a chave estável do usuário impede listener duplicado. Executar testes e typecheck.

---

### Tarefa 7: Domínio de solicitações, validação, ordenação e reducer

**Arquivos:**
- Criar: `features/requests/schemas.ts`
- Criar: `features/requests/ordering.ts`
- Criar: `features/requests/reducer.ts`
- Criar: `features/requests/api.ts`
- Criar: `tests/unit/ordering.test.ts`
- Criar: `tests/unit/reducer.test.ts`

**Interfaces:**
- Produz: `requestSchema`, `RequestInput`.
- Produz: `positionBetween(before?: number, after?: number): number`.
- Produz: `requestsReducer(state, event)` com eventos `snapshot`, `insert`, `update`, `delete`, `optimisticMove`, `rollback`.
- Produz: `createRequest`, `updateRequestContent`, `moveRequest`, `deleteRequest`.

- [ ] **Passo 1: Escrever testes de ordenação que falham**

```ts
expect(positionBetween(undefined, undefined)).toBe(1024);
expect(positionBetween(1024, undefined)).toBe(2048);
expect(positionBetween(undefined, 1024)).toBe(512);
expect(positionBetween(1024, 2048)).toBe(1536);
```

- [ ] **Passo 2: Escrever testes de reducer que falham**

Verificar que `insert` repetido não duplica UUID, `update` substitui, `delete` remove e `rollback` restaura snapshot.

- [ ] **Passo 3: Implementar funções puras mínimas**

Ordenar sempre por `position`, depois `created_at`, depois `id` para estabilidade. O reducer deve ser imutável e reconciliar por `Map<string, RequestRecord>`.

- [ ] **Passo 4: Implementar schemas e API**

Validar título, descrição, solicitante, responsável e URL HTTP/HTTPS. Criação usa insert sob RLS; edição e movimento usam RPC; exclusão usa delete. Converter falhas com `toUserMessage(error)`.

- [ ] **Passo 5: Executar testes**

Executar `npm test -- tests/unit/ordering.test.ts tests/unit/reducer.test.ts tests/unit/schemas.test.ts` e `npm run typecheck`.

---

### Tarefa 8: Quadro Kanban e drag-and-drop otimista

**Arquivos:**
- Criar: `components/kanban/kanban-board.tsx`
- Criar: `components/kanban/kanban-column.tsx`
- Criar: `components/kanban/request-card.tsx`
- Criar: `app/(private)/dashboard/page.tsx`
- Criar: `app/(private)/dashboard/loading.tsx`
- Testar: `tests/unit/kanban-board.test.tsx`

**Interfaces:**
- Consome: `RequestRecord`, `EffectivePermissions`, `positionBetween`, `moveRequest` e reducer.
- Produz: `KanbanBoardProps { initialRequests, approvedProfiles, currentProfile, permissions }`.

- [ ] **Passo 1: Escrever testes de permissão e colunas**

Renderizar as três colunas, verificar empty state e garantir que card sem `can_move_requests` não receba listeners de drag.

- [ ] **Passo 2: Confirmar falha**

Executar `npm test -- tests/unit/kanban-board.test.tsx`. Esperado: componentes ausentes.

- [ ] **Passo 3: Implementar dashboard server-side**

Usar `requireApprovedProfile()`, buscar solicitações ordenadas, perfis aprovados e permissões próprias em paralelo. Entregar dados serializáveis ao quadro.

- [ ] **Passo 4: Implementar DnD**

Usar `DndContext`, `SortableContext`, sensores de mouse/toque/teclado e `DragOverlay`. No `onDragEnd`, guardar snapshot, calcular coluna/índice/posição, aplicar `optimisticMove`, chamar RPC e despachar `rollback` em erro.

- [ ] **Passo 5: Implementar acessibilidade e responsividade**

Adicionar nomes acessíveis, foco visível, mensagens do dnd-kit em português e rolagem horizontal em telas pequenas.

- [ ] **Passo 6: Executar testes e lint**

Executar teste do quadro, `npm run lint` e `npm run typecheck`.

---

### Tarefa 9: CRUD visual, detalhes, pesquisa e filtro

**Arquivos:**
- Criar: `components/requests/request-dialog.tsx`
- Criar: `components/requests/request-details.tsx`
- Criar: `components/requests/request-filters.tsx`
- Criar: `components/ui/dialog.tsx`
- Criar: `components/ui/toast.tsx`
- Testar: `tests/unit/request-dialog.test.tsx`
- Testar: `tests/unit/request-filters.test.ts`

**Interfaces:**
- Consome: schemas e API da Tarefa 7.
- Produz: callbacks `onCreated`, `onUpdated`, `onDeleted` que alimentam o reducer do quadro.

- [ ] **Passo 1: Escrever testes de filtro e URL**

Testar busca sem distinção de caixa em título, solicitante e nome do responsável; filtro por UUID; URL inválida; `rel="noopener noreferrer"` em link válido.

- [ ] **Passo 2: Implementar controles conforme permissão**

Mostrar “Nova solicitação” somente com criação; edição somente com edição; drag somente com movimento; exclusão somente com exclusão. Owner recebe todas via `effectivePermissions`.

- [ ] **Passo 3: Implementar formulário compartilhado**

Usar React Hook Form com `zodResolver(requestSchema)`. O responsável é obrigatório e limitado à lista aprovada. Formulário de edição não envia status nem posição.

- [ ] **Passo 4: Implementar detalhes e exclusão**

Mostrar todos os campos, datas formatadas em `pt-BR` e link seguro. Exigir confirmação textual/ação explícita antes de excluir e manter diálogo aberto se ocorrer erro.

- [ ] **Passo 5: Implementar pesquisa e filtro local**

Derivar lista com `useMemo`, sem duplicar estado canônico. Exibir contagens após filtro e empty state específico quando não houver resultado.

- [ ] **Passo 6: Executar testes**

Executar testes dos componentes, lint e typecheck.

---

### Tarefa 10: Sincronização Realtime de solicitações e reconexão

**Arquivos:**
- Criar: `features/realtime/use-requests-realtime.ts`
- Modificar: `components/kanban/kanban-board.tsx`
- Criar: `tests/unit/use-requests-realtime.test.tsx`

**Interfaces:**
- Produz: `useRequestsRealtime({ enabled, dispatch, reloadSnapshot })`.
- Consome: eventos do reducer e cliente Supabase browser.

- [ ] **Passo 1: Escrever testes que falham**

Simular `INSERT`, `UPDATE`, `DELETE`, reconexão e desmontagem. Verificar um canal por montagem, remoção no cleanup, nenhuma duplicação e `reloadSnapshot` em `SUBSCRIBED` após perda de conexão.

- [ ] **Passo 2: Implementar canal estável**

Criar canal somente quando autenticado/aprovado. Assinar `postgres_changes` de `requests`, converter payloads tipados e despachar eventos. Controlar reconexão com `useRef` para não recarregar no primeiro `SUBSCRIBED`.

- [ ] **Passo 3: Integrar ao quadro**

O snapshot canônico substitui o estado somente após leitura bem-sucedida; mutações otimistas continuam idempotentes quando o eco Realtime chegar.

- [ ] **Passo 4: Executar testes**

Executar `npm test -- tests/unit/use-requests-realtime.test.tsx tests/unit/reducer.test.ts` e typecheck.

---

### Tarefa 11: Administração de usuários e permissões

**Arquivos:**
- Criar: `features/users/schemas.ts`
- Criar: `features/users/api.ts`
- Criar: `app/api/admin/users/route.ts`
- Criar: `app/api/admin/users/[id]/route.ts`
- Criar: `components/users/users-panel.tsx`
- Criar: `components/users/permissions-editor.tsx`
- Criar: `app/(private)/admin/users/page.tsx`
- Criar: `tests/integration/admin-users-route.test.ts`

**Interfaces:**
- Produz: `POST /api/admin/users` para criação manual.
- Produz: `PATCH /api/admin/users/:id` para nome, status e permissões por operação explícita.
- Consome: `requireOwner`, `createAdminClient`, RPC administrativa e Realtime de conta.

- [ ] **Passo 1: Escrever testes de Route Handler que falham**

Cobrir: sem sessão `401`; membro `403`; owner cria usuário `201`; senha nunca aparece na resposta/log; owner não pode suspender a si próprio; payload inválido `400`.

- [ ] **Passo 2: Implementar schemas administrativos**

Criar uniões discriminadas:

```ts
const updateUserSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rename"), fullName: z.string().trim().min(2).max(120) }),
  z.object({ action: z.literal("status"), approvalStatus: z.enum(["pending", "approved", "rejected", "suspended"]) }),
  z.object({ action: z.literal("permissions"), permissions: permissionsSchema }),
]);
```

- [ ] **Passo 3: Implementar API server-only**

Validar owner com cliente da sessão antes de instanciar o admin client. Criação manual chama `auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })`; em falha posterior, retornar erro claro sem expor stack/credenciais.

- [ ] **Passo 4: Implementar painel**

Buscar perfis e permissões no servidor. Adicionar abas/filtros de status, pesquisa, edição de nome, ações de aprovação/rejeição/suspensão/reativação, formulário de criação manual e quatro interruptores independentes.

- [ ] **Passo 5: Integrar Realtime**

Owner assina `profiles` e `user_permissions`, faz upsert por chave e atualiza a lista sem reload. O usuário afetado recebe as mesmas alterações pelo hook da Tarefa 6.

- [ ] **Passo 6: Executar testes**

Executar integração, testes de componentes, lint e typecheck.

---

### Tarefa 12: Sistema visual, estados e tratamento de erros

**Arquivos:**
- Modificar: `app/globals.css`
- Modificar: `app/layout.tsx`
- Criar/modificar: componentes em `components/ui`
- Criar: `lib/errors.ts`
- Criar: `app/error.tsx`
- Criar: `app/not-found.tsx`

**Interfaces:**
- Produz: `toUserMessage(error: unknown): string`.
- Produz: componentes Button, Input, Dialog, Skeleton e Toast com variantes consistentes.

- [ ] **Passo 1: Escrever teste de mapeamento de erros**

Cobrir autorização, sessão expirada, conflito, rede e erro desconhecido sem expor mensagens internas.

- [ ] **Passo 2: Implementar tokens visuais**

Definir cores neutras, superfícies, bordas, sombra, foco, estados por coluna e preferências de movimento reduzido. Não usar marcas ou assets do Trello.

- [ ] **Passo 3: Padronizar estados**

Aplicar skeletons, empty states, estados desabilitados, feedback de drag, toasts de sucesso/erro e error boundary em todas as páginas principais.

- [ ] **Passo 4: Verificar responsividade e teclado**

Testar larguras 360, 768 e 1440 px; tabulação; fechamento de diálogos; foco devolvido ao gatilho; contraste e labels.

- [ ] **Passo 5: Executar testes e lint**

Executar testes unitários, lint e typecheck.

---

### Tarefa 13: Testes E2E dos fluxos críticos

**Arquivos:**
- Criar: `playwright.config.ts`
- Criar: `tests/e2e/auth.spec.ts`
- Criar: `tests/e2e/permissions.spec.ts`
- Criar: `tests/e2e/kanban.spec.ts`
- Criar: `tests/e2e/helpers/supabase.ts`

**Interfaces:**
- Consome: ambiente Supabase local descartável e usuários criados pelo helper server-side de teste.
- Produz: evidência automatizada dos critérios de aceitação de ponta a ponta.

- [ ] **Passo 1: Configurar isolamento E2E**

Exigir `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY` e `E2E_SUPABASE_SERVICE_ROLE_KEY` somente no processo de teste. Bloquear execução se a URL não for localhost ou projeto explicitamente marcado para testes.

- [ ] **Passo 2: Escrever testes de autenticação**

Cobrir cadastro pendente, login, recuperação até o pedido de e-mail, aprovado no dashboard e suspenso redirecionado imediatamente.

- [ ] **Passo 3: Escrever matriz de permissões**

Criar casos independentes para negação de criar, editar, mover e excluir; depois validar owner com acesso total e membro incapaz de se promover.

- [ ] **Passo 4: Escrever testes de Kanban e Realtime**

Em dois contexts do navegador, criar/mover/editar/excluir e verificar sincronização sem reload e sem duplicação. Após movimento, recarregar e confirmar persistência da ordem.

- [ ] **Passo 5: Executar E2E quando houver ambiente**

Executar `npm run test:e2e`. Se o ambiente seguro não estiver configurado, registrar “não executado — credenciais E2E ausentes”; não converter ausência em aprovação.

---

### Tarefa 14: Documentação operacional e preparação para Vercel

**Arquivos:**
- Criar: `README.md`
- Criar: `.gitignore` ou revisar o gerado
- Criar: `docs/supabase-setup.md`
- Criar: `docs/deploy-vercel.md`

**Interfaces:**
- Produz: procedimento reproduzível do zero ao deploy.

- [ ] **Passo 1: Documentar desenvolvimento local**

Incluir requisitos, `npm install`, cópia de `.env.example`, Supabase CLI, `supabase db reset`, geração de tipos, `npm run dev` e comandos de qualidade.

- [ ] **Passo 2: Documentar configuração do Supabase**

Explicar criação do projeto, aplicação das migrations, Auth por e-mail/senha, confirmação opcional de e-mail, URLs `http://localhost:3000/auth/callback` e `https://DOMINIO-VERCEL/auth/callback`, Realtime, RLS e execução do bootstrap owner.

- [ ] **Passo 3: Documentar Vercel**

Explicar conexão do repositório GitHub, variáveis de produção/preview, deploy, atualização das redirect URLs e smoke test pós-publicação. Não publicar.

- [ ] **Passo 4: Auditar segredos**

Garantir que `.env*` real, credenciais E2E e arquivos Supabase temporários estejam ignorados. Executar `rg -n "service_role|SUPABASE_SERVICE_ROLE_KEY|eyJ" . -g '!package-lock.json'` e revisar cada ocorrência esperada.

---

### Tarefa 15: Verificação final e relatório

**Arquivos:**
- Modificar somente arquivos que falharem nas verificações
- Produzir: relatório final em chat, sem inventar resultados

**Interfaces:**
- Produz: evidência de lint, TypeScript, testes, build e pendências externas.

- [ ] **Passo 1: Rodar verificação completa limpa**

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

- [ ] **Passo 2: Rodar validação Supabase quando disponível**

```powershell
npx supabase db reset
npx supabase test db
```

- [ ] **Passo 3: Rodar E2E quando o ambiente seguro existir**

```powershell
npm run test:e2e
```

- [ ] **Passo 4: Corrigir e repetir comandos afetados**

Qualquer falha deve ser corrigida e o comando completo correspondente repetido. Não usar resultado anterior à correção como evidência.

- [ ] **Passo 5: Conferir escopo e segurança**

Revisar todas as rotas privadas, imports server-only, políticas, grants, cleanup Realtime, links externos, confirmação destrutiva e ausência de funcionalidades fora de escopo.

- [ ] **Passo 6: Entregar relatório**

Informar resumo, principais arquivos, migrations, instruções Supabase/Vercel, saídas das verificações, variáveis ainda necessárias e limitações. Declarar separadamente qualquer teste não executado por falta de credenciais.

---

## Ordem e checkpoints

As tarefas devem ser executadas em ordem. Cada tarefa termina com testes focalizados e um checkpoint de revisão local. Como commits não estão autorizados, não executar `git commit`; quando o usuário autorizar versionamento, agrupar commits por tarefa já validada.

## Cobertura da especificação

- Autenticação e ciclo de aprovação: Tarefas 3, 5 e 6.
- Owner, administração e proteção da service role: Tarefas 3, 4 e 11.
- Permissões independentes e RLS: Tarefas 4, 7, 8 e 11.
- Kanban, ordenação e rollback: Tarefas 7 e 8.
- CRUD, pesquisa, filtro e URL externa: Tarefa 9.
- Realtime de solicitações, contas e permissões: Tarefas 6, 10 e 11.
- Interface, responsividade e feedback: Tarefas 8, 9 e 12.
- Testes obrigatórios: Tarefas 4, 7, 10, 11, 13 e 15.
- Migrations e documentação operacional: Tarefas 3, 4 e 14.
- Preparação para Vercel e validação final: Tarefas 14 e 15.
