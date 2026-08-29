# Colunas de responsáveis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manter as três colunas fixas do fluxo e permitir colunas adicionais vinculadas a responsáveis, com filtros em chips, permissão específica e movimentação segura de cartões.

**Architecture:** `board_columns` será a fonte canônica de localização dos cartões; `requests.column_id` apontará para exatamente uma coluna. O banco resolverá destino inicial, mudança de responsável e movimentações por RPCs, enquanto o cliente manterá coleções Realtime separadas de colunas e solicitações.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/PostgreSQL/RLS/Realtime, dnd-kit, Zod, Vitest e Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-29-colunas-responsaveis-design.md`

## Global Constraints

- Preservar `Pendente`, `Em progresso` e `Concluído` como colunas de sistema imutáveis e anteriores às colunas personalizadas.
- Cada perfil aprovado pode possuir no máximo uma coluna vinculada.
- Cada solicitação aparece em exatamente uma coluna e mantém `assigned_to` ao entrar numa coluna fixa.
- Somente owner ou membro aprovado com `can_manage_columns = true` gerencia colunas.
- Manter compatibilidade com a aplicação antiga durante a primeira migração de produção.
- Toda mensagem visível ao usuário deve estar em português do Brasil.
- Não adicionar dependências; usar as bibliotecas já instaladas.
- Executar `pnpm test`, `pnpm typecheck`, `pnpm lint` e `pnpm build` antes da publicação.

---

## File Structure

- `features/columns/types.ts`: tipos públicos de coluna e chaves de sistema.
- `features/columns/schemas.ts`: validação dos formulários de coluna.
- `features/columns/api.ts`: chamadas RPC de criar, renomear, reordenar e excluir coluna.
- `features/columns/reducer.ts`: reconciliação idempotente de eventos Realtime.
- `features/requests/filter.ts`: pesquisa e seleção de coluna sem duplicar estado.
- `components/kanban/board-filters.tsx`: chips globais de filtro.
- `components/kanban/add-column.tsx`: formulário compacto `+ Adicionar outra lista`.
- `components/kanban/column-actions.tsx`: renomear e excluir coluna personalizada.
- `components/kanban/kanban-board.tsx`: orquestra estado, Realtime, drag-and-drop e dialogs.
- `components/kanban/kanban-column.tsx`: renderiza uma `BoardColumn` genérica.
- `components/requests/request-dialog.tsx`: destino previsto e ações de status fixo.
- `supabase/migrations/202608290005_board_columns.sql`: schema aditivo, backfill, compatibilidade e Realtime.
- `supabase/migrations/202608290006_board_column_rpcs.sql`: políticas e RPCs novas mantendo as APIs antigas durante o deploy.
- `supabase/migrations/202608290007_board_columns_lockdown.sql`: revoga o insert legado e remove a RPC antiga após o deploy.

---

### Task 1: Domain types, schemas and effective permission

**Files:**
- Create: `features/columns/types.ts`
- Create: `features/columns/schemas.ts`
- Create: `tests/unit/columns-domain.test.ts`
- Modify: `features/requests/types.ts`
- Modify: `lib/permissions.ts`
- Modify: `tests/unit/domain.test.ts`

**Interfaces:**
- Produces: `SystemColumnKey`, `BoardColumn`, `createColumnSchema`, `renameColumnSchema`, `EffectivePermissions.canManageColumns`, and `RequestRecord.column_id`.
- Consumes: existing `Profile`, `RequestStatus`, `UserPermissions`, and Zod conventions.

- [ ] **Step 1: Write failing domain tests**

```ts
import { describe, expect, it } from "vitest";
import { createColumnSchema } from "@/features/columns/schemas";
import { effectivePermissions } from "@/lib/permissions";

