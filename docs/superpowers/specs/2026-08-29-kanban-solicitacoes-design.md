# Especificação técnica — Kanban de solicitações

## 1. Objetivo e escopo

Construir uma aplicação web em português do Brasil para cadastrar e acompanhar solicitações em um único quadro Kanban. O quadro terá três colunas fixas: `pending` (Pendente), `in_progress` (Em progresso) e `completed` (Concluído).

A primeira versão inclui autenticação por e-mail e senha, aprovação de contas pelo owner, permissões individuais, administração de usuários, CRUD de solicitações, pesquisa, filtro por responsável, drag-and-drop e sincronização em tempo real. Não inclui comentários, chat, arquivos, etiquetas, subtarefas, calendário, notificações, histórico complexo, múltiplos quadros, colunas personalizáveis ou integrações externas.

## 2. Premissas

- O repositório será tratado como vazio e inicializado como uma aplicação Next.js com App Router e TypeScript.
- Tailwind CSS fornecerá o sistema visual, sem biblioteca obrigatória de componentes.
- O Supabase será a fonte de autenticação, dados, autorização e eventos em tempo real.
- A aplicação será preparada para Vercel, mas não será publicada sem autorização explícita.
- Nenhuma alteração será feita manualmente no banco sem uma migration ou procedimento administrativo documentado.
- Nenhum commit ou push será realizado sem autorização explícita.
- Confirmação de e-mail será compatível com o fluxo, mas sua ativação será uma configuração do projeto Supabase.

## 3. Arquitetura

### 3.1 Camadas

1. **Interface Next.js:** páginas do App Router, componentes responsivos e estados de carregamento, vazio, sucesso e erro.
2. **Sessão e proteção:** clientes Supabase separados para browser, Server Components e código administrativo; middleware apenas para renovação da sessão e proteção básica; layouts e páginas do servidor validam perfil, função e status antes de renderizar conteúdo privado.
3. **Domínio:** schemas Zod, tipos compartilhados e funções puras para filtragem, ordenação, atualização otimista e reconciliação de eventos.
4. **Dados comuns:** operações sob o JWT do usuário e políticas RLS. Leitura e criação podem usar a API de dados; edição de conteúdo e movimentação usam RPCs distintas para que o banco valide permissões independentes.
5. **Administração:** Route Handlers protegidos por sessão, status aprovado e função owner. A service role existe somente nesses módulos de servidor e apenas para operações da API administrativa do Supabase.
6. **Realtime:** canais autenticados para `requests`, `profiles` e `user_permissions`, iniciados depois da sessão e removidos ao desmontar. Eventos são reconciliados por chave primária para evitar duplicação.

### 3.2 Estrutura principal

```text
app/
  (auth)/login, register, forgot-password, reset-password
  (private)/pending, dashboard, admin/users
  auth/callback
  api/admin/users
components/
  auth, layout, kanban, requests, users, ui
features/
  auth, requests, users, realtime
lib/
  supabase, validation, permissions, errors
supabase/
  migrations, scripts, tests
tests/
  unit, integration, e2e
```

Os arquivos serão divididos por responsabilidade; componentes de UI não acessarão a service role nem concentrarão regras de autorização.

## 4. Autenticação e ciclo da conta

- Cadastro público solicita nome, e-mail, senha e confirmação.
- O cliente chama `signUp` com `full_name` em `options.data`.
- Um trigger em `auth.users` cria `profiles` com `role = 'member'` e `approval_status = 'pending'`, além de uma linha de permissões inicialmente desativadas.
- Se a confirmação de e-mail estiver ativa, o callback troca o código por sessão. Depois disso, o roteamento considera o status do perfil.
- `pending`, `rejected` e `suspended` não acessam o dashboard. A página `/pending` mostra uma mensagem específica para cada estado e permite encerrar a sessão.
- Mudanças no perfil do usuário conectado são recebidas em tempo real. Se ele deixar de ser `approved`, o estado do quadro é descartado e o usuário é redirecionado imediatamente.
- Recuperação usa `resetPasswordForEmail` com redirecionamento para `/reset-password`; a nova senha é definida apenas pelo Supabase Auth.
- Logout usa `signOut` e redireciona para `/login`.

