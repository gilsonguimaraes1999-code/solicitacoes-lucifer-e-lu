# Colunas de responsáveis e filtros do quadro

## Objetivo

Evoluir o quadro atual para manter as três colunas fixas `Pendente`, `Em progresso` e `Concluído` e permitir que usuários autorizados criem colunas adicionais vinculadas a responsáveis. Cada solicitação aparece em exatamente uma coluna. Ao ser criada, ela entra na coluna do responsável quando essa coluna existir; ao receber um dos três status fixos, sai da coluna do responsável e entra na coluna fixa escolhida.

## Regras funcionais

- As três colunas de sistema são sempre visíveis, não podem ser renomeadas nem excluídas.
- O botão `+ Adicionar outra lista` aparece depois da última coluna para quem possui `Gerenciar colunas`.
- Cada coluna personalizada é vinculada a um único perfil aprovado.
- Um perfil pode ter no máximo uma coluna vinculada.
- O nome inicial da coluna é o nome do responsável, mas pode ser renomeado sem alterar o vínculo.
- A coluna personalizada pode ser reordenada entre as demais colunas personalizadas. As três colunas fixas preservam a ordem `Pendente`, `Em progresso`, `Concluído` e ficam antes das personalizadas.
- Uma coluna personalizada só pode ser excluída quando estiver vazia. A interface explica que os cartões precisam ser movidos antes.
- O `owner` possui `Gerenciar colunas` implicitamente. A permissão também pode ser concedida a outros usuários aprovados no painel administrativo.
- Criar uma solicitação continua exigindo um responsável aprovado. Se ele possuir coluna vinculada, o cartão nasce nessa coluna; caso contrário, nasce em `Pendente`.
- Alterar o responsável de um cartão que ainda está em uma coluna de responsável move o cartão para a coluna do novo responsável, se ela existir, ou para `Pendente`. Alterar o responsável de um cartão que já está em uma coluna fixa não altera sua coluna atual.
- Arrastar um cartão entre quaisquer colunas exige a permissão existente `Mover`.
- Nos detalhes do cartão, os botões `Pendente`, `Em progresso` e `Concluído` fazem uma movimentação explícita para a coluna fixa correspondente e também exigem `Mover`.
- A atribuição do responsável permanece registrada quando o cartão vai para uma coluna fixa.

## Filtros no estilo de tópicos

Acima do quadro haverá uma faixa compacta de chips com contagem: `Todos`, `Pendente`, `Em progresso`, `Concluído` e um chip para cada responsável que possui coluna. Os chips apenas filtram a visualização; não alteram dados. `Todos` mostra o quadro completo. Um chip de sistema mostra somente a coluna fixa correspondente, e um chip de responsável mostra a coluna vinculada a ele. A pesquisa textual continua funcionando em conjunto com o chip selecionado.

O seletor suspenso atual de responsável será removido para não duplicar o novo filtro. A pesquisa continua procurando por título, solicitante e responsável.

## Modelo de dados

### `board_columns`