describe("column domain", () => {
  it("validates an assignee column", () => {
    expect(createColumnSchema.parse({ name: "Lucifer", assigneeId: crypto.randomUUID() }).name).toBe("Lucifer");
    expect(() => createColumnSchema.parse({ name: " ", assigneeId: "x" })).toThrow();
  });

  it("gives column management to owner and explicit members", () => {
    expect(effectivePermissions({ role: "owner" }, null).canManageColumns).toBe(true);
    expect(effectivePermissions({ role: "member" }, { can_manage_columns: true }).canManageColumns).toBe(true);
    expect(effectivePermissions({ role: "member" }, null).canManageColumns).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `pnpm test -- tests/unit/columns-domain.test.ts tests/unit/domain.test.ts`

Expected: FAIL because `features/columns/schemas.ts`, `BoardColumn`, and `canManageColumns` do not exist.

- [ ] **Step 3: Add the minimal types and schemas**

```ts
// features/columns/types.ts
export const SYSTEM_COLUMN_KEYS = ["pending", "in_progress", "completed"] as const;
export type SystemColumnKey = (typeof SYSTEM_COLUMN_KEYS)[number];

export interface BoardColumn {
  id: string;
  name: string;
  kind: "system" | "assignee";
  system_key: SystemColumnKey | null;
  assignee_id: string | null;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
```

```ts
// features/columns/schemas.ts
import { z } from "zod";

export const createColumnSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(80, "Use até 80 caracteres"),
  assigneeId: z.uuid("Selecione um responsável"),
});

export const renameColumnSchema = z.object({
  columnId: z.uuid(),
  name: z.string().trim().min(2).max(80),
});
```

Extend `UserPermissions` with `can_manage_columns: boolean`, `EffectivePermissions` with `canManageColumns: boolean`, and `RequestRecord` with `column_id: string`. Return `canManageColumns: true` for owner and `permissions?.can_manage_columns ?? false` for members.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm test -- tests/unit/columns-domain.test.ts tests/unit/domain.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/columns features/requests/types.ts lib/permissions.ts tests/unit/columns-domain.test.ts tests/unit/domain.test.ts
git commit -m "feat: add board column domain"
```

---

### Task 2: Additive database schema and data migration

**Files:**
- Create: `supabase/migrations/202608290005_board_columns.sql`
- Modify: `supabase/tests/rls.test.sql`

**Interfaces:**
- Consumes: existing `profiles`, `requests`, `user_permissions`, `set_updated_at`, and the three legacy status values.
- Produces: `board_columns`, `requests.column_id`, `user_permissions.can_manage_columns`, compatibility trigger `sync_request_legacy_status`, grants, and Realtime publication.

- [ ] **Step 1: Add failing pgTAP assertions**

Increase the plan count by six and append:

```sql
select has_table('public', 'board_columns', 'board_columns existe');
select has_column('public', 'requests', 'column_id', 'requests possui column_id');
select has_column('public', 'user_permissions', 'can_manage_columns', 'permissão de colunas existe');
select ok(has_table_privilege('authenticated', 'public.board_columns', 'select'), 'autenticados leem colunas');
select results_eq(
  $$ select count(*)::bigint from public.board_columns where kind = 'system' $$,
  array[3::bigint],
  'existem três colunas de sistema'
);
select is_empty(
  $$ select id from public.requests where column_id is null $$,
  'todas as solicitações foram migradas'
);
```

- [ ] **Step 2: Run the database test and verify RED**

Run: `npx supabase test db`

Expected: FAIL because `board_columns` and the new columns do not exist. If Docker/Supabase CLI is unavailable, execute the six read-only assertions in the project de teste and record the failing output before continuing.

- [ ] **Step 3: Create the additive migration**

Implement the following exact structure:

```sql
create table public.board_columns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  kind text not null check (kind in ('system', 'assignee')),
  system_key text check (system_key in ('pending', 'in_progress', 'completed')),
  assignee_id uuid references public.profiles(id) on delete restrict,
  position numeric not null check (position >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint board_columns_shape check (
    (kind = 'system' and system_key is not null and assignee_id is null)
    or (kind = 'assignee' and system_key is null and assignee_id is not null)
  )
);

create unique index board_columns_system_key_unique on public.board_columns(system_key) where system_key is not null;
create unique index board_columns_assignee_unique on public.board_columns(assignee_id) where assignee_id is not null;
create index board_columns_position_idx on public.board_columns(position, id);

insert into public.board_columns(name, kind, system_key, position)
values ('Pendente', 'system', 'pending', 1024),
       ('Em progresso', 'system', 'in_progress', 2048),
       ('Concluído', 'system', 'completed', 3072)
on conflict do nothing;

alter table public.user_permissions add column can_manage_columns boolean not null default false;
alter table public.requests add column column_id uuid references public.board_columns(id) on delete restrict;
update public.requests r set column_id = c.id from public.board_columns c where c.system_key = r.status;
alter table public.requests alter column column_id set not null;
alter table public.requests alter column status drop not null;
create index requests_column_position_idx on public.requests(column_id, position);
```

Add a `before insert or update of column_id` trigger that sets legacy `status` to the target column's `system_key`, or `NULL` for an assignee column. For compatibility with the old app, if an insert omits `column_id`, assign the `pending` system column before validating `NOT NULL`.

Enable RLS on `board_columns`; grant schema usage and table select to `authenticated`; add `board_columns_read_approved` using `public.is_approved()`. Add `updated_at`, `replica identity full`, and idempotently add the table to `supabase_realtime`.

- [ ] **Step 4: Re-run database tests and verify GREEN**

Run: `npx supabase db reset && npx supabase test db`

Expected: all pgTAP assertions pass, including all existing tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202608290005_board_columns.sql supabase/tests/rls.test.sql
git commit -m "feat: add board columns schema"
```

---

### Task 3: Secure column and request RPCs

**Files:**
- Create: `supabase/migrations/202608290006_board_column_rpcs.sql`
- Modify: `supabase/tests/rls.test.sql`

**Interfaces:**
- Consumes: `board_columns`, `requests.column_id`, `public.is_owner()`, `public.is_approved()`, and `public.has_request_permission(text)`.
- Produces: `has_column_management_permission()`, `create_board_column(text,uuid,numeric)`, `rename_board_column(uuid,text)`, `reorder_board_column(uuid,numeric)`, `delete_board_column(uuid)`, `create_request(text,text,text,uuid,text,numeric)`, and `move_request(uuid,uuid,numeric)`.

- [ ] **Step 1: Add failing privilege and behavior tests**

Append pgTAP assertions for every function signature and SQL transaction tests that establish `request.jwt.claims` for: owner, member with `can_manage_columns`, member without it, and approved mover. Verify unauthorized creation raises `42501`, duplicate assignee raises `23505`, deleting an occupied column raises `23503`, and moving returns the new `column_id`.

Example assertion:

```sql
select has_function('public', 'move_request', array['uuid','uuid','numeric'], 'RPC move por coluna existe');
select function_privs_are('public', 'create_board_column', array['text','uuid','numeric'], 'authenticated', array['EXECUTE'], 'authenticated executa criação de coluna');
```

- [ ] **Step 2: Run database tests and verify RED**

Run: `npx supabase test db`

Expected: FAIL because the new functions do not exist.

- [ ] **Step 3: Implement permission and column RPCs**

Use this permission function in all four column RPCs:

```sql
create or replace function public.has_column_management_permission()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_owner() or exists (
    select 1 from public.user_permissions p
    join public.profiles u on u.id = p.user_id
    where p.user_id = auth.uid()
      and u.approval_status = 'approved'
      and p.can_manage_columns
  )
$$;
```

`create_board_column` must validate trimmed name, approved assignee, permission, and insert `{kind:'assignee', assignee_id:target_assignee}`. Rename/reorder/delete must lock the row, reject `kind='system'`, and delete must check `not exists(select 1 from requests where column_id = target_column)`.

- [ ] **Step 4: Implement request RPCs**

`create_request` validates `has_request_permission('create')`, approved assignee and URL, then selects the assignee column or `pending` fallback and inserts with `created_by = auth.uid()`.

`move_request(uuid,uuid,numeric)` validates `has_request_permission('move')`, a non-negative position and an existing column, locks the request, and updates `column_id` plus `position`.

Replace `update_request_content` with the existing signature. Lock the request, read its current column kind, and after changing `assigned_to` move only an assignee-column card to the new assignee column or `pending` fallback. A fixed-column card keeps `column_id`.

For every new function:

```sql
revoke all on function public.function_name(signature) from public;
grant execute on function public.function_name(signature) to authenticated;
```

Keep the legacy `move_request(uuid,text,numeric)` and direct insert grant during this migration so the old deployment remains functional.

- [ ] **Step 5: Run database tests and verify GREEN**

Run: `npx supabase db reset && npx supabase test db`

Expected: all schema, permission, RLS and RPC assertions pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202608290006_board_column_rpcs.sql supabase/tests/rls.test.sql
git commit -m "feat: secure board column operations"
```

---

### Task 4: Browser APIs, reducers and filters

**Files:**
- Create: `features/columns/api.ts`
- Create: `features/columns/reducer.ts`
- Create: `features/requests/filter.ts`
- Create: `tests/unit/columns-state.test.ts`
- Modify: `features/requests/api.ts`
- Modify: `features/requests/ordering.ts`
- Modify: `features/requests/reducer.ts`
- Modify: `tests/unit/state-and-auth.test.ts`

**Interfaces:**
- Consumes: RPC signatures from Task 3 and types from Task 1.
- Produces: `createBoardColumn`, `renameBoardColumn`, `reorderBoardColumn`, `deleteBoardColumn`, `columnsReducer`, `filterBoard`, `createRequest` via RPC, and `moveRequest(requestId,columnId,position)`.

- [ ] **Step 1: Write failing unit tests**

```ts
it("reconciles duplicate column events by id", () => {
  const once = columnsReducer([], { type: "insert", column });
  expect(columnsReducer(once, { type: "insert", column })).toEqual(once);
});

it("filters by selected column and normalized text", () => {
  expect(filterBoard(requests, "column-lucifer", "pedido")).toEqual([requests[0]]);
  expect(filterBoard(requests, "all", "LUCIFER")).toEqual([requests[0]]);
});
```

Also update reducer/ordering fixtures to use `column_id` instead of grouping by `status`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm test -- tests/unit/columns-state.test.ts tests/unit/state-and-auth.test.ts`

Expected: FAIL because the reducers and filter do not exist and request ordering still reads `status`.

- [ ] **Step 3: Implement pure state helpers**

`columnsReducer` supports `snapshot`, `insert`, `update`, and `delete`, deduplicates with `Map<string, BoardColumn>`, and sorts system columns by their fixed positions followed by assignee columns by `position` then `id`.

`filterBoard(requests, selectedColumnId, query)` first matches `column_id` unless `all`, then performs the existing case-insensitive search against title, requester and assignee name.

Update request ordering to sort by `column_id`, `position`, then `id`.

- [ ] **Step 4: Implement RPC clients**

```ts
export async function moveRequest(requestId: string, columnId: string, position: number) {
  const response = await createBrowserClient().rpc("move_request", {
    request_id: requestId,
    new_column_id: columnId,
    new_position: position,
  });
  if (response.error) throw response.error;
  return response.data as RequestRecord;
}
```

Implement column functions with the exact RPC parameter names from Task 3. Replace direct request insert with `rpc("create_request", ...)` and keep `update_request_content` client arguments unchanged.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `pnpm test -- tests/unit/columns-state.test.ts tests/unit/state-and-auth.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add features/columns features/requests tests/unit/columns-state.test.ts tests/unit/state-and-auth.test.ts
git commit -m "feat: add dynamic board state"
```

---

### Task 5: Load columns and render filters plus dynamic lists

**Files:**
- Create: `components/kanban/board-filters.tsx`
- Modify: `app/(private)/dashboard/page.tsx`
- Modify: `components/kanban/kanban-board.tsx`
- Modify: `components/kanban/kanban-column.tsx`
- Create: `tests/unit/board-filters.test.tsx`

**Interfaces:**
- Consumes: `BoardColumn`, `columnsReducer`, `filterBoard`, and `EffectivePermissions`.
- Produces: dashboard props `initialColumns`, Realtime column reconciliation, horizontal dynamic board, and accessible filter chips.

- [ ] **Step 1: Write failing component tests**

Render `BoardFilters` with three system columns and one assignee column. Assert `Todos`, the four names, counts, selected state, and `onChange(column.id)`. Render `KanbanColumn` with a generic `BoardColumn` and assert its name and count.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm test -- tests/unit/board-filters.test.tsx`

Expected: FAIL because `BoardFilters` and generic column props do not exist.

- [ ] **Step 3: Load columns on the server**

In `dashboard/page.tsx`, add `supabase.from("board_columns").select("*").order("position")` to the existing `Promise.all`, select requests with the assignee relation, and pass `initialColumns` to `KanbanBoard`.

- [ ] **Step 4: Implement filters and generic columns**

`BoardFilters` receives `{columns, requests, selected, onChange}` and renders buttons with `aria-pressed`. Count by `request.column_id` and use `Todos` for the total.

Change `KanbanColumn` to receive `{column: BoardColumn, requests, canMove, onOpen}` and use `column.id` as the droppable ID. Apply fixed badge colors by `system_key`; use violet styling for assignee columns.

Change the board container to `flex items-start gap-4 overflow-x-auto pb-4`; give every column `w-[320px] shrink-0`. Subscribe to `board_columns` Realtime, dispatch column events, and reset a deleted selected filter to `all`.

- [ ] **Step 5: Run focused and existing tests**

Run: `pnpm test -- tests/unit/board-filters.test.tsx tests/unit/columns-state.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/'(private)'/dashboard/page.tsx components/kanban tests/unit/board-filters.test.tsx
git commit -m "feat: render dynamic board columns"
```

---

### Task 6: Column management UI and permission administration

**Files:**
- Create: `components/kanban/add-column.tsx`
- Create: `components/kanban/column-actions.tsx`
- Modify: `components/kanban/kanban-board.tsx`
- Modify: `components/users/users-panel.tsx`
- Modify: `features/users/schemas.ts`
- Modify: `app/api/admin/users/route.ts`
- Modify: `app/api/admin/users/[id]/route.ts`
- Create: `tests/unit/add-column.test.tsx`
- Modify: `tests/unit/domain.test.ts`

**Interfaces:**
- Consumes: column APIs, `canManageColumns`, approved profiles, and `can_manage_columns` database field.
- Produces: `+ Adicionar outra lista`, create/rename/delete controls, and the `Gerenciar colunas` checkbox in admin.

- [ ] **Step 1: Write failing UI and schema tests**

Assert the add-list control excludes profiles already represented by `columns.filter(c => c.assignee_id)`, submits `{name, assigneeId}`, and is hidden when `canManageColumns` is false. Extend the user permission schema test to require five boolean fields including `can_manage_columns`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm test -- tests/unit/add-column.test.tsx tests/unit/domain.test.ts`

Expected: FAIL because the component and permission field are absent.

- [ ] **Step 3: Implement add and column action components**

`AddColumn` toggles an inline form after a button labeled `+ Adicionar outra lista`, defaults the name when the profile changes, disables save while busy, and surfaces RPC errors in Portuguese.

`ColumnActions` is rendered only for `kind='assignee'` and `canManageColumns`. It supports rename and delete confirmation. When deletion returns the occupied-column error, show `Mova os cartões antes de excluir esta coluna.`

Wire successful operations through the columns reducer immediately; Realtime remains the authoritative reconciliation path.

- [ ] **Step 4: Extend admin permissions end to end**

Add `can_manage_columns` to `PermissionSet`, `permissionLabels`, the GET mapping in `app/api/admin/users/route.ts`, and the PATCH update data in `[id]/route.ts`. Extend `updateUserSchema`:

```ts
permissions: z.object({
  can_create_requests: z.boolean(),
  can_edit_requests: z.boolean(),
  can_move_requests: z.boolean(),
  can_delete_requests: z.boolean(),
  can_manage_columns: z.boolean(),
})
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `pnpm test -- tests/unit/add-column.test.tsx tests/unit/domain.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/kanban components/users/users-panel.tsx features/users/schemas.ts app/api/admin/users tests/unit/add-column.test.tsx tests/unit/domain.test.ts
git commit -m "feat: manage responsible columns"
```

---

### Task 7: Request destination, status actions and drag-and-drop

**Files:**
- Modify: `components/requests/request-dialog.tsx`
- Modify: `components/kanban/kanban-board.tsx`
- Create: `tests/unit/request-destination.test.tsx`
- Create: `tests/unit/kanban-movement.test.tsx`

**Interfaces:**
- Consumes: system/assignee columns, request/column APIs, request permission flags, and `positionBetween`.
- Produces: destination preview, fixed-status buttons, initial assignee placement, and drag-and-drop by `column_id`.

- [ ] **Step 1: Write failing request dialog tests**

Render a new request with a responsible that has a linked column and assert `Entrará em: Lucifer`. Switch to a profile without a column and assert `Entrará em: Pendente`. Render an existing request with `canMove` and assert buttons `Pendente`, `Em progresso`, and `Concluído` call `onMoveToSystem("completed")` for the completed action.

- [ ] **Step 2: Write failing board movement tests**

Create fixtures with `column_id` in an assignee column. Simulate a drag over the pending column and assert the optimistic request uses `pendingColumn.id`; reject the API promise and assert rollback restores the original `column_id` and position.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `pnpm test -- tests/unit/request-destination.test.tsx tests/unit/kanban-movement.test.tsx`

Expected: FAIL because the new props and `column_id` movement are not implemented.

- [ ] **Step 4: Implement destination preview and status actions**

Pass `columns` and `canMove` into `RequestDialog`. Derive the target assignee column from the selected profile and fall back to the `pending` system column. In read mode, render three buttons only when `canMove`; resolve a `system_key` to its column ID before calling `moveRequest`.

- [ ] **Step 5: Convert drag-and-drop to column IDs**

In `handleMove`, determine `targetColumnId` from `event.over.id` when it matches a column or from `overCard.column_id`. Build the target list with `request.column_id === targetColumnId`, calculate `positionBetween`, optimistically set `column_id`, call `moveRequest(id,targetColumnId,position)`, and restore the entire previous request on failure.

When creating, call the new request RPC; do not compute a pending position in the browser. When editing, trust the returned `column_id` because changing an assignee-column card's responsible may move it.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `pnpm test -- tests/unit/request-destination.test.tsx tests/unit/kanban-movement.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/requests/request-dialog.tsx components/kanban/kanban-board.tsx tests/unit/request-destination.test.tsx tests/unit/kanban-movement.test.tsx
git commit -m "feat: route requests through board columns"
```

---

### Task 8: Compatibility lockdown, full verification and production rollout

**Files:**
- Create: `supabase/migrations/202608290007_board_columns_lockdown.sql`
- Modify: `README.md`
- Modify: `docs/supabase-setup.md`
- Modify: `docs/deploy-vercel.md`

**Interfaces:**
- Consumes: deployed application using `create_request` and `move_request(uuid,uuid,numeric)`.
- Produces: removal of legacy write paths, updated operational documentation, and verified production behavior.

- [ ] **Step 1: Write the lockdown migration**

```sql
revoke insert on table public.requests from authenticated;
drop function if exists public.move_request(uuid,text,numeric);
```

Keep the nullable legacy `requests.status` plus its synchronization trigger for this release, as required by the spec.

- [ ] **Step 2: Run the complete local verification**

Run:

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
npx supabase db reset
npx supabase test db
```

Expected: every command exits with code 0. If local Supabase is unavailable, run all application commands and execute the database test file against a disposable Supabase branch, never production.

- [ ] **Step 3: Apply the additive production migrations first**

Apply only `202608290005_board_columns.sql` and `202608290006_board_column_rpcs.sql` to production. Verify read-only:

```sql
select system_key, name from public.board_columns where kind = 'system' order by position;
select count(*) from public.requests where column_id is null;
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'user_permissions' and column_name = 'can_manage_columns';
```

Expected: three ordered system rows, zero null request locations, and one permission column.

- [ ] **Step 4: Publish application files and wait for Vercel**

Publish all changed files to `main`, verify GitHub contents match local files, and wait until the production deployment is `Ready`.

- [ ] **Step 5: Run production smoke tests before lockdown**

Using the owner account:

1. Confirm the three fixed columns render.
2. Create one responsible column with `+ Adicionar outra lista`.
3. Create a request assigned to that responsible and confirm it lands in their column.
4. Move it to `Em progresso` using the status action and confirm the assignee remains unchanged.
5. Filter with `Todos`, `Em progresso`, and the responsible chip.
6. Drag the request between columns and confirm persistence after reload.
7. Confirm an occupied responsible column cannot be deleted.
8. Grant `Gerenciar colunas` to a member and confirm the control appears after the permission update.

- [ ] **Step 6: Apply lockdown and re-run critical smoke tests**

Apply `202608290007_board_columns_lockdown.sql`, then repeat request creation and movement. Inspect Vercel and Supabase logs for 4xx/5xx errors and verify Realtime does not duplicate columns or cards.

- [ ] **Step 7: Update documentation and commit**

Document the dynamic columns, new permission, migration order and smoke-test sequence. Then:

```bash
git add supabase/migrations/202608290007_board_columns_lockdown.sql README.md docs/supabase-setup.md docs/deploy-vercel.md
git commit -m "docs: document responsible column rollout"
```

---

## Plan Self-Review

- Spec coverage: Tasks 2-3 cover schema, migration, RLS, grants and RPCs; Tasks 4-7 cover state, filters, management, request workflow, drag-and-drop and Realtime; Task 8 covers compatibility, production rollout and documentation.
- Data safety: existing requests are backfilled before `column_id` becomes mandatory; legacy status and movement remain during the transition; destructive legacy cleanup happens only after production smoke tests.
- Type consistency: client and SQL use `column_id`/`new_column_id`; UI uses `BoardColumn.id`; fixed actions resolve `SystemColumnKey` to a column ID.
- Scope: no multiple boards, free-form columns, archival, audit history or new dependencies were added.