## 5. Modelo de dados

### 5.1 `profiles`

- `id uuid primary key references auth.users(id) on delete cascade`
- `full_name text not null` com tamanho validado
- `role text not null check (role in ('owner', 'member'))`
- `approval_status text not null check (approval_status in ('pending', 'approved', 'rejected', 'suspended'))`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- índice por `approval_status`

### 5.2 `user_permissions`

- `user_id uuid primary key references profiles(id) on delete cascade`
- quatro permissões booleanas `not null default false`
- `updated_at timestamptz not null default now()`

### 5.3 `requests`

- `id uuid primary key default gen_random_uuid()`
- `title text not null` com tamanho validado
- `description text` opcional com tamanho validado
- `requester_name text not null` com tamanho validado
- `assigned_to uuid not null references profiles(id)`
- `external_url text` opcional, validada no aplicativo e por constraint de formato HTTP/HTTPS no banco
- `status text not null check (status in ('pending', 'in_progress', 'completed'))`
- `position numeric not null`
- `created_by uuid not null references profiles(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- índices em `(status, position)`, `assigned_to` e `created_by`

Triggers comuns atualizam `updated_at`. A migration adiciona as três tabelas à publicação `supabase_realtime` de forma idempotente e configura replica identity adequada para reconciliar alterações e exclusões.

## 6. Owner e administração

O primeiro owner será promovido por um script SQL idempotente que recebe o e-mail como parâmetro de sessão do `psql` ou valor substituído localmente. O script encontra o usuário em `auth.users`, promove seu perfil para `owner`, define `approved` e ativa todas as permissões. O README documentará que o usuário precisa ter sido criado previamente e que o script deve ser executado apenas no ambiente administrativo.

O painel `/admin/users` será exclusivo do owner e permitirá pesquisar, filtrar por status, editar nome, aprovar, rejeitar, suspender, reativar e alterar permissões. Operações comuns sobre `profiles` e `user_permissions` ficam protegidas por RLS; criação manual de conta usa um Route Handler com `auth.admin.createUser`, senha temporária recebida pelo owner e nunca registrada em logs.

O banco bloqueará mudanças que removam o próprio owner ativo por meio das RPCs administrativas, e a interface desabilitará as ações correspondentes. O painel não oferecerá exclusão de contas nesta versão, evitando uma operação não exigida e eliminando o risco de autoexclusão.

## 7. Autorização e RLS

Todas as tabelas terão RLS habilitada. Funções auxiliares `security definer`, com `search_path` fixo e acesso revogado de `public`, consultarão aprovação, função e permissões sem provocar recursão nas políticas.

- Um usuário não aprovado lê somente o próprio perfil.
- Um aprovado lê os campos públicos de perfis aprovados necessários ao responsável e ao quadro, além do próprio perfil.
- O owner lê e administra todos os perfis e permissões.
- Um membro lê apenas as próprias permissões e não as modifica.
- A leitura de solicitações exige conta aprovada.
- A criação exige `can_create_requests` ou owner; `created_by` deve ser `auth.uid()` e o responsável deve estar aprovado.
- A edição de conteúdo usa `update_request_content(...)`, que exige `can_edit_requests` ou owner e não aceita status nem posição.
- A movimentação usa `move_request(...)`, que exige `can_move_requests` ou owner e altera somente status e posição.
- A exclusão exige `can_delete_requests` ou owner.
- Atualizações genéricas diretas na tabela `requests` não serão concedidas ao papel autenticado; apenas as RPCs autorizadas poderão modificar dados.

Funções administrativas validarão owner no banco e impedirão que um owner altere o próprio papel ou status para um valor que retire seu acesso.

## 8. Kanban e ordenação

O quadro carrega solicitações ordenadas por status e posição. Cada coluna é uma área `dnd-kit`, e cada card é arrastável somente quando `can_move_requests` estiver ativa ou o usuário for owner.

Ao mover um card, o cliente calcula uma posição fracionária entre os vizinhos. Se não houver espaço numérico seguro ou uma coluna acumular posições excessivamente próximas, a RPC renormaliza a coluna em passos inteiros dentro da mesma transação. A interface aplica a mudança imediatamente, chama `move_request` e, em erro, restaura o snapshot anterior e exibe uma mensagem em português.

Eventos Realtime são aplicados por UUID:

- `INSERT`: adiciona apenas se o UUID ainda não existir.
- `UPDATE`: substitui a versão do mesmo UUID e reordena a coluna.
- `DELETE`: remove o UUID.
- uma confirmação do próprio movimento é idempotente e não cria cópias.

Pesquisa e filtro são locais sobre os dados permitidos pelo RLS. A pesquisa ignora caixa e verifica título, solicitante e nome do responsável.

## 9. Formulários e interface

- Todos os formulários usam o mesmo schema Zod no cliente e no servidor/RPC boundary aplicável.
- O link externo aceita somente URLs absolutas HTTP ou HTTPS e abre com `target="_blank" rel="noopener noreferrer"`.
- O formulário de solicitação oferece título, descrição, solicitante, responsável aprovado e link.
- Detalhes e edição usam diálogos acessíveis; exclusão exige confirmação explícita.
- O cabeçalho mostra identidade, estado da conta, acesso administrativo quando aplicável e logout.
- O visual usa fundo neutro, cards claros, bordas e sombras discretas e cores moderadas por status.
- Em telas pequenas, as colunas são exibidas horizontalmente com rolagem; formulários e diálogos ocupam a largura disponível.
- Skeletons aparecem no carregamento, mensagens claras nos erros e empty states nas colunas sem cards.
- Ações indisponíveis ficam ocultas ou desabilitadas, mas a segurança efetiva permanece no banco.

## 10. Fluxo de dados e erros

Server Components obtêm sessão e perfil para decidir o primeiro redirecionamento. Componentes clientes recebem os dados iniciais, estabelecem Realtime após autenticação e mantêm o estado interativo.

Erros do Supabase serão convertidos em mensagens compreensíveis sem revelar detalhes internos. Erros de validação aparecem junto aos campos. Falhas de rede preservam a tela quando possível, oferecem nova tentativa e revertem apenas mutações otimistas ainda não confirmadas. Reconexões provocam uma nova leitura canônica antes de retomar eventos, evitando lacunas.

## 11. Testes e critérios de aceitação

- Testes unitários cobrem schemas, cálculo e normalização de posições, filtros e reconciliação idempotente de eventos.
- Testes SQL verificam RLS e RPCs com identidades simuladas: pendente sem quadro; aprovado com leitura; permissões independentes negando criar, editar, mover e excluir; owner com acesso total; membro incapaz de promover a si próprio.
- Testes de integração cobrem os Route Handlers administrativos com clientes Supabase substituídos por doubles, garantindo autenticação, autorização e ausência de service role no bundle cliente.
- Testes E2E cobrem login, redirecionamento por aprovação, criação/edição/exclusão autorizadas e movimento visual do card quando um ambiente Supabase de teste estiver configurado.
- A conclusão exige executar lint, TypeScript, testes e build de produção. Testes dependentes de Supabase serão documentados separadamente e não serão declarados como executados se as credenciais de teste estiverem ausentes.

## 12. Configuração e entrega

O repositório conterá `.env.example` com:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OWNER_EMAIL=
```

O README explicará instalação, migrations, Auth, confirmação de e-mail, Realtime, URLs local e Vercel, bootstrap do owner, variáveis, conexão GitHub/Vercel, publicação e checklist pós-deploy. Valores reais nunca serão versionados.

Sem credenciais, será possível concluir código, migrations e testes isolados. A validação integrada, a aplicação das migrations, o bootstrap real do owner e o deploy ficarão explicitamente pendentes até o usuário fornecer/configurar as credenciais e autorizar as ações externas.

## 13. Decisões fora de escopo

- Não haverá exclusão de usuários pelo painel nesta versão.
- Não haverá atribuição a usuário pendente, rejeitado ou suspenso.
- Não haverá edição direta genérica de `requests`; conteúdo e movimento serão operações separadas.
- Não haverá dados falsos permanentes ou fallback que simule Supabase em produção.
- Não haverá service role em módulos importáveis pelo navegador.