- `id uuid primary key default gen_random_uuid()`
- `name text not null`, entre 2 e 80 caracteres após `trim`
- `kind text not null check (kind in ('system', 'assignee'))`
- `system_key text null check (system_key in ('pending', 'in_progress', 'completed'))`
- `assignee_id uuid null references profiles(id) on delete restrict`
- `position numeric not null check (position >= 0)`
- `created_by uuid null references profiles(id) on delete set null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints garantem que colunas `system` tenham `system_key` e não tenham `assignee_id`, enquanto colunas `assignee` tenham `assignee_id` e não tenham `system_key`. Índices únicos parciais garantem uma coluna por `system_key` e uma coluna por `assignee_id`.

As três linhas de sistema são semeadas idempotentemente com posições estáveis. Colunas de responsável usam posições posteriores e podem ser reordenadas entre si.

### `requests`

Adicionar `column_id uuid references board_columns(id) on delete restrict`. A migração associa todas as solicitações existentes à coluna de sistema correspondente ao `status` atual e torna `column_id` obrigatório.

`column_id` passa a ser a localização canônica do cartão. A coluna `status` atual permanece temporariamente como campo de compatibilidade: a migração remove seu `NOT NULL`, e um trigger a mantém com a `system_key` quando o cartão está em coluna fixa e com `NULL` quando está em coluna de responsável. O código novo não usa `status`; uma migração futura poderá removê-lo depois de um ciclo de produção estável.

### `user_permissions`

Adicionar `can_manage_columns boolean not null default false`. A função de permissões efetivas devolve `canManageColumns`, sempre `true` para `owner` e baseada na nova coluna para membros.

## Segurança e operações do banco

- Usuários aprovados podem ler `board_columns`.
- Escritas diretas em `board_columns` não são concedidas a clientes.
- RPCs `create_board_column`, `rename_board_column`, `reorder_board_column` e `delete_board_column` validam `is_owner()` ou `can_manage_columns` em uma função `has_column_management_permission()`.
- As RPCs recusam mudanças em colunas de sistema, responsáveis não aprovados, segundo vínculo para o mesmo responsável, posições negativas e exclusão de coluna não vazia.
- `move_request` passa a receber `new_column_id` e `new_position`, valida que a coluna existe e altera apenas localização e posição.
- `update_request_content` continua protegendo os dados editáveis. Quando o responsável muda, ela aplica a regra de movimentação automática somente se a coluna atual for do tipo `assignee`.
- A criação calcula a coluna inicial no servidor por uma RPC `create_request`, evitando que o cliente burle a escolha de responsável ou criador.
- As novas funções são `security definer`, têm `search_path` fixo, são revogadas de `public` e concedidas somente a `authenticated`.
- `board_columns` entra na publicação Realtime com `replica identity full`.

## Interface e interação

O quadro passa a ser uma faixa horizontal de listas com largura consistente, semelhante ao comportamento do Trello, sem copiar sua identidade visual. Cada lista contém título, contagem, cartões e estado vazio. Colunas personalizadas mostram um menu de ações somente para quem pode gerenciá-las. O botão de adicionar lista abre um formulário compacto para selecionar um responsável aprovado ainda sem coluna e confirmar o nome inicial.

O formulário de nova solicitação mostra, abaixo do responsável, uma indicação de destino: `Entrará em: <nome da coluna>` ou `Entrará em: Pendente`. Nos detalhes de uma solicitação, três chips de ação permitem movê-la para os status fixos. Os chips globais de filtro possuem estado selecionado, contagem e rótulos acessíveis.

Movimentos por drag-and-drop continuam otimistas. Em falha, o cartão volta para a coluna e posição anteriores e uma mensagem em português é exibida. Criação, renomeação, ordenação e exclusão de colunas também exibem sucesso ou erro sem recarregar a página.

Em telas pequenas, o quadro usa rolagem horizontal e cada coluna preserva uma largura legível. O botão de adicionar lista permanece como o último item da faixa.

## Realtime e estado do cliente

O dashboard carrega solicitações, colunas e perfis aprovados no servidor. O estado do cliente mantém coleções separadas para solicitações e colunas. Eventos Realtime de `requests` reconciliam cartões por UUID; eventos de `board_columns` inserem, atualizam ou removem colunas idempotentemente. A ordenação usa `position` e desempate por UUID.

Os filtros são estado local derivado e não duplicam dados canônicos. Se a coluna correspondente ao filtro selecionado for removida, o filtro volta para `Todos`.

## Migração e implantação

1. Aplicar uma migração aditiva que cria `board_columns`, semeia as três colunas fixas, adiciona `column_id`, migra solicitações existentes, adiciona a permissão, políticas, grants, triggers e RPCs. O campo legado `status` é mantido para compatibilidade durante o deploy.
2. Publicar o aplicativo que usa `column_id` e as novas RPCs.
3. Validar criação de coluna, criação de solicitação, movimentação por chip e drag-and-drop, filtros, permissões e Realtime em produção.
4. A remoção definitiva de `status` fica fora deste escopo e só deve ocorrer em uma migração posterior, após confirmação de estabilidade.

## Tratamento de erros

- Nome inválido: mensagem no formulário da coluna.
- Responsável sem aprovação ou já vinculado: impedir confirmação e atualizar a lista disponível.
- Exclusão de coluna ocupada: manter a coluna e informar que os cartões precisam ser movidos.
- Falha de movimentação: rollback otimista do cartão.
- Evento Realtime duplicado ou fora de ordem: reconciliar por UUID e ordenar novamente.
- Permissão removida durante a sessão: a RPC recusa a operação; o cliente atualiza permissões pelo monitor existente e oculta os controles.

## Testes e critérios de aceite

- Migração associa cada solicitação existente à coluna fixa correta e preserva seus dados.
- As três colunas fixas existem uma única vez e não podem ser alteradas ou excluídas.
- Só owner ou usuário aprovado com `can_manage_columns` gerencia colunas personalizadas.
- Não é possível criar duas colunas para o mesmo responsável.
- Solicitação nova entra na coluna do responsável quando houver vínculo e em `Pendente` quando não houver.
- Mudança de responsável obedece à regra definida para colunas personalizadas e fixas.
- Botões de status e drag-and-drop movem o cartão para exatamente uma coluna.
- Coluna ocupada não pode ser excluída.
- Chips filtram sem alterar solicitações e combinam com a pesquisa textual.
- Realtime mantém solicitações e colunas sincronizadas sem duplicação.
- Testes unitários cobrem schemas, permissões efetivas, filtros, reducer e regras de destino.
- Testes de banco cobrem constraints, RLS, grants e todas as RPCs novas.
- Testes de componente cobrem adicionar lista, criar solicitação, botões de status, empty states e rollback.
- `pnpm test`, `pnpm typecheck`, `pnpm lint` e `pnpm build` passam antes da publicação.

## Fora de escopo

- Múltiplos quadros.
- Colunas sem responsável ou mais de uma coluna para a mesma pessoa.
- Arquivamento de colunas ou cartões.
- Histórico/auditoria de movimentações.
- Automação adicional baseada em prazo, etiqueta ou comentário.

